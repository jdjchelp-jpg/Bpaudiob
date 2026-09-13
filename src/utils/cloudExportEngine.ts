import { BookMetadata, ExportResolution, OverlayOption, SubtitleCue, SubtitleSettings } from '../types';
import { renderOverlayFrame } from './canvasRenderer';
import { RESOLUTION_PRESETS } from './exportOverlay';

export interface CloudExportJob {
  id: string;
  type: 'video' | 'image';
  status: 'queued' | 'rendering' | 'completed' | 'error';
  progress: number;
  stage: string;
  resolution: string;
  durationSeconds: number;
  fileName: string;
  fileSize?: number;
  downloadUrl?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface CloudVideoRenderParams {
  resolution: ExportResolution;
  durationSeconds: number;
  totalSeconds: number;
  option: OverlayOption;
  coverImage: HTMLImageElement | null;
  tiltAngle: number;
  bookMetadata: BookMetadata;
  subtitles: SubtitleCue[];
  subtitleSettings: SubtitleSettings;
  showSubtitles?: boolean;
  showPlaybackButtons?: boolean;
  isTransparent?: boolean;
  audioDataUrl?: string;
  fps?: number;
  onProgress?: (job: CloudExportJob) => void;
}

export interface CloudImageExportParams {
  resolution: ExportResolution;
  option: OverlayOption;
  coverImage: HTMLImageElement | null;
  tiltAngle: number;
  currentSeconds: number;
  totalSeconds: number;
  bookMetadata: BookMetadata;
  activeSubtitle: string | null;
  subtitleSettings?: SubtitleSettings;
  showPlaybackButtons?: boolean;
  isTransparent?: boolean;
}

/**
 * Generates a lightweight single-frame snapshot on a temporary canvas,
 * converts to Data URL, and immediately frees memory to avoid memory leaks.
 */
export function generateSingleFrameSnapshot(params: {
  resolution: ExportResolution;
  option: OverlayOption;
  coverImage: HTMLImageElement | null;
  tiltAngle: number;
  currentSeconds: number;
  totalSeconds: number;
  bookMetadata: BookMetadata;
  activeSubtitle: string | null;
  subtitleSettings?: SubtitleSettings;
  showPlaybackButtons?: boolean;
  isTransparent?: boolean;
}): string {
  const { width, height } = RESOLUTION_PRESETS[params.resolution];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not create 2D canvas context for snapshot');
  }

  renderOverlayFrame(ctx, {
    width,
    height,
    option: params.option,
    coverImage: params.coverImage,
    tiltAngle: params.tiltAngle,
    currentSeconds: params.currentSeconds,
    totalSeconds: params.totalSeconds,
    bookMetadata: params.bookMetadata,
    activeSubtitle: params.activeSubtitle,
    subtitleSettings: params.subtitleSettings,
    showPlaybackButtons: params.showPlaybackButtons,
    isPlaying: false,
    isTransparent: params.isTransparent,
  });

  // Use JPEG for non-transparent backgrounds (fast encoding, minimal network payload)
  // Use PNG only when transparency is explicitly requested
  const format = params.isTransparent ? 'image/png' : 'image/jpeg';
  const quality = params.isTransparent ? undefined : 0.85;
  const dataUrl = canvas.toDataURL(format, quality);

  // Immediately discard canvas dimensions to free GPU and RAM memory
  canvas.width = 0;
  canvas.height = 0;

  return dataUrl;
}

/**
 * Dispatches a high-resolution video rendering job to the Cloud Server.
 * All heavy rendering & FFmpeg encoding takes place in Google Cloud,
 * guaranteeing 0% load on the user's local PC, completely preventing browser crashes.
 */
export async function startCloudVideoRender(
  params: CloudVideoRenderParams
): Promise<CloudExportJob> {
  // 1. Generate clean 1080p base frame without subtitles stamped on.
  // The server-side FFmpeg automatically scales this to 1080p, 1440p, or 4K UHD via bicubic filtering,
  // and burns ASS typography natively at the target resolution.
  // Keeping this at 1080p keeps the upload payload under 250KB, completely avoiding proxy body limits.
  const baseFrame = generateSingleFrameSnapshot({
    resolution: '1080p',
    option: params.option,
    coverImage: params.coverImage,
    tiltAngle: params.tiltAngle,
    currentSeconds: 0,
    totalSeconds: params.totalSeconds,
    bookMetadata: params.bookMetadata,
    activeSubtitle: null, // Left clean so ASS subtitles render dynamically
    subtitleSettings: params.subtitleSettings,
    showPlaybackButtons: params.showPlaybackButtons,
    isTransparent: params.isTransparent,
  });

  const payload = JSON.stringify({
    resolution: params.resolution,
    durationSeconds: params.durationSeconds,
    totalDurationSeconds: params.totalSeconds || params.durationSeconds,
    backgroundImageDataUrl: baseFrame,
    audioDataUrl: params.audioDataUrl,
    subtitles: params.showSubtitles !== false ? params.subtitles : [],
    subtitleSettings: params.subtitleSettings,
    bookMetadata: params.bookMetadata,
    showProgressBar: true,
    fps: params.fps || 30,
  });

  // 2. Dispatch job to Cloud Server with retry
  let response: Response | null = null;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      response = await fetch('/api/export/cloud-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (response.ok) break;
    } catch (err: any) {
      lastError = err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  if (!response || !response.ok) {
    if (response) {
      const errorData = await response.json().catch(() => ({ error: `Server error HTTP ${response?.status}` }));
      throw new Error(errorData.error || `Cloud server error HTTP ${response.status}`);
    }
    throw new Error(
      lastError?.message
        ? `Cloud server is initializing (${lastError.message}). Please retry in a few seconds.`
        : 'Could not connect to Cloud Render server. Please try again.'
    );
  }

  const { jobId } = await response.json();

  // 3. Poll cloud job status until completion with fault-tolerant retry
  return trackCloudJob(jobId, params.onProgress);
}

/**
 * Attaches to an existing or in-flight cloud render job and polls until completion.
 */
export function trackCloudJob(
  jobId: string,
  onProgress?: (job: CloudExportJob) => void
): Promise<CloudExportJob> {
  return new Promise<CloudExportJob>((resolve, reject) => {
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 60; // 2 minutes of consecutive blips allowed before giving up
    const startTime = Date.now();
    const timeoutMs = 35 * 60 * 1000; // 35-minute ceiling for full audiobook tracks

    let isPolling = false;

    const pollInterval = setInterval(async () => {
      // Prevent overlapping polls if a network request is slow
      if (isPolling) return;
      isPolling = true;

      // Safety timeout guard
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(pollInterval);
        reject(new Error('Cloud render timed out after 35 minutes'));
        return;
      }

      try {
        const res = await fetch(`/api/export/status/${jobId}`);
        if (!res.ok) {
          consecutiveErrors++;
          if (consecutiveErrors >= maxConsecutiveErrors) {
            clearInterval(pollInterval);
            reject(new Error(`Cloud job status check failed (HTTP ${res.status}) after multiple attempts`));
          }
          isPolling = false;
          return;
        }

        // Reset error count upon successful poll
        consecutiveErrors = 0;
        const job: CloudExportJob = await res.json();
        onProgress?.(job);

        if (job.status === 'completed') {
          clearInterval(pollInterval);
          resolve(job);
        } else if (job.status === 'error') {
          clearInterval(pollInterval);
          reject(new Error(job.error || 'Cloud rendering encountered an error'));
        }
      } catch (err: any) {
        consecutiveErrors++;
        // Quietly log warnings without throwing prematurely
        if (consecutiveErrors % 5 === 0) {
          console.warn(`[Cloud Export] Network reconnect attempt ${consecutiveErrors}/${maxConsecutiveErrors} (${err?.message})`);
        }
        if (consecutiveErrors >= maxConsecutiveErrors) {
          clearInterval(pollInterval);
          reject(new Error(`Lost connection to cloud render server: ${err?.message || 'Network error'}`));
        }
      } finally {
        isPolling = false;
      }
    }, 2000);
  });
}

/**
 * Saves a high-resolution PNG image directly into Cloud Storage and returns a cloud link.
 */
export async function startCloudImageExport(
  params: CloudImageExportParams
): Promise<CloudExportJob> {
  const dataUrl = generateSingleFrameSnapshot(params);

  const response = await fetch('/api/export/cloud-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageDataUrl: dataUrl,
      resolution: params.resolution,
      title: params.bookMetadata.title,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Cloud image export failed' }));
    throw new Error(errorData.error || 'Cloud image export failed');
  }

  return response.json();
}

/**
 * Fetches previous cloud export history
 */
export async function fetchCloudExports(): Promise<CloudExportJob[]> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch('/api/export/history');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }
  return [];
}

/**
 * Deletes an export file from the cloud server
 */
export async function deleteCloudExport(jobId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/export/${jobId}`, { method: 'DELETE' });
    return res.ok;
  } catch (e) {
    console.warn('Could not delete cloud export:', e);
    return false;
  }
}

/**
 * Helper to trigger a browser download from a cloud URL
 */
export function triggerCloudDownload(downloadUrl: string, fileName?: string) {
  const link = document.createElement('a');
  link.href = downloadUrl;
  if (fileName) link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
