import type { ClipAnalysis } from "./types";
import { validateAnalysis } from "./validator";

export function parseAnalysis(json: string): ClipAnalysis {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      "ClipScout could not parse the AI response as valid JSON."
    );
  }

  return validateAnalysis(parsed);
}