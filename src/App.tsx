import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DEFAULT_FANTASY_COVER } from './assets/coverArtwork';
import { AmbientBackground } from './components/AmbientBackground';
import { CenterBookFrame } from './components/CenterBookFrame';
import { AudioPlayerControls } from './components/AudioPlayerControls';
import { CreatorToolbar } from './components/CreatorToolbar';
import { SubtitleDisplay } from './components/SubtitleDisplay';
import { BookMetadataDisplay } from './components/BookMetadataDisplay';
import { CaptionEditorModal } from './components/CaptionEditorModal';
import { BookMetadataModal } from './components/BookMetadataModal';
import { ExportModal } from './components/ExportModal';
import { BackgroundMode, BookMetadata, OverlayOption, SubtitleCue, SubtitleSettings } from './types';
import { audioEngine } from './utils/audioEngine';
import { SAMPLE_AUDIOBOOK_CUES } from './utils/subtitleParser';
import { getActiveSubtitleChunk, rebatchCuesToWordCount } from './utils/chunkSubtitles';

export default function App() {
  // Overlay Mode: Option A (Complete UI with cover & ambient glow) or Option B (Blank frame for video editors)
  const [option, setOption] = useState<OverlayOption>('option-a');
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('ambient-glow');
  const [coverImageUrl, setCoverImageUrl] = useState<string>(DEFAULT_FANTASY_COVER);
  const [isCustomCover, setIsCustomCover] = useState(false);
  const [tiltAngle, setTiltAngle] = useState<number>(-2.5);
  const [showAlignmentGuides, setShowAlignmentGuides] = useState<boolean>(true);
  const [isToolbarHidden, setIsToolbarHidden] = useState<boolean>(false);

  // Book Information Metadata
  const [bookMetadata, setBookMetadata] = useState<BookMetadata>({
    title: 'The Dragon of Storms',
    author: 'by E. R. Sterling',
    narrator: 'Narrated by Michael Kramer',
    chapter: 'Chapter 1: The Waking Ember',
    showTitle: true,
    showAuthor: true,
    showNarrator: false,
    showChapter: true,
    placement: 'below-cover',
  });

  // Subtitles / Captions (.srt, .vtt, .sbv) & 10-Word Pacing Settings
  const [subtitles, setSubtitles] = useState<SubtitleCue[]>(SAMPLE_AUDIOBOOK_CUES);
  const [showSubtitles, setShowSubtitles] = useState<boolean>(true);
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>({
    wordsPerChunk: 10,
    fontSize: 'large',
    position: 'above-timeline',
    style: 'cinematic-dark',
    highlightActiveWord: true,
  });

  // Toggle for player controls directly in the image / export
  const [showPlaybackButtons, setShowPlaybackButtons] = useState<boolean>(true);

  // Audio state
  const [customAudioName, setCustomAudioName] = useState<string | null>(null);

  // Player State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentSeconds, setCurrentSeconds] = useState<number>(0);
  const [totalSeconds, setTotalSeconds] = useState<number>(31345); // 08:42:25 (classic full audiobook length)
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Modal states
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isCaptionModalOpen, setIsCaptionModalOpen] = useState<boolean>(false);
  const [isBookModalOpen, setIsBookModalOpen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const coverImageElementRef = useRef<HTMLImageElement | null>(null);

  // Cache Image element for offscreen 4K canvas exports
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = coverImageUrl;
    img.onload = () => {
      coverImageElementRef.current = img;
    };
  }, [coverImageUrl]);

  // Dynamically rebatch cues into continuous 10-word slides (or chosen wordsPerChunk).
  // This guarantees that even if a user uploads a word-level SRT (1 word per cue like Whisper/TikTok),
  // short phrases, or long unpartitioned text, exactly 10 words are grouped and displayed on screen!
  const effectiveSubtitles = useMemo(() => {
    if (!subtitles || subtitles.length === 0) return [];
    if (subtitleSettings.wordsPerChunk <= 0) return subtitles;
    return rebatchCuesToWordCount(subtitles, subtitleSettings.wordsPerChunk);
  }, [subtitles, subtitleSettings.wordsPerChunk]);

  // Current active subtitle cue & 10-word chunk computation with seamless gap bridging
  const activeCue = useMemo(() => {
    if (!effectiveSubtitles || effectiveSubtitles.length === 0) return null;

    // 1. Direct interval hit
    const exact = effectiveSubtitles.find((c) => currentSeconds >= c.start && currentSeconds <= c.end);
    if (exact) return exact;

    // 2. Natural bridging: if within 0.8s gap after cue ended, keep cue visible for reading comfort
    const bridged = effectiveSubtitles.find(
      (c) => currentSeconds > c.end && currentSeconds <= c.end + 0.8
    );
    if (bridged) return bridged;

    // 3. Demo loop support: if user has a sample transcript shorter than duration, cycle time
    const lastCue = effectiveSubtitles[effectiveSubtitles.length - 1];
    if (lastCue && currentSeconds > lastCue.end && lastCue.end > 0) {
      const loopedTime = currentSeconds % lastCue.end;
      const loopedMatch = effectiveSubtitles.find((c) => loopedTime >= c.start && loopedTime <= c.end);
      if (loopedMatch) return loopedMatch;
    }

    return null;
  }, [effectiveSubtitles, currentSeconds]);

  const activeChunk = useMemo(() => {
    return getActiveSubtitleChunk(activeCue, currentSeconds, subtitleSettings.wordsPerChunk);
  }, [activeCue, currentSeconds, subtitleSettings.wordsPerChunk]);

  const activeSubtitleText = activeChunk ? activeChunk.chunkText : null;

  // Handle Play / Pause
  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (next) {
        audioEngine.play(currentSeconds, volume, isMuted);
      } else {
        audioEngine.pause();
      }
      return next;
    });
  }, [currentSeconds, volume, isMuted]);

  // Handle Seeking
  const handleSeek = useCallback((seconds: number) => {
    const clamped = Math.max(0, Math.min(totalSeconds, seconds));
    setCurrentSeconds(clamped);
    audioEngine.seek(clamped);
  }, [totalSeconds]);

  // Handle Rewind 10s
  const handleRewind = useCallback((seconds: number = 10) => {
    setCurrentSeconds((prev) => {
      const target = Math.max(0, prev - seconds);
      audioEngine.seek(target);
      return target;
    });
  }, []);

  // Handle Fast Forward 30s
  const handleFastForward = useCallback((seconds: number = 30) => {
    setCurrentSeconds((prev) => {
      const target = Math.min(totalSeconds, prev + seconds);
      audioEngine.seek(target);
      return target;
    });
  }, [totalSeconds]);

  // Handle Volume Change
  const handleVolumeChange = useCallback((newVol: number) => {
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
    }
    audioEngine.setVolume(newVol, false);
  }, [isMuted]);

  // Handle Toggle Mute
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      audioEngine.setVolume(volume, next);
      return next;
    });
  }, [volume]);

  // Fullscreen Management
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Playback timer tick
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    lastTimeRef.current = performance.now();

    const tick = (time: number) => {
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      setCurrentSeconds((prev) => {
        // If custom audio is playing, synchronize to its exact currentTime
        const customEl = audioEngine.getAudioElement();
        if (customEl && !customEl.paused && !isNaN(customEl.currentTime)) {
          return customEl.currentTime;
        }

        if (prev >= totalSeconds) {
          setIsPlaying(false);
          audioEngine.pause();
          return totalSeconds;
        }
        return prev + delta;
      });

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, totalSeconds]);

  // Custom Cover Art Upload
  const handleUploadCover = (file: File) => {
    const url = URL.createObjectURL(file);
    setCoverImageUrl(url);
    setIsCustomCover(true);
  };

  const handleResetCover = () => {
    setCoverImageUrl(DEFAULT_FANTASY_COVER);
    setIsCustomCover(false);
  };

  // Custom Audio Upload (MP3, WAV, AAC, etc.)
  const handleUploadAudio = (file: File) => {
    const audioUrl = URL.createObjectURL(file);
    setCustomAudioName(file.name);
    
    const audioEl = audioEngine.setCustomAudio(audioUrl, () => {
      setIsPlaying(false);
    });

    audioEl.onloadedmetadata = () => {
      if (audioEl.duration && !isNaN(audioEl.duration)) {
        setTotalSeconds(Math.floor(audioEl.duration));
      }
    };

    setCurrentSeconds(0);
    setIsPlaying(true);
    audioEngine.play(0, volume, isMuted);
  };

  const handleClearAudio = () => {
    audioEngine.clearCustomAudio();
    setCustomAudioName(null);
    setIsPlaying(false);
  };

  // Keyboard Shortcuts for video creators & power users
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleRewind(10);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleFastForward(30);
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
      } else if (e.key === 'f' || e.key === 'F') {
        handleToggleFullscreen();
      } else if (e.key === 'h' || e.key === 'H') {
        setIsToolbarHidden((prev) => !prev);
      } else if (e.key === 'c' || e.key === 'C') {
        setShowSubtitles((prev) => !prev);
      } else if (e.key === 'p' || e.key === 'P') {
        setShowPlaybackButtons((prev) => !prev);
      } else if (e.key === '1') {
        setOption('option-a');
      } else if (e.key === '2') {
        setOption('option-b');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handleRewind, handleFastForward, handleToggleMute, handleToggleFullscreen]);

  return (
    <div className="relative w-full h-screen bg-[#020204] text-white flex items-center justify-center overflow-hidden font-sans select-none">
      {/* Top Floating Creator Toolbar */}
      <CreatorToolbar
        option={option}
        backgroundMode={backgroundMode}
        tiltAngle={tiltAngle}
        totalDurationSeconds={totalSeconds}
        showAlignmentGuides={showAlignmentGuides}
        isCustomCover={isCustomCover}
        customAudioName={customAudioName}
        cuesCount={subtitles.length}
        showSubtitles={showSubtitles}
        subtitleSettings={subtitleSettings}
        showPlaybackButtons={showPlaybackButtons}
        bookMetadata={bookMetadata}
        isHidden={isToolbarHidden}
        onSelectOption={(opt) => {
          setOption(opt);
          if (opt === 'option-b' && backgroundMode === 'ambient-glow') {
            setBackgroundMode('deep-gradient');
          } else if (opt === 'option-a' && backgroundMode === 'deep-gradient') {
            setBackgroundMode('ambient-glow');
          }
        }}
        onSelectBackgroundMode={setBackgroundMode}
        onChangeTilt={setTiltAngle}
        onChangeDuration={setTotalSeconds}
        onToggleAlignmentGuides={() => setShowAlignmentGuides((prev) => !prev)}
        onUploadCover={handleUploadCover}
        onResetCover={handleResetCover}
        onUploadAudio={handleUploadAudio}
        onClearAudio={handleClearAudio}
        onToggleSubtitles={() => setShowSubtitles((prev) => !prev)}
        onUpdateSubtitleSettings={setSubtitleSettings}
        onTogglePlaybackButtons={() => setShowPlaybackButtons((prev) => !prev)}
        onOpenCaptionEditor={() => setIsCaptionModalOpen(true)}
        onOpenBookMetadataEditor={() => setIsBookModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onToggleHideToolbar={() => setIsToolbarHidden((prev) => !prev)}
      />

      {/* 
        The 16:9 YouTube Audiobook Video Player Overlay Canvas (1920x1080 native proportion)
        Scales fluidly to fit any screen resolution while preserving exact 16:9 aspect ratio.
      */}
      <main 
        id="audiobook-16-9-viewport"
        ref={containerRef}
        className="relative w-full max-w-[100vw] aspect-video max-h-[100vh] flex flex-col justify-between overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.9)] bg-[#050609]"
      >
        {/* Background Layer: Atmospheric Ambient Glow or Deep Gradient Blur */}
        <AmbientBackground
          option={option}
          backgroundMode={backgroundMode}
          coverImageUrl={coverImageUrl}
        />

        {/* Top Header Book Info (if configured for top-header placement) */}
        <BookMetadataDisplay
          metadata={bookMetadata}
          position="top-header"
          onEditClick={() => setIsBookModalOpen(true)}
        />

        {/* Center Frame: Book Cover + Below-Cover Metadata */}
        <CenterBookFrame
          option={option}
          coverImageUrl={coverImageUrl}
          tiltAngle={tiltAngle}
          showAlignmentGuides={showAlignmentGuides}
          metadata={bookMetadata}
          onUploadCover={handleUploadCover}
          onEditMetadata={() => setIsBookModalOpen(true)}
        />

        {/* Real-time Subtitles / Captions Display (Paced at 10 words, safe clearance above timeline) */}
        <SubtitleDisplay
          chunk={activeChunk}
          settings={subtitleSettings}
          isVisible={showSubtitles}
          onOpenSettings={() => setIsCaptionModalOpen(true)}
        />

        {/* Book Metadata if placement is above-controls */}
        <BookMetadataDisplay
          metadata={bookMetadata}
          position="above-controls"
          onEditClick={() => setIsBookModalOpen(true)}
        />

        {/* Clean Modern Media Player UI Controls at the bottom */}
        <div className="relative z-20 w-full bg-gradient-to-t from-black/85 via-black/45 to-transparent pt-4 sm:pt-6">
          <AudioPlayerControls
            currentSeconds={currentSeconds}
            totalSeconds={totalSeconds}
            isPlaying={isPlaying}
            volume={volume}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            showPlaybackButtons={showPlaybackButtons}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onRewind={handleRewind}
            onFastForward={handleFastForward}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
            onToggleFullscreen={handleToggleFullscreen}
            onTogglePlaybackButtons={() => setShowPlaybackButtons((prev) => !prev)}
          />
        </div>
      </main>

      {/* Subtitles / Captions (.srt, .vtt, .sbv) Modal with 10-Word Pacing & Appearance Tools */}
      <CaptionEditorModal
        isOpen={isCaptionModalOpen}
        cues={subtitles}
        currentSeconds={currentSeconds}
        settings={subtitleSettings}
        onClose={() => setIsCaptionModalOpen(false)}
        onUpdateCues={setSubtitles}
        onUpdateSettings={setSubtitleSettings}
        onSeekTo={handleSeek}
      />

      {/* Book Metadata Customizer Modal */}
      <BookMetadataModal
        isOpen={isBookModalOpen}
        metadata={bookMetadata}
        onClose={() => setIsBookModalOpen(false)}
        onUpdate={setBookMetadata}
      />

      {/* Cloud Export Modal (Cloud Video Render & PNG frames with 0% device load) */}
      <ExportModal
        isOpen={isExportModalOpen}
        option={option}
        coverImage={coverImageElementRef.current}
        tiltAngle={tiltAngle}
        currentSeconds={currentSeconds}
        totalSeconds={totalSeconds}
        bookMetadata={bookMetadata}
        activeSubtitle={activeSubtitleText}
        subtitles={effectiveSubtitles}
        subtitleSettings={subtitleSettings}
        showSubtitles={showSubtitles}
        showPlaybackButtons={showPlaybackButtons}
        hasAudioFile={!!customAudioName}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
}
