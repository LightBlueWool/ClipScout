import type { ClipResult } from "../types";
import type { TextAIProvider } from "../ai/providers/types";
import { generateCreatorInsights } from "./creatorAI";
import { scoreClip } from "./scoreClips";

export interface EnrichClipsOptions {
  textProvider?: TextAIProvider;
  fallbackToHeuristic?: boolean;
  concurrency?: number;
}

export async function enrichClips(
  clips: ClipResult[],
  options: EnrichClipsOptions = {}
): Promise<ClipResult[]> {
  const fallbackToHeuristic = options.fallbackToHeuristic ?? true;
  const concurrency = normalizeConcurrency(options.concurrency);
  const enrichedClips = new Array<ClipResult>(clips.length);

  await runWithConcurrency(clips, concurrency, async (clip, index) => {
      if (!options.textProvider) {
        console.log(
          `Creator intelligence ${index + 1}/${clips.length}: fallback (no text AI provider configured).`
        );

        enrichedClips[index] = {
          ...clip,
          creator: scoreClip(clip),
        };
        return;
      }

      try {
        enrichedClips[index] = {
          ...clip,
          creator: await generateCreatorInsights(
            clip,
            options.textProvider
          ),
        };
        console.log(
          `Creator intelligence ${index + 1}/${clips.length}: AI.`
        );
      } catch (error) {
        if (!fallbackToHeuristic) {
          throw error;
        }

        console.log(
          `Creator intelligence ${index + 1}/${clips.length}: fallback (creator AI unavailable for this clip).`
        );

        enrichedClips[index] = {
          ...clip,
          creator: scoreClip(clip),
        };
      }
    }
  );

  return enrichedClips;
}

function normalizeConcurrency(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 3;
  }

  return Math.max(1, Math.floor(value));
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  handler: (item: T, index: number) => Promise<void>
): Promise<void> {
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      const item = items[currentIndex];

      if (item !== undefined) {
        await handler(item, currentIndex);
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, () => worker())
  );
}
