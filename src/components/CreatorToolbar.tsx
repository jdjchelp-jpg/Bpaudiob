import React, { useState, useRef } from 'react';
import { 
  Layers, 
  Download, 
  Upload, 
  EyeOff, 
  Sliders, 
  Sparkles, 
  Music, 
  Image as ImageIcon,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileText,
  BookOpen,
  Monitor,
  Play,
  Eye,
  Cloud
} from 'lucide-react';
import { BackgroundMode, OverlayOption, BookMetadata, SubtitleSettings, SubtitleFontSize, SubtitleStyle, SubtitlePosition } from '../types';
import { formatAudioTime, parseFormattedTime } from '../utils/timeFormat';

interface CreatorToolbarProps {
  option: OverlayOption;
  backgroundMode: BackgroundMode;
  tiltAngle: number;
  totalDurationSeconds: number;
  showAlignmentGuides: boolean;
  isCustomCover: boolean;
  customAudioName: string | null;
  cuesCount: number;
  showSubtitles: boolean;
  subtitleSettings: SubtitleSettings;
  showPlaybackButtons: boolean;
  bookMetadata: BookMetadata;
  isHidden: boolean;
  onSelectOption: (option: OverlayOption) => void;
  onSelectBackgroundMode: (mode: BackgroundMode) => void;
  onChangeTilt: (deg: number) => void;
  onChangeDuration: (seconds: number) => void;
  onToggleAlignmentGuides: () => void;
  onUploadCover: (file: File) => void;
  onResetCover: () => void;
  onUploadAudio: (file: File) => void;
  onClearAudio: () => void;
  onToggleSubtitles: () => void;
  onUpdateSubtitleSettings: (settings: SubtitleSettings) => void;
  onTogglePlaybackButtons: () => void;
  onOpenCaptionEditor: () => void;
  onOpenBookMetadataEditor: () => void;
  onOpenExportModal: () => void;
  onToggleHideToolbar: () => void;
}

export const CreatorToolbar: React.FC<CreatorToolbarProps> = ({
  option,
  backgroundMode,
  tiltAngle,
  totalDurationSeconds,
  showAlignmentGuides,
  isCustomCover,
  customAudioName,
  cuesCount,
  showSubtitles,
  subtitleSettings,
  showPlaybackButtons,
  bookMetadata,
  isHidden,
  onSelectOption,
  onSelectBackgroundMode,
  onChangeTilt,
  onChangeDuration,
  onToggleAlignmentGuides,
  onUploadCover,
  onResetCover,
  onUploadAudio,
  onClearAudio,
  onToggleSubtitles,
  onUpdateSubtitleSettings,
  onTogglePlaybackButtons,
  onOpenCaptionEditor,
  onOpenBookMetadataEditor,
  onOpenExportModal,
  onToggleHideToolbar,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [durationInput, setDurationInput] = useState(formatAudioTime(totalDurationSeconds));
  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleDurationBlur = () => {
    const parsed = parseFormattedTime(durationInput);
    if (parsed > 0) {
      onChangeDuration(parsed);
    } else {
      setDurationInput(formatAudioTime(totalDurationSeconds));
    }
  };

  if (isHidden) {
    return (
      <div className="fixed top-4 right-4 z-50 no-export">
        <button
          onClick={onToggleHideToolbar}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/75 hover:bg-black/90 backdrop-blur-md border border-white/20 text-white/90 hover:text-white text-xs shadow-xl transition-all font-medium"
          title="Show Template Controls (Press 'H')"
        >
          <Sliders className="w-3.5 h-3.5 text-purple-400" />
          <span>Show Controls</span>
        </button>
      </div>
    );
  }

  return (
    <header className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[96%] max-w-5xl no-export">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={coverInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onUploadCover(e.target.files[0])}
      />
      <input
        type="file"
        ref={audioInputRef}
        accept="audio/mp3,audio/wav,audio/m4a,audio/aac,audio/ogg,audio/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onUploadAudio(e.target.files[0])}
      />

      <div className="bg-[#0b0c13]/92 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.7)] p-2 sm:p-2.5 transition-all duration-300">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Main Option Switcher: Option A vs Option B */}
          <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => onSelectOption('option-a')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                option === 'option-a'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
              title="Option A: Complete UI Overlay (Background + Center Cover + UI Player Controls)"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Option A: Complete UI</span>
            </button>

            <button
              onClick={() => onSelectOption('option-b')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                option === 'option-b'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
              title="Option B: Clean UI Player Controls & Blank Center Frame for Video Editors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Option B: Blank Frame</span>
            </button>
          </div>

          {/* Center Tools: Audio, Captions, Book Info */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Audio File Button */}
            <button
              onClick={() => audioInputRef.current?.click()}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                customAudioName
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                  : 'bg-white/5 border-white/10 text-white/80 hover:text-white hover:bg-white/10'
              }`}
              title={customAudioName ? `Loaded: ${customAudioName}. Click to change.` : 'Upload MP3 / audio file'}
            >
              <Music className="w-3.5 h-3.5 text-emerald-400" />
              <span className="max-w-[110px] truncate">
                {customAudioName ? customAudioName : 'Add MP3'}
              </span>
            </button>

            {/* Captions (.srt / .vtt / .sbv) Button */}
            <button
              onClick={onOpenCaptionEditor}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                cuesCount > 0
                  ? 'bg-purple-950/40 border-purple-500/40 text-purple-200 hover:bg-purple-900/50'
                  : 'bg-white/5 border-white/10 text-white/80 hover:text-white hover:bg-white/10'
              }`}
              title="Upload & edit .srt, .vtt, .sbv subtitle files"
            >
              <FileText className="w-3.5 h-3.5 text-purple-400" />
              <span>Captions</span>
              {cuesCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-purple-500/30 text-[10px] font-mono-tabular">
                  {cuesCount}
                </span>
              )}
            </button>

            {/* Book Info Button */}
            <button
              onClick={onOpenBookMetadataEditor}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-medium transition-all"
              title="Set book title, author name, chapter"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span className="max-w-[120px] truncate">{bookMetadata.title || 'Book Info'}</span>
            </button>

            {/* Play Controls In Image Toggle */}
            <button
              onClick={onTogglePlaybackButtons}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                showPlaybackButtons
                  ? 'bg-white/5 border-white/10 text-white/80 hover:text-white hover:bg-white/10'
                  : 'bg-purple-950/40 border-purple-500/40 text-purple-200 hover:bg-purple-900/50'
              }`}
              title={
                showPlaybackButtons
                  ? "Toggle center play/pause & skip buttons (remove what's in image)"
                  : "Show center play/pause & skip buttons"
              }
            >
              {showPlaybackButtons ? (
                <Play className="w-3.5 h-3.5 text-purple-400 fill-purple-400/40" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="hidden sm:inline">
                {showPlaybackButtons ? 'Play Controls: Shown' : 'Play Controls: Hidden'}
              </span>
              <span className="sm:hidden">
                {showPlaybackButtons ? 'Play' : 'No Play'}
              </span>
            </button>
          </div>

          {/* Right Actions: 4K Export, Customize Drawer, Hide */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Cloud Export Hub Button */}
            <button
              onClick={onOpenExportModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white text-xs font-bold transition-all shadow-md active:scale-95"
              title="Cloud Export up to 4K UHD (Zero local device strain)"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Export to Cloud</span>
            </button>

            {/* Expand Settings Drawer */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs border border-white/10 flex items-center gap-1 transition-all"
              title="Configure Overlay Parameters"
            >
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {/* Clean Screen / Hide Toolbar Button */}
            <button
              onClick={onToggleHideToolbar}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-all"
              title="Hide Toolbar for Clean View (Press 'H')"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable Advanced Controls */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* Background Atmosphere */}
            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 font-medium">Background Atmosphere</label>
              <select
                value={backgroundMode}
                onChange={(e) => onSelectBackgroundMode(e.target.value as BackgroundMode)}
                className="bg-black/50 border border-white/15 rounded-xl px-2.5 py-1.5 text-white/90 focus:outline-none focus:border-purple-500 text-xs cursor-pointer"
              >
                <option value="ambient-glow">Atmospheric Ambient Glow</option>
                <option value="deep-gradient">Deep Minimalist Gradient</option>
                <option value="chroma-green">Chroma Key Green Screen</option>
                <option value="transparent-checker">Transparent Alpha Overlay</option>
              </select>
            </div>

            {/* Total Duration Setter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 font-medium">Duration (H:MM:SS)</label>
              <input
                type="text"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                onBlur={handleDurationBlur}
                onKeyDown={(e) => e.key === 'Enter' && handleDurationBlur()}
                className="bg-black/50 border border-white/15 rounded-xl px-2.5 py-1.5 font-mono-tabular text-white/90 focus:outline-none focus:border-purple-500 text-xs"
                placeholder="0:00:00"
              />
            </div>

            {/* Cover Tilt (for Option A) or Guides (for Option B) */}
            {option === 'option-a' ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-white/60 font-medium">
                  <span>Cover 3D Tilt</span>
                  <span className="font-mono-tabular text-white/80">{tiltAngle}°</span>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="0.5"
                  value={tiltAngle}
                  onChange={(e) => onChangeTilt(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-400"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 justify-center">
                <label className="text-white/60 font-medium">Crop Alignment Guides</label>
                <button
                  onClick={onToggleAlignmentGuides}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs transition-all ${
                    showAlignmentGuides
                      ? 'bg-purple-600/30 border-purple-500/50 text-purple-200'
                      : 'bg-black/50 border-white/15 text-white/60 hover:text-white'
                  }`}
                >
                  <span>1080×1080 Crop Marks</span>
                  {showAlignmentGuides && <Check className="w-3 h-3 text-purple-300" />}
                </button>
              </div>
            )}

            {/* Custom Cover Art Source */}
            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 font-medium">Book Cover Art</label>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-[11px]"
                  title="Upload your fantasy book cover artwork"
                >
                  <ImageIcon className="w-3 h-3 text-purple-400" />
                  <span>{isCustomCover ? 'Replace Art' : 'Upload Cover'}</span>
                </button>

                {isCustomCover && (
                  <button
                    onClick={onResetCover}
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white"
                    title="Reset to default fantasy dragon hero art"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Play Controls In Image Toggle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-white/60 font-medium">Center Play Controls (in image)</label>
              <button
                onClick={onTogglePlaybackButtons}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs transition-all ${
                  showPlaybackButtons
                    ? 'bg-purple-600/30 border-purple-500/50 text-purple-200'
                    : 'bg-black/50 border-white/15 text-white/60 hover:text-white'
                }`}
                title="Toggle Rewind 10s, circular Play/Pause, and Fast-Forward 30s buttons"
              >
                <span>Rewind, Play & Skip</span>
                <span className="font-semibold text-[11px] px-2 py-0.5 rounded-md bg-black/40">
                  {showPlaybackButtons ? 'Visible' : 'Hidden'}
                </span>
              </button>
            </div>

            {/* Row 2: Direct Caption Viewability & Pacing Controls */}
            <div className="sm:col-span-2 md:col-span-4 pt-2 mt-1 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white/80 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Captions Viewability:</span>
                </span>

                {/* Words Per Chunk Selector */}
                <div className="flex items-center bg-black/40 border border-white/10 p-0.5 rounded-lg text-[11px]">
                  {[
                    { val: 10, label: '10 Words' },
                    { val: 5, label: '5w' },
                    { val: 15, label: '15w' },
                    { val: 0, label: 'Full' },
                  ].map((w) => (
                    <button
                      key={w.val}
                      onClick={() => onUpdateSubtitleSettings({ ...subtitleSettings, wordsPerChunk: w.val })}
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        subtitleSettings.wordsPerChunk === w.val
                          ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>

                {/* Font Size Selector */}
                <div className="flex items-center bg-black/40 border border-white/10 p-0.5 rounded-lg text-[11px]">
                  {(['small', 'medium', 'large', 'xlarge'] as SubtitleFontSize[]).map((sz) => (
                    <button
                      key={sz}
                      onClick={() => onUpdateSubtitleSettings({ ...subtitleSettings, fontSize: sz })}
                      className={`px-2 py-0.5 rounded-md capitalize transition-all ${
                        subtitleSettings.fontSize === sz
                          ? 'bg-purple-600 text-white font-bold'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {sz === 'xlarge' ? 'XL' : sz}
                    </button>
                  ))}
                </div>

                {/* Contrast Style */}
                <select
                  value={subtitleSettings.style}
                  onChange={(e) => onUpdateSubtitleSettings({ ...subtitleSettings, style: e.target.value as SubtitleStyle })}
                  className="bg-black/50 border border-white/15 rounded-lg px-2 py-0.5 text-white/90 text-[11px] focus:outline-none focus:border-purple-500"
                >
                  <option value="cinematic-dark">Cinematic Glass</option>
                  <option value="high-contrast-yellow">High-Contrast Yellow</option>
                  <option value="solid-black">Solid Black 100%</option>
                  <option value="minimal-glow">Minimal Glow</option>
                </select>
              </div>

              {/* Position selector guaranteeing safe clearance above timeline */}
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-white/50">Position:</span>
                <button
                  onClick={() => onUpdateSubtitleSettings({
                    ...subtitleSettings,
                    position: subtitleSettings.position === 'above-timeline' ? 'lower-third' : 'above-timeline'
                  })}
                  className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white"
                >
                  {subtitleSettings.position === 'above-timeline' ? 'Above Slider (Safe)' : 'Lower-Third'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
