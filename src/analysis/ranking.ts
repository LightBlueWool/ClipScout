import type { ClipResult } from "../types";

export interface RankedClip
  extends ClipResult {
  overall_score: number;
}

export function rankClips(
  clips: ClipResult[]
): RankedClip[] {
  return clips
    .map((clip) => ({
      ...clip,
      overall_score:
        calculateOverallScore(clip),
    }))
    .sort(
      (a, b) =>
        b.overall_score - a.overall_score
    );
}

function calculateOverallScore(
  clip: ClipResult
): number {
  const relevanceWeight = 0.6;
  const viralityWeight = 0.4;

  const score =
    clip.relevance_score *
      relevanceWeight +
    clip.virality_score *
      viralityWeight;

  return Math.round(score);
}