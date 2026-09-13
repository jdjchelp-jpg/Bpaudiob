import { BookMetadata, ExportResolution, OverlayOption, SubtitleSettings } from '../types';
import { audioEngine } from './audioEngine';
import { renderOverlayFrame, RenderFrameParams } from './canvasRenderer';
import { RESOLUTION_PRESETS } from './exportOverlay';

export interface ExportImageOptions {
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
  filename?: string;
}

/**
 * Exports a pristine 4K UHD (3840×2160) or 1080p PNG image
 */
export async function exportCrispPNG(options: ExportImageOptions): Promise<void> {
  const { width, height } = RESOLUTION_PRESETS[options.resolution];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  renderOverlayFrame(ctx, {
    width,
    height,
    option: options.option,
    coverImage: options.coverImage,
    tiltAngle: options.tiltAngle,
    currentSeconds: options.currentSeconds,
    totalSeconds: options.totalSeconds,
    bookMetadata: options.bookMetadata,
    activeSubtitle: options.activeSubtitle,
    subtitleSettings: options.subtitleSettings,
    showPlaybackButtons: options.showPlaybackButtons,
    isPlaying: false,
    isTransparent: options.isTransparent,
  });

  const mimeType = 'image/png';
  const dataUrl = canvas.toDataURL(mimeType, 1.0);
  const defaultName = `audiobook-${options.option}-${options.resolution}-${options.isTransparent ? 'transparent' : 'frame'}.png`;

  const link = document.createElement('a');
  link.download = options.filename || defaultName;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export interface VideoRecordProgress {
  recordedSeconds: number;
  targetSeconds: number;
  status: 'idle' | 'recording' | 'processing' | 'completed' | 'error';
  progressPercent: number;
  error?: string;
}

export class AudiobookVideoRecorder {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private animationId: number | null = null;
  private isRecording = false;
  private startTime = 0;
  private targetDuration = 0;
  private onProgressCb?: (prog: VideoRecordProgress) => void;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  public async startRecording(
    params: Omit<RenderFrameParams, 'width' | 'height'> & {
      resolution: ExportResolution;
      durationSeconds: number;
      fps?: number;
      onProgress?: (prog: VideoRecordProgress) => void;
      onComplete?: (videoBlob: Blob, filename: string) => void;
    }
  ): Promise<void> {
    if (this.isRecording) return;
    this.onProgressCb = params.onProgress;
    this.targetDuration = params.durationSeconds;

    const { width, height } = RESOLUTION_PRESETS[params.resolution];
    this.canvas.width = width;
    this.canvas.height = height;

    if (!this.ctx) {
      params.onProgress?.({
        recordedSeconds: 0,
        targetSeconds: this.targetDuration,
        status: 'error',
        progressPercent: 0,
        error: 'Unable to initialize 2D canvas context',
      });
      return;
    }

    const fps = params.fps || (params.resolution === '4k' ? 30 : 60);
    const videoStream = this.canvas.captureStream(fps);

    // Audio stream tracks from audioEngine
    const audioDest = audioEngine.getAudioStreamDestination();
    const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

    if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
      tracks.push(...audioDest.stream.getAudioTracks());
    }

    const combinedStream = new MediaStream(tracks);

    // Pick best supported MIME type
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/mp4';
        }
      }
    }

    const bitrate = params.resolution === '4k' ? 24000000 : params.resolution === '1440p' ? 14000000 : 8000000;

    try {
      this.recorder = new MediaRecorder(combinedStream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
        videoBitsPerSecond: bitrate,
      });
    } catch (e) {
      console.warn('Fallback MediaRecorder setup:', e);
      this.recorder = new MediaRecorder(combinedStream);
    }

    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };

    this.recorder.onstop = () => {
      this.isRecording = false;
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }

      this.onProgressCb?.({
        recordedSeconds: this.targetDuration,
        targetSeconds: this.targetDuration,
        status: 'processing',
        progressPercent: 100,
      });

      const finalBlob = new Blob(this.chunks, { type: this.recorder?.mimeType || 'video/webm' });
      const filename = `audiobook-${params.bookMetadata.title.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'overlay'}-${params.resolution}.webm`;

      // Auto download
      const url = URL.createObjectURL(finalBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.onProgressCb?.({
        recordedSeconds: this.targetDuration,
        targetSeconds: this.targetDuration,
        status: 'completed',
        progressPercent: 100,
      });

      if (params.onComplete) {
        params.onComplete(finalBlob, filename);
      }
    };

    this.isRecording = true;
    this.startTime = performance.now();
    this.recorder.start(500); // 500ms chunk slices

    // Start playback through audioEngine if not playing
    audioEngine.play(params.currentSeconds, 0.9, false);

    const renderLoop = (time: number) => {
      if (!this.isRecording || !this.ctx) return;

      const elapsed = (time - this.startTime) / 1000;
      const progressPercent = Math.min(100, (elapsed / this.targetDuration) * 100);

      this.onProgressCb?.({
        recordedSeconds: elapsed,
        targetSeconds: this.targetDuration,
        status: 'recording',
        progressPercent,
      });

      // Render current frame with updated playback time
      renderOverlayFrame(this.ctx, {
        width,
        height,
        option: params.option,
        coverImage: params.coverImage,
        tiltAngle: params.tiltAngle,
        currentSeconds: params.currentSeconds + elapsed,
        totalSeconds: params.totalSeconds,
        bookMetadata: params.bookMetadata,
        activeSubtitle: params.activeSubtitle,
        isPlaying: true,
        isTransparent: false,
      });

      if (elapsed >= this.targetDuration) {
        this.stopRecording();
        return;
      }

      this.animationId = requestAnimationFrame(renderLoop);
    };

    this.animationId = requestAnimationFrame(renderLoop);
  }

  public stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;
    audioEngine.pause();
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public isBusy(): boolean {
    return this.isRecording;
  }
}

export const videoRecorder = new AudiobookVideoRecorder();
