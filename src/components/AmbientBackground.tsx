import React from 'react';
import { BackgroundMode, OverlayOption } from '../types';

interface AmbientBackgroundProps {
  option: OverlayOption;
  backgroundMode: BackgroundMode;
  coverImageUrl?: string;
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({
  option,
  backgroundMode,
  coverImageUrl,
}) => {
  if (backgroundMode === 'chroma-green') {
    return (
      <div 
        id="bg-chroma-green" 
        className="absolute inset-0 bg-[#00FF00] z-0 pointer-events-none" 
      />
    );
  }

  if (backgroundMode === 'transparent-checker') {
    return (
      <div 
        id="bg-transparent-checker" 
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(45deg, #121217 25%, transparent 25%), 
            linear-gradient(-45deg, #121217 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #121217 75%), 
            linear-gradient(-45deg, transparent 75%, #121217 75%)
          `,
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
          backgroundColor: '#0a0a0f'
        }}
      />
    );
  }

  // OPTION A: Smoothly blurred atmospheric ambient glow matching dark purple, orange, and charcoal tones
  if (option === 'option-a') {
    return (
      <div id="bg-option-a-ambient" className="absolute inset-0 overflow-hidden z-0 pointer-events-none bg-[#08080d]">
        {/* Soft underlying charcoal vignette */}
        <div className="absolute inset-0 bg-radial from-transparent via-[#06060a]/60 to-[#030306] z-10" />

        {/* Diffuse stretched blurred cover art layer for accurate tone matching */}
        {coverImageUrl && (
          <div 
            className="absolute inset-[-20%] bg-cover bg-center filter blur-[90px] opacity-40 transform scale-110"
            style={{ backgroundImage: `url(${coverImageUrl})` }}
          />
        )}

        {/* Ambient Dark Purple Orb (top-left & center glow) */}
        <div 
          className="absolute -top-[20%] -left-[10%] w-[65vw] h-[65vw] rounded-full bg-purple-900/35 filter blur-[120px] mix-blend-screen animate-pulse"
          style={{ animationDuration: '8s' }}
        />

        {/* Atmospheric Fire Orange Glow Orb (bottom-right & center ember glow) */}
        <div 
          className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-amber-700/30 filter blur-[130px] mix-blend-screen animate-pulse"
          style={{ animationDuration: '10s' }}
        />

        {/* Deep Violet Core Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[45vw] h-[45vw] rounded-full bg-indigo-950/50 filter blur-[100px]" />

        {/* Subtle cinematic film grain overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none z-20"
          style={{
            backgroundImage: `radial-gradient(rgba(255,255,255,0.8) 1px, transparent 0)`,
            backgroundSize: '4px 4px',
          }}
        />
      </div>
    );
  }

  // OPTION B: Dark minimalist background: soft, deep gradient blur with subtle ambient lighting in dark blue, purple, and warm orange hues
  return (
    <div id="bg-option-b-ambient" className="absolute inset-0 overflow-hidden z-0 pointer-events-none bg-[#05060a]">
      {/* Deep gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#060710] via-[#05050c] to-[#040407]" />

      {/* Subtle Dark Blue Ambient Orb */}
      <div className="absolute top-[10%] left-[15%] w-[45vw] h-[45vw] rounded-full bg-blue-950/40 filter blur-[140px]" />

      {/* Subtle Purple Ambient Lighting */}
      <div className="absolute top-[30%] right-[20%] w-[50vw] h-[50vw] rounded-full bg-purple-950/35 filter blur-[150px]" />

      {/* Warm Orange Ambient Accent Glow */}
      <div className="absolute -bottom-[15%] left-[35%] w-[45vw] h-[40vw] rounded-full bg-orange-950/30 filter blur-[140px]" />

      {/* Soft Vignette Overlay */}
      <div className="absolute inset-0 bg-radial from-transparent via-[#05060a]/50 to-[#020205] z-10" />
    </div>
  );
};
