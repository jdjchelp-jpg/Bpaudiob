import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, Volume1, VolumeX, Maximize2, Minimize2, Eye, EyeOff } from 'lucide-react';
import { formatAudioTime } from '../utils/timeFormat';

interface AudioPlayerControlsProps {
  currentSeconds: number;
  totalSeconds: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  showPlaybackButtons?: boolean;
  onTogglePlaybackButtons?: () => void;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onRewind: (seconds: number) => void;
  onFastForward: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
}

export const AudioPlayerControls: React.FC<AudioPlayerControlsProps> = ({
  currentSeconds,
  totalSeconds,
  isPlaying,
  volume,
  isMuted,
  isFullscreen,
  showPlaybackButtons = true,
  onTogglePlaybackButtons,
  onPlayPause,
  onSeek,
  onRewind,
  onFastForward,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
}) => {
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const progressPercent = totalSeconds > 0 ? Math.min(100, Math.max(0, (currentSeconds / totalSeconds) * 100)) : 0;

  const calculateSecondsFromEvent = useCallback((e: MouseEvent | React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || totalSeconds <= 0) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    return ratio * totalSeconds;
  }, [totalSeconds]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    const newSeconds = calculateSecondsFromEvent(e);
    onSeek(newSeconds);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrubbing) {
        const newSeconds = calculateSecondsFromEvent(e);
        onSeek(newSeconds);
      }
    };

    const handleMouseUp = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
      }
    };

    if (isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, calculateSecondsFromEvent, onSeek]);

  const handleMouseMoveProgress = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(ratio);
  };

  const handleMouseLeaveProgress = () => {
    setHoverPosition(null);
  };

  return (
    <div 
      id="audiobook-player-controls" 
      className="w-full select-none px-6 sm:px-10 md:px-14 lg:px-20 pb-6 sm:pb-8 md:pb-10 pt-4 flex flex-col gap-3 sm:gap-4 transition-all duration-300"
    >
      {/* Horizontal Progress Timeline Bar */}
      <div className="flex items-center gap-4 sm:gap-6 w-full">
        {/* Elapsed Time Counter on the Left: strictly "0:00:00" format */}
        <span 
          id="audiobook-elapsed-time"
          className="font-mono-tabular text-xs sm:text-sm md:text-base font-medium text-white/90 tracking-wide tabular-nums drop-shadow-sm min-w-[64px] sm:min-w-[74px]"
        >
          {formatAudioTime(currentSeconds)}
        </span>

        {/* The Progress Bar */}
        <div 
          ref={progressBarRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMoveProgress}
          onMouseLeave={handleMouseLeaveProgress}
          className="relative flex-1 h-6 flex items-center cursor-pointer group"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={totalSeconds}
          aria-valuenow={currentSeconds}
          aria-label="Audiobook timeline scrub bar"
        >
          {/* Background Track: thin modern hairline */}
          <div className="w-full h-1 sm:h-[5px] bg-white/20 group-hover:bg-white/30 rounded-full transition-all duration-200 overflow-hidden relative">
            {/* Active Progress Fill: pure clean white / subtle violet glow */}
            <div 
              className="h-full bg-white transition-[width] duration-75 ease-out rounded-full shadow-[0_0_12px_rgba(255,255,255,0.7)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Hover Preview Tooltip */}
          {hoverPosition !== null && totalSeconds > 0 && (
            <div 
              className="absolute -top-8 -translate-x-1/2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-white/10 text-[11px] font-mono-tabular text-white/95 pointer-events-none shadow-lg z-20"
              style={{ left: `${hoverPosition * 100}%` }}
            >
              {formatAudioTime(hoverPosition * totalSeconds)}
            </div>
          )}

          {/* Scrub Knob / Thumb */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-white rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.6),0_0_8px_rgba(255,255,255,0.8)] scale-75 group-hover:scale-110 active:scale-125 transition-transform duration-150 pointer-events-none"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        {/* Total Duration on the Right */}
        <span 
          id="audiobook-total-duration"
          className="font-mono-tabular text-xs sm:text-sm md:text-base font-medium text-white/70 tracking-wide tabular-nums drop-shadow-sm min-w-[64px] sm:min-w-[74px] text-right"
        >
          {formatAudioTime(totalSeconds)}
        </span>
      </div>

      {/* Control Bar Layout: Controls horizontally centered, subtle volume/fullscreen on far right */}
      <div className="relative flex items-center justify-between w-full mt-1">
        {/* Left balance spacer matching right controls width */}
        <div className="min-w-[90px] sm:min-w-[130px] flex items-center justify-start">
          {!showPlaybackButtons && (
            <button
              onClick={onPlayPause}
              title={isPlaying ? "Pause playback" : "Start playback (or press Space)"}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-medium transition-all shadow-sm active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-white text-white" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
              )}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
          )}
        </div>

        {/* Middle: Minimalistic Playback Controls (Rewind 10s, Play/Pause, Fast Forward 30s) */}
        {showPlaybackButtons ? (
          <div className="flex items-center justify-center gap-6 sm:gap-8 mx-auto">
            {/* Rewind 10s */}
            <button
              id="btn-rewind-10s"
              onClick={() => onRewind(10)}
              title="Rewind 10 seconds"
              className="relative group p-2 text-white/75 hover:text-white transition-all duration-200 focus:outline-none rounded-full active:scale-95"
              aria-label="Rewind 10 seconds"
            >
              <div className="relative flex items-center justify-center">
                <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:-rotate-12 duration-200" />
                <span className="absolute text-[8px] sm:text-[9px] font-bold font-mono-tabular -bottom-0.5 text-white/90">
                  10
                </span>
              </div>
            </button>

            {/* Minimal Play / Pause Circular Button */}
            <button
              id="btn-play-pause"
              onClick={onPlayPause}
              title={isPlaying ? "Pause" : "Play"}
              className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_4px_24px_rgba(0,0,0,0.5),0_0_20px_rgba(255,255,255,0.25)] hover:shadow-[0_6px_32px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none"
              aria-label={isPlaying ? "Pause playback" : "Start playback"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 fill-black text-black transition-transform" />
              ) : (
                <Play className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 fill-black text-black ml-0.5 transition-transform" />
              )}
            </button>

            {/* Fast Forward 30s */}
            <button
              id="btn-fastforward-30s"
              onClick={() => onFastForward(30)}
              title="Fast forward 30 seconds"
              className="relative group p-2 text-white/75 hover:text-white transition-all duration-200 focus:outline-none rounded-full active:scale-95"
              aria-label="Fast forward 30 seconds"
            >
              <div className="relative flex items-center justify-center">
                <RotateCw className="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:rotate-12 duration-200" />
                <span className="absolute text-[8px] sm:text-[9px] font-bold font-mono-tabular -bottom-0.5 text-white/90">
                  30
                </span>
              </div>
            </button>
          </div>
        ) : (
          <div className="mx-auto text-[11px] text-white/40 tracking-wider font-mono uppercase select-none">
            Timeline Only • Press Space to Play/Pause
          </div>
        )}

        {/* Far Right: Subtle Volume and Fullscreen Icons + Toggle Play Controls */}
        <div className="flex items-center justify-end gap-2 sm:gap-3 min-w-[90px] sm:min-w-[130px]">
          {/* Toggle Play Controls Visibility */}
          {onTogglePlaybackButtons && (
            <button
              onClick={onTogglePlaybackButtons}
              className={`p-1.5 sm:p-2 rounded-full border transition-all ${
                showPlaybackButtons
                  ? 'text-white/60 hover:text-white hover:bg-white/10 border-transparent hover:border-white/15'
                  : 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30'
              }`}
              title={
                showPlaybackButtons
                  ? "Hide center play/pause & skip buttons (remove what's in image)"
                  : "Show center play/pause & skip buttons"
              }
              aria-label="Toggle playback buttons"
            >
              {showPlaybackButtons ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
          {/* Volume Control with hover slider */}
          <div 
            className="relative flex items-center"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              id="btn-volume-toggle"
              onClick={onToggleMute}
              className="p-2 text-white/70 hover:text-white transition-colors duration-200 focus:outline-none rounded-full"
              title={isMuted || volume === 0 ? "Unmute" : "Mute"}
              aria-label={isMuted || volume === 0 ? "Unmute audio" : "Mute audio"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>

            {/* Horizontal Mini Volume Slider */}
            <div 
              className={`overflow-hidden transition-all duration-200 flex items-center ${
                showVolumeSlider ? 'w-16 sm:w-20 opacity-100 ml-1' : 'w-0 opacity-0'
              }`}
            >
              <input
                id="input-volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
                aria-label="Volume slider"
              />
            </div>
          </div>

          {/* Fullscreen Toggle */}
          <button
            id="btn-fullscreen-toggle"
            onClick={onToggleFullscreen}
            className="p-2 text-white/70 hover:text-white transition-colors duration-200 focus:outline-none rounded-full"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen 16:9"}
            aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen 16:9"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
