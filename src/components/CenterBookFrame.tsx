import React from 'react';
import { Image as ImageIcon, Upload, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { BookMetadata, OverlayOption } from '../types';
import { BookMetadataDisplay } from './BookMetadataDisplay';

interface CenterBookFrameProps {
  option: OverlayOption;
  coverImageUrl: string;
  tiltAngle: number;
  showAlignmentGuides: boolean;
  metadata?: BookMetadata;
  onUploadCover?: (file: File) => void;
  onEditMetadata?: () => void;
}

export const CenterBookFrame: React.FC<CenterBookFrameProps> = ({
  option,
  coverImageUrl,
  tiltAngle,
  showAlignmentGuides,
  metadata,
  onUploadCover,
  onEditMetadata,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && onUploadCover) {
      onUploadCover(e.target.files[0]);
    }
  };

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center w-full min-h-0 pt-3 pb-1 select-none z-10">
      {/* Hidden file input for custom cover upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {option === 'option-a' ? (
        /* OPTION A: Complete UI Overlay (Prominent square fantasy book cover artwork, tilted with subtle soft drop shadow) */
        <motion.div
          id="option-a-book-cover-container"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ 
            scale: 1, 
            opacity: 1,
            rotate: tiltAngle,
          }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative group max-w-[65vw] max-h-[48vh] aspect-square w-auto h-auto flex items-center justify-center"
        >
          {/* Ambient Glow Diffuse Behind Cover */}
          <div 
            className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-purple-700/40 via-violet-600/30 to-amber-600/40 blur-2xl -z-10 scale-105 pointer-events-none transition-transform duration-700 group-hover:scale-110" 
          />

          {/* Book Cover Frame with multi-layered soft drop shadow */}
          <div 
            className="relative w-full h-full rounded-xl sm:rounded-2xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85),0_10px_30px_rgba(30,10,60,0.5)] ring-1 ring-white/10 transition-shadow duration-300"
            style={{
              aspectRatio: '1 / 1',
            }}
          >
            {/* The Book Cover Artwork */}
            <img
              id="book-cover-image"
              src={coverImageUrl}
              alt="Fantasy Audiobook Cover Artwork - Hero with Purple Lightning and Fire Dragon"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center pointer-events-none transform transition-transform duration-700 group-hover:scale-[1.02]"
            />

            {/* Subtle soft edge sheen and light gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/10 pointer-events-none" />

            {/* Quick change cover overlay button on hover */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center cursor-pointer backdrop-blur-xs text-white/90 gap-2 p-4 text-center"
              title="Click to test with your own custom cover art"
            >
              <Upload className="w-8 h-8 text-purple-300" />
              <span className="text-xs font-semibold tracking-wider uppercase text-white">
                Replace Cover Art
              </span>
              <span className="text-[11px] text-white/60">
                JPG, PNG, WebP (1:1 Square)
              </span>
            </div>
          </div>
        </motion.div>
      ) : (
        /* OPTION B: Clean Blank Center Frame Placeholder with rounded corner shadow where album art goes */
        <motion.div
          id="option-b-blank-frame-container"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative group max-w-[65vw] max-h-[48vh] aspect-square w-auto h-auto flex items-center justify-center"
        >
          {/* Soft ambient backlight around frame */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-blue-900/20 via-purple-900/20 to-orange-900/20 blur-xl -z-10 scale-105 pointer-events-none" />

          {/* Blank Square Frame Placeholder with rounded corner shadow */}
          <div
            id="blank-center-frame"
            className="relative w-full h-full rounded-xl sm:rounded-2xl border border-dashed border-white/20 bg-white/[0.02] backdrop-blur-[2px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),inset_0_0_40px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center overflow-hidden transition-all duration-300 hover:border-white/40 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            style={{
              aspectRatio: '1 / 1',
            }}
          >
            {/* Alignment Corner Brackets (for video editor precision alignment) */}
            {showAlignmentGuides && (
              <>
                <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-white/40" />
                <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-white/40" />
                <div className="absolute bottom-3 left-3 w-4 h-2 border-b-2 border-l-2 border-white/40" />
                <div className="absolute bottom-3 right-3 w-4 h-2 border-b-2 border-r-2 border-white/40" />
                {/* Subtle Center Crosshair */}
                <div className="absolute w-6 h-[1px] bg-white/20" />
                <div className="absolute h-6 w-[1px] bg-white/20" />
              </>
            )}

            {/* Frame Placeholder Information and Instructions */}
            <div className="flex flex-col items-center justify-center p-6 text-center select-none pointer-events-none max-w-xs">
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2 text-white/50 group-hover:text-purple-300 group-hover:scale-110 transition-all duration-200">
                <ImageIcon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white/80 tracking-wide mb-1">
                Square Cover Placeholder
              </h3>
              <p className="text-[11px] text-white/50 leading-relaxed mb-2">
                Overlay your high-res cover art in your video editor.
              </p>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono-tabular text-white/60">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>1:1 Square (1080×1080)</span>
              </div>
            </div>

            {/* Subtle corner shadow vignette */}
            <div className="absolute inset-0 shadow-[inset_0_0_30px_rgba(0,0,0,0.5)] rounded-xl sm:rounded-2xl pointer-events-none" />
          </div>
        </motion.div>
      )}

      {/* Book Metadata directly under the cover */}
      {metadata && (
        <BookMetadataDisplay
          metadata={metadata}
          position="below-cover"
          onEditClick={onEditMetadata}
        />
      )}
    </div>
  );
};
