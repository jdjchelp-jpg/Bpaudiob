import { SubtitleCue } from '../types';

/**
 * Parses timestamp strings like:
 * "00:01:23,456" (SRT)
 * "00:01:23.456" (VTT)
 * "0:01:23.456" or "1:23.456" (SBV / compact)
 */
export function parseTimestampToSeconds(timestamp: string): number {
  const clean = timestamp.trim().replace(',', '.');
  const parts = clean.split(':');
  
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  } else if (parts.length === 1) {
    return parseFloat(parts[0]) || 0;
  }
  return 0;
}

/**
 * Strip HTML/formatting tags from subtitle text (e.g. <i>, <b>, <c.color>, <v Voice>)
 */
function cleanSubtitleText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\{[^}]+\}/g, '')
    .trim();
}

/**
 * Parses SRT formatted string into SubtitleCue[]
 */
export function parseSRT(content: string): SubtitleCue[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = normalized.split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];
  let idCounter = 1;

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let timeLineIndex = 0;
    // Check if line 0 is numeric ID
    if (/^\d+$/.test(lines[0]) && lines.length > 1) {
      timeLineIndex = 1;
    }

    const timeLine = lines[timeLineIndex];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
    const start = parseTimestampToSeconds(startStr);
    const end = parseTimestampToSeconds(endStr);

    const textLines = lines.slice(timeLineIndex + 1);
    const text = cleanSubtitleText(textLines.join('\n'));

    if (text && !isNaN(start) && !isNaN(end) && end >= start) {
      cues.push({
        id: idCounter++,
        start,
        end,
        text,
      });
    }
  }

  return cues;
}

/**
 * Parses WebVTT (.vtt) format string into SubtitleCue[]
 */
export function parseVTT(content: string): SubtitleCue[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  // Strip header like "WEBVTT", "NOTE...", etc.
  const lines = normalized.split('\n');
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('WEBVTT') || trimmed.startsWith('NOTE') || trimmed.startsWith('STYLE')) {
      continue;
    }

    if (!trimmed) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
    } else {
      currentBlock.push(trimmed);
    }
  }
  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  const cues: SubtitleCue[] = [];
  let idCounter = 1;

  for (const block of blocks) {
    let timeLineIndex = -1;
    for (let i = 0; i < block.length; i++) {
      if (block[i].includes('-->')) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex === -1) continue;

    const timeLine = block[timeLineIndex];
    const [startStr, rest] = timeLine.split('-->').map(s => s.trim());
    // In VTT, end time may have settings like "align:center line:90%"
    const endStr = rest.split(/\s+/)[0];

    const start = parseTimestampToSeconds(startStr);
    const end = parseTimestampToSeconds(endStr);
    const textLines = block.slice(timeLineIndex + 1);
    const text = cleanSubtitleText(textLines.join('\n'));

    if (text && !isNaN(start) && !isNaN(end) && end >= start) {
      cues.push({
        id: idCounter++,
        start,
        end,
        text,
      });
    }
  }

  return cues;
}

/**
 * Parses YouTube SBV (.sbv / SubViewer) format string into SubtitleCue[]
 * Format:
 * 0:00:00.000,0:00:04.500
 * Subtitle text here
 */
export function parseSBV(content: string): SubtitleCue[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = normalized.split(/\n\s*\n/);
  const cues: SubtitleCue[] = [];
  let idCounter = 1;

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const timeLine = lines[0];
    if (!timeLine.includes(',')) continue;

    const [startStr, endStr] = timeLine.split(',').map(s => s.trim());
    const start = parseTimestampToSeconds(startStr);
    const end = parseTimestampToSeconds(endStr);
    const text = cleanSubtitleText(lines.slice(1).join('\n'));

    if (text && !isNaN(start) && !isNaN(end) && end >= start) {
      cues.push({
        id: idCounter++,
        start,
        end,
        text,
      });
    }
  }

  return cues;
}

/**
 * Auto-detects and parses .srt, .vtt, or .sbv content
 */
export function parseCaptionFile(content: string, filename?: string): SubtitleCue[] {
  const lower = filename?.toLowerCase() || '';
  if (lower.endsWith('.vtt') || content.startsWith('WEBVTT')) {
    const result = parseVTT(content);
    if (result.length > 0) return result;
  }
  if (lower.endsWith('.sbv') || /^\d+:\d+:\d+\.\d+,\d+:\d+:\d+\.\d+/m.test(content)) {
    const result = parseSBV(content);
    if (result.length > 0) return result;
  }
  
  // Default to SRT parser first, then fallback to VTT/SBV
  const srtResult = parseSRT(content);
  if (srtResult.length > 0) return srtResult;

  const vttResult = parseVTT(content);
  if (vttResult.length > 0) return vttResult;

  return parseSBV(content);
}

/**
 * Formats cue list to standard SRT string
 */
export function cuesToSRT(cues: SubtitleCue[]): string {
  function formatTimeSRT(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  return cues.map((cue, index) => {
    return `${index + 1}\n${formatTimeSRT(cue.start)} --> ${formatTimeSRT(cue.end)}\n${cue.text}\n`;
  }).join('\n');
}

export { splitCuesByWordLimit, rebatchCuesToWordCount } from './chunkSubtitles';

/**
 * Converts any raw plain text paragraph or transcript into consecutive
 * ~10-word timed subtitle cues.
 */
export function convertPlainTextTo10WordCues(
  text: string,
  wordsPerSlide: number = 10,
  secondsPerSlide: number = 4.0
): SubtitleCue[] {
  const clean = text.trim();
  if (!clean) return [];

  const allWords = clean.split(/\s+/).filter(Boolean);
  if (allWords.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < allWords.length; i += wordsPerSlide) {
    chunks.push(allWords.slice(i, i + wordsPerSlide));
  }

  return chunks.map((chunk, index) => ({
    id: index + 1,
    start: parseFloat((index * secondsPerSlide).toFixed(2)),
    end: parseFloat(((index + 1) * secondsPerSlide).toFixed(2)),
    text: chunk.join(' '),
  }));
}

/**
 * Sample fantasy audiobook caption cues for instant demo
 * (Continuous, back-to-back timestamps, each strictly paced at 10 words per line for high viewability)
 */
export const SAMPLE_AUDIOBOOK_CUES: SubtitleCue[] = [
  {
    id: 1,
    start: 0,
    end: 4.0,
    text: "Chapter One: The Waking Ember of the Sunken Citadel",
  },
  {
    id: 2,
    start: 4.0,
    end: 8.0,
    text: "Deep beneath the obsidian crags of Mount Vorash caverns,",
  },
  {
    id: 3,
    start: 8.0,
    end: 12.0,
    text: "the air smelled of ancient lightning and scorched crimson copper.",
  },
  {
    id: 4,
    start: 12.0,
    end: 16.0,
    text: "Kael gripped his catalyst blade with an unwavering steady hand,",
  },
  {
    id: 5,
    start: 16.0,
    end: 20.0,
    text: "purple arcanum surging through the glowing veins in his forearm.",
  },
  {
    id: 6,
    start: 20.0,
    end: 24.0,
    text: "Before him coiled the slumbering flame drake in its lair,",
  },
  {
    id: 7,
    start: 24.0,
    end: 28.0,
    text: "golden slit eyes burning like molten fire in the gloom.",
  },
  {
    id: 8,
    start: 28.0,
    end: 32.0,
    text: "“You come to claim the dragonheart, foolish mortal?” beast rumbled.",
  },
  {
    id: 9,
    start: 32.0,
    end: 36.0,
    text: "“Not to claim it,” Kael whispered, “to protect its flame.”",
  },
  {
    id: 10,
    start: 36.0,
    end: 40.0,
    text: "Violet sparks danced along the razor edge of his sword.",
  },
  {
    id: 11,
    start: 40.0,
    end: 44.0,
    text: "A deafening roar shattered the stillness of the cavern depths.",
  },
  {
    id: 12,
    start: 44.0,
    end: 48.0,
    text: "Cascades of ash tumbled down the colossal pillars of basalt.",
  },
  {
    id: 13,
    start: 48.0,
    end: 52.0,
    text: "In the distance, the bells of the sanctuary began tolling.",
  },
  {
    id: 14,
    start: 52.0,
    end: 56.0,
    text: "The hour of the eclipse had finally fallen upon them.",
  },
  {
    id: 15,
    start: 56.0,
    end: 60.0,
    text: "Shadows detached from the walls, whispering names of forgotten kings.",
  },
  {
    id: 16,
    start: 60.0,
    end: 64.0,
    text: "Kael stepped forward into the radiant circle of dragon fire.",
  },
  {
    id: 17,
    start: 64.0,
    end: 68.0,
    text: "There was no turning back once the covenant was sealed.",
  },
  {
    id: 18,
    start: 68.0,
    end: 72.0,
    text: "Together they would hold the gates against the coming dark.",
  }
];
