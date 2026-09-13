import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  Play, 
  Sparkles, 
  X, 
  Search,
  Check,
  Scissors,
  Eye,
  Sliders,
  Type,
  Maximize2
} from 'lucide-react';
import { SubtitleCue, SubtitleSettings, SubtitleFontSize, SubtitlePosition, SubtitleStyle } from '../types';
import { formatAudioTime } from '../utils/timeFormat';
import { cuesToSRT, parseCaptionFile, SAMPLE_AUDIOBOOK_CUES, splitCuesByWordLimit, rebatchCuesToWordCount, convertPlainTextTo10WordCues } from '../utils/subtitleParser';

interface CaptionEditorModalProps {
  isOpen: boolean;
  cues: SubtitleCue[];
  currentSeconds: number;
  settings: SubtitleSettings;
  onClose: () => void;
  onUpdateCues: (newCues: SubtitleCue[]) => void;
  onUpdateSettings: (newSettings: SubtitleSettings) => void;
  onSeekTo: (seconds: number) => void;
}

export const CaptionEditorModal: React.FC<CaptionEditorModalProps> = ({
  isOpen,
  cues,
  currentSeconds,
  settings,
  onClose,
  onUpdateCues,
  onUpdateSettings,
  onSeekTo,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'viewability' | 'raw'>('list');
  const [rawText, setRawText] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const parsed = parseCaptionFile(content, file.name);
        if (parsed.length > 0) {
          // Check if the uploaded cues are word-level (average word count < 6)
          const totalWords = parsed.reduce((sum, c) => sum + c.text.trim().split(/\s+/).filter(Boolean).length, 0);
          const avgWords = totalWords / parsed.length;
          
          let finalCues = parsed;
          if (avgWords < 6 && (settings.wordsPerChunk === 15 || settings.wordsPerChunk > 0)) {
            finalCues = rebatchCuesToWordCount(parsed, settings.wordsPerChunk || 15);
            showToast(`Auto-grouped ${parsed.length} word-by-word cues into ${finalCues.length} clean 15-word slides!`);
          } else {
            showToast(`Imported ${parsed.length} caption cues from ${file.name}`);
          }
          onUpdateCues(finalCues);
          setRawText(cuesToSRT(finalCues));
        }
      }
    };
    reader.readAsText(file);
  };

  const handleApplyRaw = () => {
    const parsed = parseCaptionFile(rawText);
    if (parsed.length > 0) {
      const totalWords = parsed.reduce((sum, c) => sum + c.text.trim().split(/\s+/).filter(Boolean).length, 0);
      const avgWords = totalWords / parsed.length;
      let finalCues = parsed;
      if (avgWords < 6 && (settings.wordsPerChunk === 10 || settings.wordsPerChunk > 0)) {
        finalCues = rebatchCuesToWordCount(parsed, settings.wordsPerChunk || 10);
        showToast(`Auto-grouped into ${finalCues.length} 10-word slides!`);
      } else {
        showToast(`Applied ${parsed.length} cues`);
      }
      onUpdateCues(finalCues);
      setActiveTab('list');
    }
  };

  const handleSplitAllTo10Words = (targetWords: number = 10) => {
    const rebatched = rebatchCuesToWordCount(cues, targetWords);
    onUpdateCues(rebatched);
    setRawText(cuesToSRT(rebatched));
    showToast(`Paced all captions into ${rebatched.length} slides (${targetWords} words per slide)!`);
  };

  const handleSplitSingleCue = (id: number) => {
    const targetCue = cues.find(c => c.id === id);
    if (!targetCue) return;
    const split = rebatchCuesToWordCount([targetCue], 10);
    if (split.length <= 1) return;

    const targetIndex = cues.findIndex(c => c.id === id);
    const newCues = [...cues.slice(0, targetIndex), ...split, ...cues.slice(targetIndex + 1)];
    onUpdateCues(newCues);
    showToast(`Split into ${split.length} 10-word slides`);
  };

  const handleAddCue = () => {
    const lastCue = cues[cues.length - 1];
    const newStart = lastCue ? Math.ceil(lastCue.end + 0.5) : Math.floor(currentSeconds);
    const newEnd = newStart + 4;
    const newCue: SubtitleCue = {
      id: Date.now(),
      start: newStart,
      end: newEnd,
      text: 'New narration sentence with ten words paced for high viewability.',
    };
    onUpdateCues([...cues, newCue]);
  };

  const handleDeleteCue = (id: number) => {
    onUpdateCues(cues.filter((c) => c.id !== id));
  };

  const handleUpdateCueText = (id: number, text: string) => {
    onUpdateCues(cues.map((c) => (c.id === id ? { ...c, text } : c)));
  };

  const handleUpdateCueStart = (id: number, start: number) => {
    onUpdateCues(cues.map((c) => (c.id === id ? { ...c, start } : c)));
  };

  const handleUpdateCueEnd = (id: number, end: number) => {
    onUpdateCues(cues.map((c) => (c.id === id ? { ...c, end } : c)));
  };

  const handleDownloadSRT = () => {
    const srtContent = cuesToSRT(cues);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'audiobook-subtitles-10words.srt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredCues = cues.filter((c) =>
    c.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md no-export animate-in fade-in duration-200">
      <input
        type="file"
        ref={fileInputRef}
        accept=".srt,.vtt,.sbv,.txt"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
      />

      <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#0d0e17] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">Audiobook Captions & Viewability</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] text-amber-300 font-semibold">
                  10 Words Pacing
                </span>
              </div>
              <p className="text-xs text-white/60">
                Supports .srt, .vtt, .sbv, auto 10-word pacing, and high-contrast styling
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notification */}
        {notification && (
          <div className="bg-purple-600 text-white text-xs px-6 py-2 flex items-center gap-2 font-medium animate-in fade-in slide-in-from-top-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{notification}</span>
          </div>
        )}

        {/* Action Bar */}
        <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap bg-white/[0.01]">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10 text-xs">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeTab === 'list' ? 'bg-purple-600 text-white font-medium' : 'text-white/70 hover:text-white'
              }`}
            >
              Cues List ({cues.length})
            </button>
            <button
              onClick={() => setActiveTab('viewability')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                activeTab === 'viewability' ? 'bg-purple-600 text-white font-medium' : 'text-white/70 hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3 text-amber-400" />
              <span>Appearance & Viewability</span>
            </button>
            <button
              onClick={() => {
                setRawText(cuesToSRT(cues));
                setActiveTab('raw');
              }}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeTab === 'raw' ? 'bg-purple-600 text-white font-medium' : 'text-white/70 hover:text-white'
              }`}
            >
              Raw SRT / Paste
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Format All to 10 Words Button */}
            <button
              onClick={() => handleSplitAllTo10Words(10)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/25 to-purple-500/25 hover:from-amber-500/35 hover:to-purple-500/35 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Consolidate or partition all cues into clean 10-word slides for high viewing comfort"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Format All to 10 Words</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-all shadow-sm"
              title="Upload .srt, .vtt, or .sbv file"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File</span>
            </button>

            <button
              onClick={() => {
                onUpdateCues(SAMPLE_AUDIOBOOK_CUES);
                showToast('Loaded sample 10-word fantasy chapter cues');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/90 text-xs font-medium border border-white/10 transition-all"
              title="Load sample chapter dialogue"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Load Sample</span>
            </button>

            {cues.length > 0 && (
              <button
                onClick={handleDownloadSRT}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 text-xs border border-white/10 transition-all"
                title="Download updated .srt file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export SRT</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[55vh]">
          {/* TAB 1: APPEARANCE & VIEWABILITY */}
          {activeTab === 'viewability' && (
            <div className="space-y-6 text-xs">
              {/* Live Preview Box */}
              <div className="p-5 rounded-2xl bg-black/60 border border-white/10 flex flex-col items-center justify-center min-h-[130px] relative overflow-hidden">
                <div className="text-[11px] uppercase tracking-wider text-white/40 mb-3 font-semibold">
                  Live Viewability Preview (Never overlaps player timeline)
                </div>
                
                {/* Render styled sample box */}
                <div 
                  className={`px-6 py-3.5 rounded-2xl max-w-xl text-center transition-all ${
                    settings.style === 'high-contrast-yellow'
                      ? 'bg-[#08090d] border-2 border-amber-400/90 shadow-2xl text-amber-200'
                      : settings.style === 'solid-black'
                      ? 'bg-black border border-white/30 shadow-2xl text-white'
                      : settings.style === 'minimal-glow'
                      ? 'bg-black/60 border border-white/15 text-white'
                      : 'bg-black/90 backdrop-blur-md border border-white/20 shadow-2xl text-white'
                  }`}
                >
                  <p className={`font-semibold tracking-wide flex flex-wrap items-center justify-center gap-2 ${
                    settings.fontSize === 'small' ? 'text-sm' :
                    settings.fontSize === 'medium' ? 'text-base' :
                    settings.fontSize === 'large' ? 'text-lg' :
                    settings.fontSize === 'xlarge' ? 'text-xl font-bold' :
                    'text-2xl font-black'
                  }`}>
                    {['Deep', 'beneath', 'the', 'obsidian', 'crags,', 'the', 'air', 'smelled', 'of', 'lightning.'].map((word, i) => (
                      <span
                        key={i}
                        className={
                          settings.highlightActiveWord && i === 3
                            ? settings.style === 'high-contrast-yellow'
                              ? 'text-white font-black scale-105 underline decoration-amber-400 decoration-2 underline-offset-4'
                              : 'text-amber-300 font-bold scale-105 drop-shadow-[0_0_12px_rgba(252,211,77,0.9)]'
                            : ''
                        }
                      >
                        {word}
                      </span>
                    ))}
                  </p>
                </div>
              </div>

              {/* Setting Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Words per Screen */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <label className="font-semibold text-white/90 block flex items-center justify-between">
                    <span>Words at a Time</span>
                    <span className="text-purple-400 font-mono-tabular">
                      {settings.wordsPerChunk === 0 ? 'Full sentence' : `${settings.wordsPerChunk} words`}
                    </span>
                  </label>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Controls pacing on screen. Audiobooks are easiest to follow at 10 words per slide.
                  </p>
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {[
                      { val: 10, label: '10 Words', sub: 'Best' },
                      { val: 5, label: '5 Words', sub: 'Punchy' },
                      { val: 15, label: '15 Words', sub: 'Wide' },
                      { val: 0, label: 'Full', sub: 'All' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() => onUpdateSettings({ ...settings, wordsPerChunk: opt.val })}
                        className={`py-2 px-1 rounded-lg text-center transition-all border ${
                          settings.wordsPerChunk === opt.val
                            ? 'bg-purple-600 border-purple-400 text-white font-bold'
                            : 'bg-black/40 border-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        <div className="text-xs">{opt.label}</div>
                        <div className="text-[9px] opacity-70">{opt.sub}</div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => handleSplitAllTo10Words(settings.wordsPerChunk || 10)}
                    className="w-full mt-2 py-1.5 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Re-batch all cues list to {settings.wordsPerChunk || 10} words</span>
                  </button>
                </div>

                {/* Font Size Viewability */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <label className="font-semibold text-white/90 block">Text Size (Readability)</label>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Scale caption size for phone screens, tablets, or YouTube 4K playback.
                  </p>
                  <div className="grid grid-cols-5 gap-1 pt-1">
                    {(['small', 'medium', 'large', 'xlarge', 'huge'] as SubtitleFontSize[]).map((size) => (
                      <button
                        key={size}
                        onClick={() => onUpdateSettings({ ...settings, fontSize: size })}
                        className={`py-2 rounded-lg text-center capitalize text-xs transition-all border ${
                          settings.fontSize === size
                            ? 'bg-purple-600 border-purple-400 text-white font-bold'
                            : 'bg-black/40 border-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        {size === 'xlarge' ? 'XL' : size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Safe Screen Position */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <label className="font-semibold text-white/90 block">Position (Never Overlaps Timeline)</label>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Above Timeline guarantees 45px+ clearance so the progress bar never intersects text.
                  </p>
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {[
                      { pos: 'above-timeline', label: 'Above Slider' },
                      { pos: 'lower-third', label: 'Lower-Third' },
                      { pos: 'center', label: 'Center Stage' },
                    ].map((p) => (
                      <button
                        key={p.pos}
                        onClick={() => onUpdateSettings({ ...settings, position: p.pos as SubtitlePosition })}
                        className={`py-2 px-1 rounded-lg text-center text-xs transition-all border ${
                          settings.position === p.pos
                            ? 'bg-purple-600 border-purple-400 text-white font-bold'
                            : 'bg-black/40 border-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Theme & Contrast */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <label className="font-semibold text-white/90 block">Contrast & Backplate</label>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Yellow on black is scientifically proven for the highest human contrast and legibility.
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {[
                      { st: 'cinematic-dark', label: 'Cinematic Glass' },
                      { st: 'high-contrast-yellow', label: 'High-Contrast Yellow' },
                      { st: 'solid-black', label: 'Solid Black 100%' },
                      { st: 'minimal-glow', label: 'Minimal Glow' },
                    ].map((s) => (
                      <button
                        key={s.st}
                        onClick={() => onUpdateSettings({ ...settings, style: s.st as SubtitleStyle })}
                        className={`py-2 px-2 rounded-lg text-left text-xs transition-all border truncate ${
                          settings.style === s.st
                            ? 'bg-purple-600 border-purple-400 text-white font-bold'
                            : 'bg-black/40 border-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Karaoke Word Highlight Toggle */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-white">Narrator Word-by-Word Highlight</h4>
                  <p className="text-[11px] text-white/50">
                    Gently illuminates the active word within the 10-word window as the audio plays.
                  </p>
                </div>
                <button
                  onClick={() => onUpdateSettings({ ...settings, highlightActiveWord: !settings.highlightActiveWord })}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    settings.highlightActiveWord
                      ? 'bg-amber-500/30 border-amber-500/60 text-amber-300'
                      : 'bg-black/40 border-white/15 text-white/60 hover:text-white'
                  }`}
                >
                  {settings.highlightActiveWord ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: RAW TEXT / SRT / VTT */}
          {activeTab === 'raw' && (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Paste SRT / VTT / SBV or unformatted plain book chapter text:</span>
                <span className="text-amber-300 font-mono text-[11px]">Supports auto 10-words per slide</span>
              </div>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full h-72 bg-black/60 border border-white/15 rounded-xl p-4 font-mono-tabular text-xs text-white/90 focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
                placeholder={`1\n00:00:00,000 --> 00:00:04,000\nChapter One: The Waking Ember of the Sunken Citadel\n\nOr paste any plain book narrative text here to auto-split into 10-word slides...`}
              />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const generated = convertPlainTextTo10WordCues(rawText, 10, 4.0);
                    if (generated.length > 0) {
                      onUpdateCues(generated);
                      setRawText(cuesToSRT(generated));
                      setActiveTab('list');
                      showToast(`Generated ${generated.length} cues (10 words per slide)`);
                    } else {
                      showToast('Please paste or type text first');
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold shadow-sm transition-all active:scale-95"
                  title="Convert plain book text into timed 10-word subtitle slides"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Convert Plain Text to 10-Word Cues</span>
                </button>

                <button
                  onClick={handleApplyRaw}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Parse and Apply Subtitles</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: CUES LIST */}
          {activeTab === 'list' && (
            <>
              {/* Search & Add Cue Bar */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search dialogue and cues..."
                    className="w-full pl-9 pr-4 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500 placeholder-white/30"
                  />
                </div>

                <button
                  onClick={handleAddCue}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/10 transition-all shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-purple-400" />
                  <span>Add Line</span>
                </button>
              </div>

              {/* 10-Word Pacing Helper Banner */}
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-transparent border border-amber-500/20 text-xs">
                <div className="flex items-center gap-2 text-amber-200/90">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>10-Word Pacing:</strong> Consolidates 1-word or fragmented cues into clean, readable 10-word slides.
                  </span>
                </div>
                <button
                  onClick={() => handleSplitAllTo10Words(10)}
                  className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-[11px] whitespace-nowrap shadow transition-all active:scale-95 shrink-0"
                >
                  Format All to 10 Words
                </button>
              </div>

              {/* Cues List */}
              {filteredCues.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-white/50">
                  <FileText className="w-10 h-10 mb-2 opacity-40 text-purple-400" />
                  <p className="text-sm font-medium">No caption cues loaded</p>
                  <p className="text-xs text-white/40 mt-1 max-w-sm">
                    Upload your audiobook's .srt, .vtt, or .sbv file, or click "Load Sample" to see an example.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredCues.map((cue, idx) => {
                    const isCurrentlyPlaying =
                      currentSeconds >= cue.start && currentSeconds <= cue.end;
                    const wordCount = cue.text.trim().split(/\s+/).filter(Boolean).length;
                    const isLongCue = wordCount > 10;

                    return (
                      <div
                        key={cue.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isCurrentlyPlaying
                            ? 'bg-purple-900/30 border-purple-500/60 shadow-[0_0_20px_rgba(147,51,234,0.2)]'
                            : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap sm:flex-nowrap">
                          {/* Timing Controls */}
                          <div className="flex items-center gap-2 text-xs font-mono-tabular">
                            <button
                              onClick={() => onSeekTo(cue.start)}
                              className="p-1 rounded bg-white/10 hover:bg-purple-600 text-white transition-colors"
                              title="Play from this subtitle"
                            >
                              <Play className="w-3 h-3 fill-current" />
                            </button>

                            <span className="text-white/40 text-[11px]">#{idx + 1}</span>

                            <input
                              type="number"
                              step="0.1"
                              value={cue.start}
                              onChange={(e) =>
                                handleUpdateCueStart(cue.id, parseFloat(e.target.value) || 0)
                              }
                              className="w-16 bg-black/50 border border-white/15 rounded px-1.5 py-0.5 text-center text-white/90 text-xs focus:outline-none focus:border-purple-500"
                              title="Start time in seconds"
                            />
                            <span className="text-white/40">→</span>
                            <input
                              type="number"
                              step="0.1"
                              value={cue.end}
                              onChange={(e) =>
                                handleUpdateCueEnd(cue.id, parseFloat(e.target.value) || 0)
                              }
                              className="w-16 bg-black/50 border border-white/15 rounded px-1.5 py-0.5 text-center text-white/90 text-xs focus:outline-none focus:border-purple-500"
                              title="End time in seconds"
                            />

                            <span className="text-white/40 text-[11px]">
                              ({(cue.end - cue.start).toFixed(1)}s)
                            </span>
                          </div>

                          {/* Right Badges: Word Count & Quick Split */}
                          <div className="flex items-center gap-2">
                            <span 
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono-tabular ${
                                isLongCue
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-white/5 text-white/60 border border-white/10'
                              }`}
                            >
                              {wordCount} words
                            </span>

                            {isLongCue && (
                              <button
                                onClick={() => handleSplitSingleCue(cue.id)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-600/30 hover:bg-purple-600 border border-purple-500/40 text-purple-200 text-[10px] font-semibold transition-all"
                                title="Split this specific sentence into 10 words per line"
                              >
                                <Scissors className="w-3 h-3" />
                                <span>Split 10w</span>
                              </button>
                            )}

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteCue(cue.id)}
                              className="p-1 text-white/40 hover:text-red-400 transition-colors"
                              title="Delete this cue"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Cue Text Input */}
                        <textarea
                          value={cue.text}
                          onChange={(e) => handleUpdateCueText(cue.id, e.target.value)}
                          rows={2}
                          className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
                          placeholder="Subtitle text..."
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-white/60">
          <span>
            {settings.wordsPerChunk > 0
              ? `Live playback: Showing ${settings.wordsPerChunk} words at a time`
              : 'Live playback: Showing full sentences'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
