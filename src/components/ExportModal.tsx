import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Video, 
  Image as ImageIcon, 
  X, 
  Sparkles, 
  Film, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Layers,
  Monitor,
  Cloud,
  CloudLightning,
  ShieldCheck,
  Play,
  RotateCcw,
  Copy,
  ExternalLink,
  Trash2,
  HardDrive
} from 'lucide-react';
import { BookMetadata, ExportResolution, OverlayOption, SubtitleCue, SubtitleSettings } from '../types';
import { 
  CloudExportJob, 
  startCloudVideoRender, 
  startCloudImageExport, 
  fetchCloudExports, 
  deleteCloudExport, 
  triggerCloudDownload,
  trackCloudJob 
} from '../utils/cloudExportEngine';
import { exportCrispPNG } from '../utils/export4kEngine';
import { formatAudioTime } from '../utils/timeFormat';

interface ExportModalProps {
  isOpen: boolean;
  option: OverlayOption;
  coverImage: HTMLImageElement | null;
  tiltAngle: number;
  currentSeconds: number;
  totalSeconds: number;
  bookMetadata: BookMetadata;
  activeSubtitle: string | null;
  subtitles?: SubtitleCue[];
  subtitleSettings: SubtitleSettings;
  showSubtitles?: boolean;
  showPlaybackButtons?: boolean;
  hasAudioFile: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  option,
  coverImage,
  tiltAngle,
  currentSeconds,
  totalSeconds,
  bookMetadata,
  activeSubtitle,
  subtitles = [],
  subtitleSettings,
  showSubtitles = true,
  showPlaybackButtons = true,
  hasAudioFile,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'video' | 'image' | 'history'>('video');
  const [resolution, setResolution] = useState<ExportResolution>('1080p');
  
  // Cloud Video State
  const [videoDurationChoice, setVideoDurationChoice] = useState<'15s' | '30s' | '1m' | '5m' | 'full'>('30s');
  const [isCloudRendering, setIsCloudRendering] = useState(false);
  const [cloudJob, setCloudJob] = useState<CloudExportJob | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Cloud Image State
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [imageSuccessMsg, setImageSuccessMsg] = useState<string | null>(null);

  // Cloud History
  const [historyJobs, setHistoryJobs] = useState<CloudExportJob[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Load Cloud History on open or tab change
  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, activeTab]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const items = await fetchCloudExports();
      setHistoryJobs(items);

      // If no active render is in state, check for in-progress job or restore latest video
      if (!isCloudRendering && !cloudJob) {
        const active = items.find((j) => j.type === 'video' && (j.status === 'rendering' || j.status === 'queued'));
        if (active) {
          setCloudJob(active);
          setIsCloudRendering(true);
          trackCloudJob(active.id, (job) => {
            setCloudJob(job);
          }).then((finished) => {
            setCloudJob(finished);
            setIsCloudRendering(false);
            if (finished.downloadUrl) setPreviewVideoUrl(finished.downloadUrl);
            loadHistory();
          }).catch((err) => {
            console.error('Job tracking error:', err);
            setIsCloudRendering(false);
          });
        } else {
          // If the most recent job was completed recently, offer it for immediate preview/download
          const latestCompleted = items.find((j) => j.type === 'video' && j.status === 'completed');
          if (latestCompleted && !previewVideoUrl) {
            setPreviewVideoUrl(latestCompleted.downloadUrl || null);
            setCloudJob(latestCompleted);
          }
        }
      }
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (!isOpen) return null;

  const getTargetDurationSeconds = (): number => {
    switch (videoDurationChoice) {
      case '15s': return 15;
      case '30s': return 30;
      case '1m': return 60;
      case '5m': return 300;
      case 'full': return totalSeconds > 0 ? totalSeconds : 60;
    }
  };

  // Start Cloud Video Render
  const handleStartCloudVideoRender = async () => {
    setIsCloudRendering(true);
    setCloudError(null);
    setPreviewVideoUrl(null);
    const duration = getTargetDurationSeconds();

    setCloudJob({
      id: 'init',
      type: 'video',
      status: 'queued',
      progress: 5,
      stage: 'Contacting Cloud Render Server...',
      resolution,
      durationSeconds: duration,
      fileName: `${bookMetadata.title || 'audiobook'}-${resolution}.mp4`,
      createdAt: Date.now(),
    });

    try {
      const finishedJob = await startCloudVideoRender({
        resolution,
        durationSeconds: duration,
        totalSeconds: totalSeconds || duration,
        option,
        coverImage,
        tiltAngle,
        bookMetadata,
        subtitles,
        subtitleSettings,
        showSubtitles,
        showPlaybackButtons,
        isTransparent: false,
        onProgress: (job) => {
          setCloudJob(job);
        },
      });

      setCloudJob(finishedJob);
      if (finishedJob.downloadUrl) {
        setPreviewVideoUrl(finishedJob.downloadUrl);
        // Automatically trigger cloud download safely
        triggerCloudDownload(finishedJob.downloadUrl, finishedJob.fileName);
      }
      loadHistory();
    } catch (err: any) {
      console.error('Cloud video render failed:', err);
      setCloudError(err.message || 'Cloud render failed. Please try again.');
      setCloudJob((prev) => prev ? { ...prev, status: 'error', error: err.message } : null);
    } finally {
      setIsCloudRendering(false);
    }
  };

  // Cloud Image Export
  const handleCloudImageExport = async (isTransparent: boolean) => {
    setIsExportingImage(true);
    setImageSuccessMsg(null);
    try {
      if (isTransparent) {
        // Direct transparent client PNG
        await exportCrispPNG({
          resolution,
          option,
          coverImage,
          tiltAngle,
          currentSeconds,
          totalSeconds,
          bookMetadata,
          activeSubtitle,
          subtitleSettings,
          showPlaybackButtons,
          isTransparent: true,
        });
        setImageSuccessMsg(`Downloaded transparent ${resolution.toUpperCase()} PNG overlay!`);
      } else {
        // Upload & save into Cloud Storage
        const job = await startCloudImageExport({
          resolution,
          option,
          coverImage,
          tiltAngle,
          currentSeconds,
          totalSeconds,
          bookMetadata,
          activeSubtitle,
          subtitleSettings,
          showPlaybackButtons,
          isTransparent: false,
        });
        if (job.downloadUrl) {
          triggerCloudDownload(job.downloadUrl, job.fileName);
          setImageSuccessMsg(`Saved to Cloud Storage & downloaded (${(job.fileSize ? (job.fileSize / 1024 / 1024).toFixed(2) : '1.5')} MB)!`);
        }
        loadHistory();
      }
    } catch (err: any) {
      console.error('Image export failed:', err);
      // Fallback to local save
      await exportCrispPNG({
        resolution,
        option,
        coverImage,
        tiltAngle,
        currentSeconds,
        totalSeconds,
        bookMetadata,
        activeSubtitle,
        subtitleSettings,
        showPlaybackButtons,
        isTransparent,
      });
      setImageSuccessMsg(`Downloaded ${resolution.toUpperCase()} PNG`);
    } finally {
      setIsExportingImage(false);
    }
  };

  const handleDeleteHistoryItem = async (jobId: string) => {
    await deleteCloudExport(jobId);
    setHistoryJobs((prev) => prev.filter((j) => j.id !== jobId));
  };

  const handleCopyLink = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md no-export animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0d0e17] border border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 p-0.5 shadow-lg">
              <div className="w-full h-full bg-[#0d0e17] rounded-[14px] flex items-center justify-center">
                <Cloud className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Cloud Export Studio</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Device Crash Protected
                </span>
              </div>
              <p className="text-xs text-white/60">
                Offloaded rendering in Google Cloud — 0% local CPU load, preventing device freezing
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety & Cloud Assurance Banner */}
        <div className="px-6 py-2.5 bg-gradient-to-r from-purple-950/40 via-emerald-950/30 to-black border-b border-white/10 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-300">
            <CloudLightning className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Cloud Server Rendering:</strong> Video encoding is executed remotely by high-speed FFmpeg servers.
            </span>
          </div>
          <span className="text-[11px] font-mono-tabular text-white/50 hidden sm:inline">
            Local RAM: Safe
          </span>
        </div>

        {/* Resolution Selection Bar */}
        <div className="px-6 py-3 bg-black/40 border-b border-white/10 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-white/60 font-medium flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-purple-400" />
            Target Resolution:
          </span>

          <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setResolution('1080p')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                resolution === '1080p'
                  ? 'bg-purple-600 text-white font-bold shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              1080p FHD (Fastest)
            </button>
            <button
              onClick={() => setResolution('1440p')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                resolution === '1440p'
                  ? 'bg-purple-600 text-white font-bold shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              1440p 2K
            </button>
            <button
              onClick={() => setResolution('4k')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                resolution === '4k'
                  ? 'bg-gradient-to-r from-purple-600 to-amber-600 text-white font-bold shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>4K UHD (3840×2160)</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-white/[0.01]">
          <button
            onClick={() => setActiveTab('video')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'video'
                ? 'border-purple-500 text-white bg-purple-500/10'
                : 'border-transparent text-white/60 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            <Video className="w-4 h-4 text-purple-400" />
            <span>Cloud Video (MP4)</span>
          </button>

          <button
            onClick={() => setActiveTab('image')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'image'
                ? 'border-purple-500 text-white bg-purple-500/10'
                : 'border-transparent text-white/60 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-amber-400" />
            <span>Cloud PNG Frames</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-purple-500 text-white bg-purple-500/10'
                : 'border-transparent text-white/60 hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <span>Cloud Storage ({historyJobs.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* TAB 1: CLOUD VIDEO */}
          {activeTab === 'video' && (
            <div className="space-y-4">
              {/* Active Cloud Render Progress Card */}
              {cloudJob && (cloudJob.status === 'rendering' || cloudJob.status === 'queued') ? (
                <div className="p-6 rounded-2xl bg-purple-950/30 border border-purple-500/40 text-center space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-center gap-2.5 text-sm font-bold text-purple-300">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                    </span>
                    <span>Rendering on Cloud Server ({resolution.toUpperCase()} MP4)</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-amber-400 transition-[width] duration-300 rounded-full"
                      style={{ width: `${Math.max(5, cloudJob.progress)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono-tabular text-white/70 px-1">
                    <span className="text-left font-medium text-white/90 truncate max-w-[280px]">
                      {cloudJob.stage}
                    </span>
                    <span className="font-bold text-amber-300">{cloudJob.progress}%</span>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-[11px] text-white/60 flex items-center justify-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Your device is idle while our cloud container encodes the video.</span>
                  </div>
                </div>
              ) : cloudJob?.status === 'completed' ? (
                /* Completed State Card */
                <div className="p-5 rounded-2xl bg-gradient-to-b from-emerald-950/40 to-black/50 border border-emerald-500/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span>Ready in Cloud Storage!</span>
                    </div>
                    {cloudJob.fileSize && (
                      <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/80 font-mono-tabular text-xs">
                        {(cloudJob.fileSize / 1024 / 1024).toFixed(2)} MB
                      </span>
                    )}
                  </div>

                  {/* Embedded Video Preview Player */}
                  {previewVideoUrl && (
                    <div className="rounded-xl overflow-hidden border border-white/10 bg-black aspect-video max-h-52 relative">
                      <video
                        src={previewVideoUrl}
                        controls
                        className="w-full h-full object-contain"
                        preload="metadata"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerCloudDownload(cloudJob.downloadUrl!, cloudJob.fileName)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg transition-all active:scale-[0.98]"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Cloud MP4 ({resolution.toUpperCase()})</span>
                    </button>

                    {cloudJob.downloadUrl && (
                      <button
                        onClick={() => handleCopyLink(cloudJob.downloadUrl!)}
                        className="px-3.5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/15 text-xs font-semibold transition-all flex items-center gap-1.5"
                        title="Copy direct cloud link"
                      >
                        <Copy className="w-4 h-4" />
                        <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setCloudJob(null);
                        setPreviewVideoUrl(null);
                      }}
                      className="px-3.5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-semibold transition-all"
                      title="Render new video"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Configuration & Trigger Panel */
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white/80">Video Length</span>
                      <span className="text-xs font-mono-tabular text-purple-300 font-bold">
                        {formatAudioTime(getTargetDurationSeconds())}
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-2 text-xs">
                      {(['15s', '30s', '1m', '5m', 'full'] as const).map((choice) => (
                        <button
                          key={choice}
                          onClick={() => setVideoDurationChoice(choice)}
                          className={`py-2 rounded-xl border text-center transition-all ${
                            videoDurationChoice === choice
                              ? 'bg-purple-600 border-purple-500 text-white font-bold shadow-sm'
                              : 'bg-black/30 border-white/10 text-white/70 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {choice === 'full' ? 'Full Track' : choice}
                        </button>
                      ))}
                    </div>

                    <div className="text-xs text-white/50 leading-relaxed pt-1">
                      {hasAudioFile ? (
                        <span className="text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Custom audiobook MP3 audio ready for cloud sync.
                        </span>
                      ) : (
                        <span className="text-amber-300/80 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Atmospheric ambient audio soundtrack included automatically.
                        </span>
                      )}
                    </div>
                  </div>

                  {cloudError && (
                    <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{cloudError}</span>
                    </div>
                  )}

                  <button
                    disabled={isCloudRendering}
                    onClick={handleStartCloudVideoRender}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white text-sm font-bold shadow-lg shadow-purple-900/30 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <Cloud className="w-4 h-4" />
                    <span>Render & Export {resolution.toUpperCase()} in Cloud</span>
                  </button>

                  <p className="text-center text-[11px] text-white/40">
                    Outputs standard broadcast H.264 / AAC MP4 ready for YouTube, TikTok, or video editors.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CLOUD PNG FRAMES */}
          {activeTab === 'image' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Full Frame PNG via Cloud Storage */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-purple-500/50 transition-all flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center mb-3">
                      <Cloud className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">
                      Save Full {resolution.toUpperCase()} to Cloud
                    </h3>
                    <p className="text-xs text-white/60 leading-relaxed mb-4">
                      Complete 16:9 video frame saved securely in cloud storage with permanent download URL.
                    </p>
                  </div>

                  <button
                    disabled={isExportingImage}
                    onClick={() => handleCloudImageExport(false)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>Save & Download {resolution.toUpperCase()}</span>
                  </button>
                </div>

                {/* Transparent Alpha Overlay PNG */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-amber-500/50 transition-all flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center mb-3">
                      <Layers className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-white mb-1">
                      Transparent Alpha Overlay
                    </h3>
                    <p className="text-xs text-white/60 leading-relaxed mb-4">
                      Transparent background for seamless drag-and-drop into Premiere, DaVinci, or Final Cut.
                    </p>
                  </div>

                  <button
                    disabled={isExportingImage}
                    onClick={() => handleCloudImageExport(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <Download className="w-4 h-4 text-amber-300" />
                    <span>Download Transparent PNG</span>
                  </button>
                </div>
              </div>

              {imageSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{imageSuccessMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLOUD STORAGE HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-white/60 pb-1">
                <span>Stored Cloud Exports ({historyJobs.length})</span>
                <button
                  onClick={loadHistory}
                  className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-semibold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              {isLoadingHistory ? (
                <div className="py-12 text-center text-xs text-white/40">Loading cloud storage...</div>
              ) : historyJobs.length === 0 ? (
                <div className="py-12 text-center text-xs text-white/40 space-y-2">
                  <Cloud className="w-8 h-8 text-white/20 mx-auto" />
                  <p>No cloud exports yet.</p>
                  <p className="text-[11px] text-white/30">
                    Render a video or save a frame to access it anytime here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {historyJobs.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3 hover:border-white/20 transition-all text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-300 flex items-center justify-center shrink-0">
                          {item.type === 'video' ? (
                            <Video className="w-4 h-4" />
                          ) : (
                            <ImageIcon className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate max-w-[220px]">
                            {item.fileName}
                          </p>
                          <p className="text-[11px] text-white/50 font-mono-tabular">
                            {item.resolution.toUpperCase()} • {item.status === 'completed' && item.fileSize ? `${(item.fileSize / 1024 / 1024).toFixed(2)} MB` : item.status === 'completed' ? 'Completed' : item.stage || 'Rendering in cloud...'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.status === 'completed' && item.downloadUrl ? (
                          <>
                            <button
                              onClick={() => triggerCloudDownload(item.downloadUrl!, item.fileName)}
                              className="p-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-all"
                              title="Download completed file"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleCopyLink(item.downloadUrl!)}
                              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all"
                              title="Copy link"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : item.status === 'rendering' || item.status === 'queued' ? (
                          <span className="px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-300 text-[11px] font-semibold animate-pulse">
                            Encoding {item.progress}%
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-500/30 text-red-300 text-[11px] font-medium">
                            Failed
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteHistoryItem(item.id)}
                          className="p-2 rounded-lg bg-red-600/10 hover:bg-red-600/30 text-red-400 hover:text-red-300 transition-all"
                          title="Delete from cloud"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
