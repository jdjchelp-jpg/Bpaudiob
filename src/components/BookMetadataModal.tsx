import React from 'react';
import { BookOpen, X, Check, Eye } from 'lucide-react';
import { BookMetadata } from '../types';

interface BookMetadataModalProps {
  isOpen: boolean;
  metadata: BookMetadata;
  onClose: () => void;
  onUpdate: (metadata: BookMetadata) => void;
}

export const BookMetadataModal: React.FC<BookMetadataModalProps> = ({
  isOpen,
  metadata,
  onClose,
  onUpdate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md no-export animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0d0e17] border border-white/15 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Audiobook Information</h2>
              <p className="text-xs text-white/60">Customize title, author, and on-screen placement</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white/80">Book Title</label>
              <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={metadata.showTitle}
                  onChange={(e) => onUpdate({ ...metadata, showTitle: e.target.checked })}
                  className="rounded bg-white/10 border-white/20 text-purple-600 focus:ring-0"
                />
                <span>Visible</span>
              </label>
            </div>
            <input
              type="text"
              value={metadata.title}
              onChange={(e) => onUpdate({ ...metadata, title: e.target.value })}
              placeholder="e.g. The Dragon of Storms"
              className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/15 text-sm text-white focus:outline-none focus:border-purple-500 placeholder-white/30"
            />
          </div>

          {/* Author */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white/80">Author Name</label>
              <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={metadata.showAuthor}
                  onChange={(e) => onUpdate({ ...metadata, showAuthor: e.target.checked })}
                  className="rounded bg-white/10 border-white/20 text-purple-600 focus:ring-0"
                />
                <span>Visible</span>
              </label>
            </div>
            <input
              type="text"
              value={metadata.author}
              onChange={(e) => onUpdate({ ...metadata, author: e.target.value })}
              placeholder="e.g. by E. R. Sterling"
              className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/15 text-sm text-white focus:outline-none focus:border-purple-500 placeholder-white/30"
            />
          </div>

          {/* Narrator */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white/80">Narrator</label>
              <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={metadata.showNarrator}
                  onChange={(e) => onUpdate({ ...metadata, showNarrator: e.target.checked })}
                  className="rounded bg-white/10 border-white/20 text-purple-600 focus:ring-0"
                />
                <span>Visible</span>
              </label>
            </div>
            <input
              type="text"
              value={metadata.narrator}
              onChange={(e) => onUpdate({ ...metadata, narrator: e.target.value })}
              placeholder="e.g. Narrated by Michael Kramer"
              className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/15 text-sm text-white focus:outline-none focus:border-purple-500 placeholder-white/30"
            />
          </div>

          {/* Chapter */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white/80">Chapter / Subtitle</label>
              <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={metadata.showChapter}
                  onChange={(e) => onUpdate({ ...metadata, showChapter: e.target.checked })}
                  className="rounded bg-white/10 border-white/20 text-purple-600 focus:ring-0"
                />
                <span>Visible</span>
              </label>
            </div>
            <input
              type="text"
              value={metadata.chapter}
              onChange={(e) => onUpdate({ ...metadata, chapter: e.target.value })}
              placeholder="e.g. Chapter 1: The Waking Ember"
              className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-white/15 text-sm text-white focus:outline-none focus:border-purple-500 placeholder-white/30"
            />
          </div>

          {/* Placement */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <label className="text-xs font-semibold text-white/80">Screen Placement</label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[
                { id: 'below-cover', label: 'Below Cover' },
                { id: 'top-header', label: 'Top Header' },
                { id: 'above-controls', label: 'Above Controls' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    onUpdate({ ...metadata, placement: item.id as BookMetadata['placement'] })
                  }
                  className={`py-2 px-2.5 rounded-xl border text-center transition-all ${
                    metadata.placement === item.id
                      ? 'bg-purple-600 border-purple-500 text-white font-semibold shadow-sm'
                      : 'bg-black/40 border-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-white/[0.02] flex justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
