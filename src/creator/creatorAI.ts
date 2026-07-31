import type {
  TextAIProvider,
  TextGenerationResult,
} from "../ai/providers/types";
import type { ClipResult, CreatorInsights } from "../types";
import { CreatorEmptyResponseError } from "./creatorErrors";
import {
  buildCreatorPrompt,
  CREATOR_SYSTEM_PROMPT,
} from "./creatorPrompt";
import { parseCreatorInsights } from "./creatorParser";

export interface GeneratedCreatorInsights {
  insights: CreatorInsights;
  generation: TextGenerationResult;
}

export async function generateCreatorInsights(
  clip: ClipResult,
  textProvider: TextAIProvider
): Promise<GeneratedCreatorInsights> {
  const result = await textProvider.generateText({
    systemPrompt: CREATOR_SYSTEM_PROMPT,
    prompt: buildCreatorPrompt(clip),
  });

  if (!result.text.trim()) {
    throw new CreatorEmptyResponseError();
  }

  return {
    insights: parseCreatorInsights(result.text),
    generation: result,
  };
}
