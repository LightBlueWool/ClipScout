import { buildClipPrompt } from "../../promptBuilder";
import type { PromptOptions } from "../../promptBuilder";

export interface ClipPromptOptions {
  objective: string;
  maxClips?: number;
  minClipLength?: number;
  maxClipLength?: number;
  platform?: string;
  exclusions?: string[];
}

export function createClipAnalysisPrompt({
  objective,
  maxClips = 10,
  minClipLength = 10,
  maxClipLength = 60,
  platform,
  exclusions,
}: ClipPromptOptions): string {
  const promptOptions: PromptOptions = {
    objective,
    maxClips,
    minClipLength,
    maxClipLength,
  };

  if (platform !== undefined) {
    promptOptions.platform = platform;
  }

  if (exclusions !== undefined) {
    promptOptions.exclusions = exclusions.join("\n");
  }

  return buildClipPrompt(promptOptions);
}
