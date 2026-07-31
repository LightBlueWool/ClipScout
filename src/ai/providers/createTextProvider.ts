import type { TextAIProvider } from "./types";
import {
  DEFAULT_OPENAI_TEXT_MODEL,
  OpenAITextProvider,
} from "./openAITextProvider";

export type TextProviderName = "openai";

export interface CreateTextProviderOptions {
  env?: NodeJS.ProcessEnv;
}

export function createTextProvider(
  options: CreateTextProviderOptions = {}
): TextAIProvider | undefined {
  const env = options.env ?? process.env;
  const provider = env.TEXT_AI_PROVIDER?.trim().toLowerCase();

  if (!provider) {
    console.log(
      "Creator intelligence: using heuristic fallback (TEXT_AI_PROVIDER is not configured)."
    );
    return undefined;
  }

  if (provider !== "openai") {
    console.warn(
      `Creator intelligence: using heuristic fallback (unsupported TEXT_AI_PROVIDER "${provider}").`
    );
    return undefined;
  }

  const apiKey = env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    console.warn(
      "Creator intelligence: using heuristic fallback (OPENAI_API_KEY is missing)."
    );
    return undefined;
  }

  const model =
    env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_TEXT_MODEL;

  console.log(
    `Creator intelligence: using OpenAI text provider (${model}).`
  );

  return new OpenAITextProvider({
    apiKey,
    model,
  });
}
