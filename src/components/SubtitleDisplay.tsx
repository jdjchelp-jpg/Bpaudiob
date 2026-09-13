import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SubtitleSettings } from '../types';
import { ChunkedSubtitleResult } from '../utils/chunkSubtitles';

interface SubtitleDisplayProps {
  chunk: ChunkedSubtitleResult | null;
  settings: SubtitleSettings;
  isVisible: boolean;
  onOpenSettings?: () => void;
}

export const SubtitleDisplay: React.FC<SubtitleDisplayProps> = ({
  chunk,
  settings,
  isVisible,
  onOpenSettings,
}) => {
  if (!isVisible || !chunk || !chunk.chunkText.trim()) {
    return null;
  }

  // Safe vertical positioning that strictly avoids overlapping the timeline slider
  // The progress timeline sits ~95px-115px from bottom.
  // 'above-timeline' safely gives 45px+ clearance above the slider bar.
  const positionClasses = {
    'above-timeline': 'bottom-[138px] sm:bottom-[155px] md:bottom-[175px] lg:bottom-[190px]',
    'lower-third': 'bottom-[195px] sm:bottom-[225px] md:bottom-[255px] lg:bottom-[280px]',
    'center': 'top-1/2 -translate-y-1/2',
  }[settings.position] || 'bottom-[145px] sm:bottom-[165px] md:bottom-[185px]';

  // Responsive font sizing for optimal viewability
  const fontSizeClasses = {
    small: 'text-sm sm:text-base md:text-lg',
    medium: 'text-base sm:text-lg md:text-xl lg:text-2xl',
    large: 'text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold',
    xlarge: 'text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight',
    huge: 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight',
  }[settings.fontSize] || 'text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold';

  // High-contrast background & container styling
  const styleClasses = {
    'cinematic-dark': 'bg-black/90 backdrop-blur-md border border-white/20 shadow-[0_16px_50px_rgba(0,0,0,0.95)] text-white',
    'high-contrast-yellow': 'bg-[#08090d] border-2 border-amber-400/90 shadow-[0_16px_50px_rgba(0,0,0,0.98)] text-amber-200',
    'solid-black': 'bg-black border border-white/30 shadow-[0_20px_60px_rgba(0,0,0,1)] text-white',
    'minimal-glow': 'bg-black/60 backdrop-blur-sm border border-white/15 shadow-[0_10px_35px_rgba(0,0,0,0.85)] text-white',
  }[settings.style] || 'bg-black/90 backdrop-blur-md border border-white/20 shadow-[0_16px_50px_rgba(0,0,0,0.95)] text-white';

  const isYellowTheme = settings.style === 'high-contrast-yellow';

  return (
    <div 
      id="audiobook-subtitles-container" 
      className={`absolute ${positionClasses} left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-4xl flex flex-col items-center justify-center pointer-events-none select-none px-4 transition-all duration-300`}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={chunk.chunkText + chunk.chunkIndex}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="inline-block max-w-full"
        >
          <div className={`group/caption relative px-6 sm:px-9 py-3 sm:py-4 rounded-2xl ${styleClasses} text-center transition-all duration-200`}>
            {/* 10-Word Subtitle Sentence Flow */}
            <p 
              className={`${fontSizeClasses} tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)] leading-snug sm:leading-relaxed flex flex-wrap items-center justify-center gap-x-2 gap-y-1`}
            >
              {chunk.words.map((word, idx) => {
                const isActive = settings.highlightActiveWord && idx === chunk.activeWordIndex;
                return (
                  <span
                    key={`${idx}-${word}`}
                    className={`transition-all duration-150 inline-block ${
                      isActive
                        ? isYellowTheme
                          ? 'text-white font-black scale-105 drop-shadow-[0_0_12px_rgba(255,255,255,0.9)] underline decoration-amber-400 decoration-2 underline-offset-4'
                          : 'text-amber-300 font-bold scale-105 drop-shadow-[0_0_14px_rgba(252,211,77,0.85)]'
                        : isYellowTheme
                        ? 'text-amber-200/90 font-medium'
                        : 'text-white/95 font-medium'
                    }`}
                  >
                    {word}
                  </span>
                );
              })}
            </p>

            {/* Chunk indicator if long text is broken into multiple ~10-word slides */}
            {chunk.totalChunks > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-2 opacity-60 group-hover/caption:opacity-100 transition-opacity">
                {Array.from({ length: chunk.totalChunks }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      i === chunk.chunkIndex
                        ? 'w-4 bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                        : 'w-1.5 bg-white/30'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
