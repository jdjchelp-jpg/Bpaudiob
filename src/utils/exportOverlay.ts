import { ExportResolution } from '../types';

export interface ExportDimensions {
  width: number;
  height: number;
  label: string;
}

export const RESOLUTION_PRESETS: Record<ExportResolution, ExportDimensions> = {
  '1080p': { width: 1920, height: 1080, label: '1080p Full HD (1920×1080)' },
  '1440p': { width: 2560, height: 1440, label: '1440p 2K QHD (2560×1440)' },
  '4k': { width: 3840, height: 2160, label: '4K Ultra HD (3840×2160)' },
};

/**
 * Exports the 16:9 viewport as a high-resolution PNG image (1080p, 1440p, or 4K UHD)
 */
export async function exportOverlayAsPNG(
  elementId: string,
  resolution: ExportResolution = '4k',
  filename?: string,
  isTransparent: boolean = false
): Promise<boolean> {
  const container = document.getElementById(elementId);
  if (!container) return false;

  const { width, height } = RESOLUTION_PRESETS[resolution];
  const finalFilename = filename || `audiobook-overlay-${resolution}-${isTransparent ? 'transparent' : '4k'}.png`;

  try {
    const dataUrl = await domToCanvas(container, width, height, isTransparent);
    if (!dataUrl) return false;

    const link = document.createElement('a');
    link.download = finalFilename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Failed to export overlay snapshot:', err);
    return false;
  }
}

async function domToCanvas(
  element: HTMLElement,
  targetWidth: number,
  targetHeight: number,
  isTransparent: boolean
): Promise<string> {
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Remove non-export elements (toolbars, file pickers)
  const toolbars = clone.querySelectorAll('.no-export');
  toolbars.forEach(el => el.remove());

  // Fixed scaling to target resolution
  clone.style.width = `${targetWidth}px`;
  clone.style.height = `${targetHeight}px`;
  clone.style.transform = 'none';
  clone.style.position = 'absolute';
  clone.style.top = '-9999px';
  clone.style.left = '-9999px';
  clone.style.borderRadius = '0';
  
  if (isTransparent) {
    clone.style.background = 'transparent';
    const bgs = clone.querySelectorAll('[id^="bg-"]');
    bgs.forEach(bg => (bg as HTMLElement).style.display = 'none');
  }

  document.body.appendChild(clone);

  // Convert SVG foreignObject
  const serialized = new XMLSerializer().serializeToString(clone);
  document.body.removeChild(clone);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${targetWidth}" height="${targetHeight}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          ${serialized}
        </div>
      </foreignObject>
    </svg>
  `;

  return new Promise((resolve) => {
    const img = new Image();
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const blobURL = window.URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (!isTransparent) {
          ctx.fillStyle = '#050609';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
        }
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        window.URL.revokeObjectURL(blobURL);
        resolve(canvas.toDataURL('image/png', 1.0));
      } else {
        window.URL.revokeObjectURL(blobURL);
        resolve('');
      }
    };
    img.onerror = () => {
      window.URL.revokeObjectURL(blobURL);
      resolve('');
    };
    img.src = blobURL;
  });
}
