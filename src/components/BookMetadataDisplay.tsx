import React from 'react';
import { BookMetadata } from '../types';

interface BookMetadataDisplayProps {
  metadata: BookMetadata;
  position: 'below-cover' | 'top-header' | 'above-controls';
  onEditClick?: () => void;
}

export const BookMetadataDisplay: React.FC<BookMetadataDisplayProps> = ({
  metadata,
  position,
  onEditClick,
}) => {
  if (metadata.placement !== position) return null;

  const hasContent = metadata.showTitle || metadata.showAuthor || metadata.showNarrator || metadata.showChapter;
  if (!hasContent) return null;

  if (position === 'top-header') {
    return (
      <div 
        id="book-metadata-header"
        onClick={onEditClick}
        className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-10 text-center max-w-xl w-full px-4 cursor-pointer group select-none"
        title="Click to edit book name and details"
      >
        {metadata.showTitle && (
          <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-white/95 group-hover:text-purple-300 transition-colors drop-shadow-sm">
            {metadata.title}
          </h1>
        )}
        {(metadata.showAuthor || metadata.showChapter) && (
          <p className="text-xs sm:text-sm text-white/60 font-medium tracking-wide mt-0.5">
            {[
              metadata.showAuthor ? metadata.author : '',
              metadata.showChapter ? metadata.chapter : '',
            ]
              .filter(Boolean)
              .join('  •  ')}
          </p>
        )}
      </div>
    );
  }

  if (position === 'below-cover') {
    return (
      <div 
        id="book-metadata-below-cover"
        onClick={onEditClick}
        className="w-full text-center mt-3 sm:mt-4 z-10 max-w-xl mx-auto px-4 cursor-pointer group select-none"
        title="Click to edit book name and details"
      >
        {metadata.showTitle && (
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white group-hover:text-purple-300 transition-colors drop-shadow-sm line-clamp-1">
            {metadata.title}
          </h2>
        )}
        {(metadata.showAuthor || metadata.showChapter || metadata.showNarrator) && (
          <p className="text-xs sm:text-sm md:text-base text-white/70 font-medium tracking-wide mt-1 line-clamp-1">
            {[
              metadata.showAuthor ? metadata.author : '',
              metadata.showChapter ? metadata.chapter : '',
              metadata.showNarrator ? metadata.narrator : '',
            ]
              .filter(Boolean)
              .join('   •   ')}
          </p>
        )}
      </div>
    );
  }

  // position === 'above-controls'
  return (
    <div 
      id="book-metadata-above-controls"
      onClick={onEditClick}
      className="w-full text-center mb-1 z-10 max-w-lg mx-auto px-4 cursor-pointer group select-none"
      title="Click to edit book name and details"
    >
      {metadata.showTitle && (
        <span className="text-sm sm:text-base font-semibold text-white/90 group-hover:text-purple-300 transition-colors mr-2">
          {metadata.title}
        </span>
      )}
      {metadata.showAuthor && (
        <span className="text-xs sm:text-sm text-white/60 font-medium">
          {metadata.author}
        </span>
      )}
    </div>
  );
};
