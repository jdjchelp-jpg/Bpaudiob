export type OverlayOption = 'option-a' | 'option-b';

export type BackgroundMode = 'ambient-glow' | 'deep-gradient' | 'chroma-green' | 'transparent-checker';

export type ExportResolution = '1080p' | '1440p' | '4k';

export interface BookMetadata {
  title: string;
  author: string;
  narrator: string;
  chapter: string;
  showTitle: boolean;
  showAuthor: boolean;
  showNarrator: boolean;
  showChapter: boolean;
  placement: 'below-cover' | 'top-header' | 'above-controls';
}

export type SubtitleFontSize = 'small' | 'medium' | 'large' | 'xlarge' | 'huge';
export type SubtitlePosition = 'above-timeline' | 'lower-third' | 'center';
export type SubtitleStyle = 'cinematic-dark' | 'high-contrast-yellow' | 'solid-black' | 'minimal-glow';

export interface SubtitleSettings {
  wordsPerChunk: number; // e.g. 10 words at a time (0 for full sentence)
  fontSize: SubtitleFontSize;
  position: SubtitlePosition;
  style: SubtitleStyle;
  highlightActiveWord: boolean;
}

export interface SubtitleCue {
  id: number;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
}

export interface OverlayConfig {
  option: OverlayOption;
  backgroundMode: BackgroundMode;
  tiltAngle: number;
  shadowSpread: number;
  borderRadius: number;
  ambientGlowStrength: number;
  showAlignmentGuides: boolean;
  customCoverUrl: string | null;
  totalDurationSeconds: number;
  bookMetadata: BookMetadata;
  subtitles: SubtitleCue[];
  showSubtitles: boolean;
  subtitleSettings: SubtitleSettings;
  showPlaybackButtons: boolean;
}

export interface PlayerControlsState {
  isPlaying: boolean;
  currentSeconds: number;
  durationSeconds: number;
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
}
