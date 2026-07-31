import type { CreatorInsights } from "../types";
import {
  CreatorMalformedJsonError,
  CreatorValidationError,
} from "./creatorErrors";
import { validateCreatorInsights } from "./creatorValidator";

export function parseCreatorInsights(json: string): CreatorInsights {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripJsonCodeFence(json));
  } catch {
    throw new CreatorMalformedJsonError();
  }

  try {
    return validateCreatorInsights(parsed);
  } catch {
    throw new CreatorValidationError();
  }
}

function stripJsonCodeFence(value: string): string {
  const trimmed = value.trim();
  const fencedJson = trimmed.match(
    /^```(?:json)?\s*([\s\S]*?)\s*```$/i
  );

  return fencedJson?.[1]?.trim() ?? trimmed;
}
