import type { ClipAnalysis, ClipResult } from "./types";

export function validateAnalysis(value: unknown): ClipAnalysis {
  if (!isRecord(value)) {
    throw new Error("Analysis must be a JSON object.");
  }

  const objective = validateNonEmptyString(
    value.objective,
    "Analysis objective"
  );

  if (!Array.isArray(value.clips)) {
    throw new Error("Analysis clips must be an array.");
  }

  const clips = value.clips.map((clip, index) =>
    validateClip(clip, index)
  );

  return {
    objective,
    clips,
  };
}

function validateClip(value: unknown, index: number): ClipResult {
  const label = `Clip #${index + 1}`;

  if (!isRecord(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  const startTime = validateFiniteNumber(
    value.start_time,
    `${label} start_time`
  );

  const endTime = validateFiniteNumber(
    value.end_time,
    `${label} end_time`
  );

  if (startTime < 0) {
    throw new Error(`${label} start_time cannot be negative.`);
  }

  if (endTime <= startTime) {
    throw new Error(
      `${label} end_time must be greater than start_time.`
    );
  }

  const relevanceScore = validateScore(
    value.relevance_score,
    `${label} relevance_score`
  );

  const viralityScore = validateScore(
    value.virality_score,
    `${label} virality_score`
  );

  if (!Array.isArray(value.warnings)) {
    throw new Error(`${label} warnings must be an array.`);
  }

  const warnings = value.warnings.map((warning, warningIndex) =>
    validateNonEmptyString(
      warning,
      `${label} warning #${warningIndex + 1}`
    )
  );

  return {
    start_time: startTime,
    end_time: endTime,
    title: validateNonEmptyString(value.title, `${label} title`),
    description: validateNonEmptyString(
      value.description,
      `${label} description`
    ),
    relevance_score: relevanceScore,
    virality_score: viralityScore,
    hook: validateNonEmptyString(value.hook, `${label} hook`),
    reason: validateNonEmptyString(value.reason, `${label} reason`),
    warnings,
  };
}

function validateScore(value: unknown, label: string): number {
  const score = validateFiniteNumber(value, label);

  if (!Number.isInteger(score)) {
    throw new Error(`${label} must be an integer.`);
  }

  if (score < 1 || score > 100) {
    throw new Error(`${label} must be between 1 and 100.`);
  }

  return score;
}

function validateFiniteNumber(
  value: unknown,
  label: string
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  return value;
}

function validateNonEmptyString(
  value: unknown,
  label: string
): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${label} cannot be empty.`);
  }

  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}