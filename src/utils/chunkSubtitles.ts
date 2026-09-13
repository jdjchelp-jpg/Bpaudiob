import { SubtitleCue } from '../types';

export interface ChunkedSubtitleResult {
  chunkText: string;
  words: string[];
  activeWordIndex: number;
  chunkIndex: number;
  totalChunks: number;
}

export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

/**
 * Takes any set of subtitle cues (whether single words like Whisper/TikTok exports,
 * short phrases, or long unpartitioned paragraphs) and batches them into cleanly paced
 * slides of exactly `wordsPerSlide` (default 10 words).
 * Preserves accurate start and end timestamps from the underlying cues.
 */
export function rebatchCuesToWordCount(
  cues: SubtitleCue[],
  wordsPerSlide: number = 10
): SubtitleCue[] {
  if (!cues || cues.length === 0) return [];
  if (wordsPerSlide <= 0) return cues;

  // 1. Flatten all cues into an array of timed words
  const timedWords: TimedWord[] = [];

  for (const cue of cues) {
    const rawWords = cue.text.trim().split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) continue;

    const duration = Math.max(0.05, cue.end - cue.start);
    const wordDuration = duration / rawWords.length;

    for (let i = 0; i < rawWords.length; i++) {
      const wStart = cue.start + i * wordDuration;
      const wEnd = cue.start + (i + 1) * wordDuration;
      timedWords.push({
        word: rawWords[i],
        start: wStart,
        end: wEnd,
      });
    }
  }

  if (timedWords.length === 0) return [];

  // 2. Group into slides of wordsPerSlide
  const result: SubtitleCue[] = [];
  let currentGroup: TimedWord[] = [];
  let idCounter = 1;

  for (let i = 0; i < timedWords.length; i++) {
    const item = timedWords[i];

    // Check if there's an extended silence/gap (> 3.5s) between the previous word and this word
    const prev = currentGroup[currentGroup.length - 1];
    const isBigGap = prev && (item.start - prev.end > 3.5);

    if (currentGroup.length >= wordsPerSlide || (isBigGap && currentGroup.length >= 4)) {
      const gStart = currentGroup[0].start;
      const gEnd = currentGroup[currentGroup.length - 1].end;
      result.push({
        id: idCounter++,
        start: parseFloat(gStart.toFixed(2)),
        end: parseFloat(Math.max(gStart + 1.2, gEnd).toFixed(2)),
        text: currentGroup.map((w) => w.word).join(' '),
      });
      currentGroup = [];
    }

    currentGroup.push(item);
  }

  // Push remaining words
  if (currentGroup.length > 0) {
    const gStart = currentGroup[0].start;
    const gEnd = currentGroup[currentGroup.length - 1].end;
    result.push({
      id: idCounter++,
      start: parseFloat(gStart.toFixed(2)),
      end: parseFloat(Math.max(gStart + 1.2, gEnd).toFixed(2)),
      text: currentGroup.map((w) => w.word).join(' '),
    });
  }

  return result;
}

/**
 * Given a subtitle cue and current playback time in seconds,
 * calculates the active chunk of ~10 words (or user-defined chunk size)
 * and the currently active word index for reading focus.
 */
export function getActiveSubtitleChunk(
  cue: SubtitleCue | null | undefined,
  currentSeconds: number,
  wordsPerChunk: number = 10
): ChunkedSubtitleResult | null {
  if (!cue || !cue.text || !cue.text.trim()) {
    return null;
  }

  const rawWords = cue.text.trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) {
    return null;
  }

  // If wordsPerChunk is 0 or words count <= wordsPerChunk, show all words
  if (wordsPerChunk <= 0 || rawWords.length <= wordsPerChunk) {
    const duration = Math.max(0.1, cue.end - cue.start);
    const elapsed = Math.max(0, Math.min(duration, currentSeconds - cue.start));
    const progress = elapsed / duration;
    const activeWordIndex = Math.min(
      rawWords.length - 1,
      Math.max(0, Math.floor(progress * rawWords.length))
    );

    return {
      chunkText: rawWords.join(' '),
      words: rawWords,
      activeWordIndex,
      chunkIndex: 0,
      totalChunks: 1,
    };
  }

  // Divide rawWords into chunks of `wordsPerChunk`
  const chunks: string[][] = [];
  for (let i = 0; i < rawWords.length; i += wordsPerChunk) {
    chunks.push(rawWords.slice(i, i + wordsPerChunk));
  }

  const totalDuration = Math.max(0.1, cue.end - cue.start);
  const totalWords = rawWords.length;

  // Compute time bounds for each chunk proportional to its word count
  let cumulativeWords = 0;
  let activeChunkIdx = 0;
  let chunkStartTime = cue.start;
  let chunkEndTime = cue.end;
  let activeWordsInChunk: string[] = chunks[0];

  for (let i = 0; i < chunks.length; i++) {
    const chunkWordsCount = chunks[i].length;
    const chunkStart = cue.start + (cumulativeWords / totalWords) * totalDuration;
    const chunkEnd = cue.start + ((cumulativeWords + chunkWordsCount) / totalWords) * totalDuration;
    const isLast = i === chunks.length - 1;

    if (currentSeconds < chunkStart && i === 0) {
      activeChunkIdx = 0;
      chunkStartTime = chunkStart;
      chunkEndTime = chunkEnd;
      activeWordsInChunk = chunks[0];
      break;
    }

    if ((currentSeconds >= chunkStart && currentSeconds <= chunkEnd) || (isLast && currentSeconds >= chunkStart)) {
      activeChunkIdx = i;
      chunkStartTime = chunkStart;
      chunkEndTime = chunkEnd;
      activeWordsInChunk = chunks[i];
      break;
    }

    cumulativeWords += chunkWordsCount;
  }

  // Calculate active word index within current chunk
  const chunkDuration = Math.max(0.05, chunkEndTime - chunkStartTime);
  const chunkElapsed = Math.max(0, Math.min(chunkDuration, currentSeconds - chunkStartTime));
  const chunkProgress = chunkElapsed / chunkDuration;
  const activeWordInChunk = Math.min(
    activeWordsInChunk.length - 1,
    Math.max(0, Math.floor(chunkProgress * activeWordsInChunk.length))
  );

  return {
    chunkText: activeWordsInChunk.join(' '),
    words: activeWordsInChunk,
    activeWordIndex: activeWordInChunk,
    chunkIndex: activeChunkIdx,
    totalChunks: chunks.length,
  };
}

/**
 * Splits or merges any cues into continuous, discrete cues of `wordsPerChunk` (e.g. 10 words).
 * Replaces old split-only logic with full rebatching for both 1-word and multi-word cues.
 */
export function splitCuesByWordLimit(
  cues: SubtitleCue[],
  wordsPerChunk: number = 10
): SubtitleCue[] {
  return rebatchCuesToWordCount(cues, wordsPerChunk);
}
