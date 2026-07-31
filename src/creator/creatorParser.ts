import type { CreatorInsights } from "../types";
import { validateCreatorInsights } from "./creatorValidator";

export function parseCreatorInsights(json: string): CreatorInsights {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripJsonCodeFence(json));
  } catch {
    throw new Error(
      "ClipScout could not parse the creator AI response as valid JSON."
    );
  }

  return validateCreatorInsights(parsed);
}

function stripJsonCodeFence(value: string): string {
  const trimmed = value.trim();
  const fencedJson = trimmed.match(
    /^```(?:json)?\s*([\s\S]*?)\s*```$/i
  );

  return fencedJson?.[1]?.trim() ?? trimmed;
}
