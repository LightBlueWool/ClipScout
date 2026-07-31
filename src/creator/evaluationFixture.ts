import fs from "node:fs";
import path from "node:path";
import type { ClipAnalysis, ClipResult } from "../types";
import { validateAnalysis } from "../validator";

export const DEFAULT_CREATOR_EVALUATION_FIXTURE =
  "tests/fixtures/creatorClip.json";

export interface CreatorEvaluationFixture {
  objective: string;
  clip: ClipResult;
  fixturePath: string;
}

export function loadCreatorEvaluationFixture(
  fixturePath = DEFAULT_CREATOR_EVALUATION_FIXTURE
): CreatorEvaluationFixture {
  const resolvedPath = path.resolve(fixturePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Creator evaluation fixture not found: ${resolvedPath}`);
  }

  const raw = fs.readFileSync(resolvedPath, "utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Creator evaluation fixture must be valid JSON.");
  }

  const analysis = validateFixtureAnalysis(parsed);

  if (analysis.clips.length !== 1) {
    throw new Error(
      "Creator evaluation fixture must contain exactly one clip."
    );
  }

  const clip = analysis.clips[0];

  if (!clip) {
    throw new Error("Creator evaluation fixture did not include a clip.");
  }

  return {
    objective: analysis.objective,
    clip,
    fixturePath: resolvedPath,
  };
}

function validateFixtureAnalysis(value: unknown): ClipAnalysis {
  try {
    return validateAnalysis(value);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Creator evaluation fixture is invalid: ${error.message}`
      );
    }

    throw new Error("Creator evaluation fixture is invalid.");
  }
}
