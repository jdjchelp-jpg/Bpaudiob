import { BookMetadata, OverlayOption, SubtitleSettings } from '../types';
import { formatAudioTime } from './timeFormat';

export interface RenderFrameParams {
  width: number;
  height: number;
  option: OverlayOption;
  coverImage: HTMLImageElement | null;
  tiltAngle: number;
  currentSeconds: number;
  totalSeconds: number;
  bookMetadata: BookMetadata;
  activeSubtitle: string | null;
  subtitleSettings?: SubtitleSettings;
  showPlaybackButtons?: boolean;
  isPlaying: boolean;
  isTransparent?: boolean;
}

/**
 * Draws a pristine 16:9 frame (1080p, 1440p, or 4K UHD) onto an HTML5 Canvas.
 * Handles ambient glow, book cover drop shadow, typography, captions, and player bar.
 */
export function renderOverlayFrame(ctx: CanvasRenderingContext2D, params: RenderFrameParams): void {
  const {
    width,
    height,
    option,
    coverImage,
    tiltAngle,
    currentSeconds,
    totalSeconds,
    bookMetadata,
    activeSubtitle,
    subtitleSettings,
    showPlaybackButtons = true,
    isPlaying,
    isTransparent = false,
  } = params;

  const scale = width / 1920; // Normalizer based on 1080p reference

  // 1. Clear / Background
  ctx.clearRect(0, 0, width, height);

  if (!isTransparent) {
    if (option === 'option-a') {
      // Option A: Atmospheric deep charcoal with purple & fire orange ambient glow
      const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
      baseGrad.addColorStop(0, '#07070c');
      baseGrad.addColorStop(0.5, '#050609');
      baseGrad.addColorStop(1, '#030305');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, width, height);

      // Ambient Purple Glow (top-left / center)
      const purpleGlow = ctx.createRadialGradient(
        width * 0.35, height * 0.35, 10 * scale,
        width * 0.35, height * 0.35, 750 * scale
      );
      purpleGlow.addColorStop(0, 'rgba(126, 34, 206, 0.28)');
      purpleGlow.addColorStop(0.5, 'rgba(88, 28, 135, 0.12)');
      purpleGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = purpleGlow;
      ctx.fillRect(0, 0, width, height);

      // Ambient Fire Orange Glow (bottom-right / center)
      const orangeGlow = ctx.createRadialGradient(
        width * 0.65, height * 0.60, 10 * scale,
        width * 0.65, height * 0.60, 800 * scale
      );
      orangeGlow.addColorStop(0, 'rgba(217, 119, 6, 0.24)');
      orangeGlow.addColorStop(0.5, 'rgba(180, 83, 9, 0.10)');
      orangeGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = orangeGlow;
      ctx.fillRect(0, 0, width, height);
    } else {
      // Option B: Minimalist dark blue / purple / warm orange deep gradient blur
      const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
      baseGrad.addColorStop(0, '#050711');
      baseGrad.addColorStop(0.5, '#04050a');
      baseGrad.addColorStop(1, '#020305');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, width, height);

      // Deep Blue subtle ambient
      const blueGlow = ctx.createRadialGradient(
        width * 0.25, height * 0.3, 10 * scale,
        width * 0.25, height * 0.3, 600 * scale
      );
      blueGlow.addColorStop(0, 'rgba(30, 58, 138, 0.22)');
      blueGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = blueGlow;
      ctx.fillRect(0, 0, width, height);

      // Deep Purple ambient
      const purpGlow = ctx.createRadialGradient(
        width * 0.7, height * 0.4, 10 * scale,
        width * 0.7, height * 0.4, 650 * scale
      );
      purpGlow.addColorStop(0, 'rgba(88, 28, 135, 0.20)');
      purpGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = purpGlow;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // 2. Book Title / Header (if set to top-header)
  if (bookMetadata.placement === 'top-header' && (bookMetadata.showTitle || bookMetadata.showChapter)) {
    ctx.save();
    ctx.textAlign = 'center';
    if (bookMetadata.showTitle) {
      ctx.font = `600 ${22 * scale}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(bookMetadata.title, width / 2, 50 * scale);
    }
    if (bookMetadata.showAuthor || bookMetadata.showChapter) {
      ctx.font = `400 ${14 * scale}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      const sub = [bookMetadata.showAuthor ? bookMetadata.author : '', bookMetadata.showChapter ? bookMetadata.chapter : '']
        .filter(Boolean)
        .join(' • ');
      ctx.fillText(sub, width / 2, 75 * scale);
    }
    ctx.restore();
  }

  // 3. Center Square Book Cover or Blank Frame
  const coverSize = Math.min(width * 0.32, height * 0.54);
  const centerX = width / 2;
  const centerY = height * 0.44; // Positioned slightly above center to leave room for subtitles and player

  ctx.save();
  ctx.translate(centerX, centerY);

  if (option === 'option-a' && tiltAngle !== 0) {
    ctx.rotate((tiltAngle * Math.PI) / 180);
  }

  const cornerRadius = 18 * scale;
  const x = -coverSize / 2;
  const y = -coverSize / 2;

  if (option === 'option-a') {
    // Multi-layer drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 45 * scale;
    ctx.shadowOffsetY = 20 * scale;

    // Draw rounded rect
    drawRoundedRect(ctx, x, y, coverSize, coverSize, cornerRadius);
    ctx.fillStyle = '#0f0f15';
    ctx.fill();

    // Reset shadow for inner content clipping
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.save();
    drawRoundedRect(ctx, x, y, coverSize, coverSize, cornerRadius);
    ctx.clip();

    if (coverImage && coverImage.complete) {
      ctx.drawImage(coverImage, x, y, coverSize, coverSize);
    } else {
      ctx.fillStyle = '#1c1b29';
      ctx.fillRect(x, y, coverSize, coverSize);
    }

    // Subtle border sheen
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
    ctx.restore();
  } else {
    // Option B: Blank square frame placeholder with rounded corner shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 35 * scale;
    ctx.shadowOffsetY = 15 * scale;

    drawRoundedRect(ctx, x, y, coverSize, coverSize, cornerRadius);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Dashed border for video editor placeholder
    ctx.save();
    ctx.setLineDash([8 * scale, 8 * scale]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2 * scale;
    drawRoundedRect(ctx, x, y, coverSize, coverSize, cornerRadius);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();

  // 4. Book Title & Author (if below-cover)
  if (bookMetadata.placement === 'below-cover' && (bookMetadata.showTitle || bookMetadata.showAuthor)) {
    ctx.save();
    ctx.textAlign = 'center';
    let textY = centerY + coverSize / 2 + 36 * scale;

    if (bookMetadata.showTitle) {
      ctx.font = `700 ${22 * scale}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(bookMetadata.title, width / 2, textY);
      textY += 24 * scale;
    }

    if (bookMetadata.showAuthor || bookMetadata.showChapter) {
      ctx.font = `500 ${14 * scale}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      const metaLine = [
        bookMetadata.showAuthor ? bookMetadata.author : '',
        bookMetadata.showChapter ? bookMetadata.chapter : '',
        bookMetadata.showNarrator ? bookMetadata.narrator : '',
      ]
        .filter(Boolean)
        .join('  •  ');
      ctx.fillText(metaLine, width / 2, textY);
    }
    ctx.restore();
  }

  // 5. Active Subtitle / Caption (Paced with Safe Clearance above timeline)
  if (activeSubtitle && activeSubtitle.trim()) {
    ctx.save();
    
    // Scale font size according to user preference
    let baseFontSize = 26;
    if (subtitleSettings?.fontSize === 'small') baseFontSize = 18;
    else if (subtitleSettings?.fontSize === 'medium') baseFontSize = 22;
    else if (subtitleSettings?.fontSize === 'large') baseFontSize = 28;
    else if (subtitleSettings?.fontSize === 'xlarge') baseFontSize = 34;
    else if (subtitleSettings?.fontSize === 'huge') baseFontSize = 42;

    const captionFontSize = baseFontSize * scale;
    ctx.font = `600 ${captionFontSize}px 'Plus Jakarta Sans', sans-serif`;
    ctx.textAlign = 'center';

    const textMetrics = ctx.measureText(activeSubtitle);
    const textWidth = textMetrics.width;
    const paddingX = 36 * scale;
    const paddingY = 16 * scale;
    const boxWidth = Math.min(width * 0.90, textWidth + paddingX * 2);
    const boxHeight = captionFontSize + paddingY * 2;
    const boxX = (width - boxWidth) / 2;

    // Calculate boxY based on position setting ensuring safe clearance above timeline
    // Timeline is at height - 120 * scale
    let boxY = height - 150 * scale - boxHeight; // 'above-timeline' safe zone
    if (subtitleSettings?.position === 'lower-third') {
      boxY = height * 0.72;
    } else if (subtitleSettings?.position === 'center') {
      boxY = height * 0.50 - boxHeight / 2;
    }

    const isYellow = subtitleSettings?.style === 'high-contrast-yellow';
    const isSolidBlack = subtitleSettings?.style === 'solid-black';
    const isMinimal = subtitleSettings?.style === 'minimal-glow';

    // Subtitle Pill Background
    drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, 16 * scale);

    if (isYellow) {
      ctx.fillStyle = '#08090d';
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2 * scale;
      ctx.stroke();
    } else if (isSolidBlack) {
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();
    } else if (isMinimal) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1 * scale;
      ctx.stroke();
    } else {
      // Cinematic Dark
      ctx.fillStyle = 'rgba(6, 7, 12, 0.90)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.2 * scale;
      ctx.stroke();
    }

    // Subtitle Text with high legibility
    ctx.fillStyle = isYellow ? '#fef08a' : '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 6 * scale;
    ctx.shadowOffsetY = 2 * scale;
    ctx.fillText(activeSubtitle, width / 2, boxY + paddingY + captionFontSize * 0.82);
    ctx.restore();
  }

  // 6. Media Player UI Controls Bar at Bottom
  const bottomBarPadding = 80 * scale;
  const progressY = height - 120 * scale;
  const controlsY = height - 64 * scale;

  // Timeline Progress Bar
  const progressRatio = totalSeconds > 0 ? Math.min(1, Math.max(0, currentSeconds / totalSeconds)) : 0;
  const timeTextWidth = 85 * scale;
  const barStartX = bottomBarPadding + timeTextWidth + 24 * scale;
  const barEndX = width - bottomBarPadding - timeTextWidth - 24 * scale;
  const barWidth = barEndX - barStartX;

  // Elapsed Time on Left
  ctx.save();
  ctx.font = `500 ${16 * scale}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.textAlign = 'left';
  ctx.fillText(formatAudioTime(currentSeconds), bottomBarPadding, progressY + 6 * scale);

  // Total Duration on Right
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(formatAudioTime(totalSeconds), width - bottomBarPadding, progressY + 6 * scale);

  // Background Bar
  const barHeight = 4 * scale;
  drawRoundedRect(ctx, barStartX, progressY - barHeight / 2, barWidth, barHeight, 2 * scale);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fill();

  // Active Progress Fill
  const fillWidth = barWidth * progressRatio;
  if (fillWidth > 0) {
    drawRoundedRect(ctx, barStartX, progressY - barHeight / 2, fillWidth, barHeight, 2 * scale);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  // Playhead Knob
  ctx.beginPath();
  ctx.arc(barStartX + fillWidth, progressY, 6 * scale, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
  ctx.shadowBlur = 8 * scale;
  ctx.fill();
  ctx.restore();

  // Playback Controls (Rewind 10s, Play/Pause, Fast-Forward 30s)
  if (showPlaybackButtons) {
    ctx.save();
    const midX = width / 2;

    // Play / Pause Circle
    ctx.beginPath();
    const playRadius = 26 * scale;
    ctx.arc(midX, controlsY, playRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 12 * scale;
    ctx.fill();

    // Play / Pause Icon inside circle
    ctx.fillStyle = '#000000';
    if (isPlaying) {
      // Pause icon (two bars)
      const barW = 5 * scale;
      const barH = 18 * scale;
      ctx.fillRect(midX - 7 * scale, controlsY - barH / 2, barW, barH);
      ctx.fillRect(midX + 2 * scale, controlsY - barH / 2, barW, barH);
    } else {
      // Play triangle
      ctx.beginPath();
      const triSize = 10 * scale;
      ctx.moveTo(midX - triSize * 0.6, controlsY - triSize);
      ctx.lineTo(midX + triSize * 1.1, controlsY);
      ctx.lineTo(midX - triSize * 0.6, controlsY + triSize);
      ctx.closePath();
      ctx.fill();
    }

    // Rewind 10s Icon & Text
    ctx.textAlign = 'center';
    ctx.font = `600 ${11 * scale}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('↺10s', midX - 70 * scale, controlsY + 4 * scale);

    // Fast Forward 30s Icon & Text
    ctx.fillText('30s↻', midX + 70 * scale, controlsY + 4 * scale);
    ctx.restore();
  }

  // Right-side Volume & 16:9 Indicator
  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = `500 ${13 * scale}px 'Plus Jakarta Sans', sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillText('4K UHD 16:9', width - bottomBarPadding, controlsY + 4 * scale);
  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
