/**
 * Formats seconds into "H:MM:SS" or "0:00:00" format matching audiobook player standards.
 */
export function formatAudioTime(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '0:00:00';
  
  const rounded = Math.floor(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');

  // Format as H:MM:SS (e.g. 0:00:00, 1:24:05, 12:45:30)
  return `${hours}:${mm}:${ss}`;
}

export function parseFormattedTime(timeStr: string): number {
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  } else if (parts.length === 2) {
    return (parts[0] * 60) + parts[1];
  }
  return 0;
}
