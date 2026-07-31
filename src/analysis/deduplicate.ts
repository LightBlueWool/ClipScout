import type { ClipResult } from "../types";

export interface DeduplicationOptions {
  overlapThreshold?: number;
  startTimeTolerance?: number;
}

const DEFAULT_OPTIONS: Required<DeduplicationOptions> = {
  overlapThreshold: 0.7,
  startTimeTolerance: 2,
};

/**
 * Removes clips that substantially overlap with stronger clips.
 *
 * The input should already be ranked from strongest to weakest.
 * This ensures that the highest-ranked version of a moment is retained.
 */
export function deduplicateClips<T extends ClipResult>(
  clips: T[],
  options: DeduplicationOptions = {}
): T[] {
  const settings = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const uniqueClips: T[] = [];

  for (const candidate of clips) {
    const isDuplicate = uniqueClips.some((keptClip) =>
      areClipsDuplicates(candidate, keptClip, settings)
    );

    if (!isDuplicate) {
      uniqueClips.push(candidate);
    }
  }

  return uniqueClips;
}

function areClipsDuplicates(
  first: ClipResult,
  second: ClipResult,
  options: Required<DeduplicationOptions>
): boolean {
  const startDifference = Math.abs(
    first.start_time - second.start_time
  );

  const substantialOverlap =
    calculateShorterClipOverlap(first, second) >=
    options.overlapThreshold;

  const nearlySameStart =
    startDifference <= options.startTimeTolerance &&
    calculateIntersectionDuration(first, second) > 0;

  return substantialOverlap || nearlySameStart;
}

/**
 * Calculates how much of the shorter clip is shared with the other clip.
 *
 * Example:
 * Clip A: 10–30
 * Clip B: 12–28
 *
 * Intersection: 16 seconds
 * Shorter clip: 16 seconds
 * Result: 1.0
 */
function calculateShorterClipOverlap(
  first: ClipResult,
  second: ClipResult
): number {
  const intersection = calculateIntersectionDuration(
    first,
    second
  );

  if (intersection <= 0) {
    return 0;
  }

  const firstDuration = getClipDuration(first);
  const secondDuration = getClipDuration(second);
  const shorterDuration = Math.min(
    firstDuration,
    secondDuration
  );

  if (shorterDuration <= 0) {
    return 0;
  }

  return intersection / shorterDuration;
}

function calculateIntersectionDuration(
  first: ClipResult,
  second: ClipResult
): number {
  const intersectionStart = Math.max(
    first.start_time,
    second.start_time
  );

  const intersectionEnd = Math.min(
    first.end_time,
    second.end_time
  );

  return Math.max(
    0,
    intersectionEnd - intersectionStart
  );
}

function getClipDuration(clip: ClipResult): number {
  return Math.max(
    0,
    clip.end_time - clip.start_time
  );
}