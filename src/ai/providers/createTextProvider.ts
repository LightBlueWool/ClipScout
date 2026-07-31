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

  const providerOptions = {
    apiKey,
    model,
  };
  const inputCostPerMillion = parseOptionalCost(
    env.OPENAI_INPUT_COST_PER_MILLION
  );
  const outputCostPerMillion = parseOptionalCost(
    env.OPENAI_OUTPUT_COST_PER_MILLION
  );

  if (inputCostPerMillion !== undefined) {
    Object.assign(providerOptions, { inputCostPerMillion });
  }

  if (outputCostPerMillion !== undefined) {
    Object.assign(providerOptions, { outputCostPerMillion });
  }

  return new OpenAITextProvider(providerOptions);
}

function parseOptionalCost(value: string | undefined): number | undefined {
  if (value === undefined || !value.trim()) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    console.warn(
      "Creator intelligence: ignoring invalid OpenAI pricing configuration."
    );
    return undefined;
  }

  return parsed;
}
