import type { TextAIProvider } from "../ai/providers/types";
import type { ClipResult, CreatorInsights } from "../types";
import {
  buildCreatorPrompt,
  CREATOR_SYSTEM_PROMPT,
} from "./creatorPrompt";
import { parseCreatorInsights } from "./creatorParser";

export async function generateCreatorInsights(
  clip: ClipResult,
  textProvider: TextAIProvider
): Promise<CreatorInsights> {
  const result = await textProvider.generateText({
    systemPrompt: CREATOR_SYSTEM_PROMPT,
    prompt: buildCreatorPrompt(clip),
  });

  return parseCreatorInsights(result.text);
}
