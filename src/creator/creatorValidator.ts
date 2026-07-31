import type { CreatorInsights, Platform } from "../types";

const PLATFORMS = new Set<Platform>([
  "TikTok",
  "YouTube Shorts",
  "Instagram Reels",
]);

export function validateCreatorInsights(
  value: unknown
): CreatorInsights {
  if (!isRecord(value)) {
    throw new Error("Creator insights must be a JSON object.");
  }

  return {
    confidence: validateScore(value.confidence, "confidence"),
    retention_score: validateScore(
      value.retention_score,
      "retention_score"
    ),
    replay_value: validateScore(value.replay_value, "replay_value"),
    emotional_score: validateScore(
      value.emotional_score,
      "emotional_score"
    ),
    action_score: validateScore(value.action_score, "action_score"),
    suggested_platform: validatePlatform(value.suggested_platform),
    suggested_title: validateNonEmptyString(
      value.suggested_title,
      "suggested_title"
    ),
    suggested_thumbnail_text: validateNonEmptyString(
      value.suggested_thumbnail_text,
      "suggested_thumbnail_text"
    ),
    suggested_caption: validateNonEmptyString(
      value.suggested_caption,
      "suggested_caption"
    ),
    suggested_hashtags: validateHashtags(value.suggested_hashtags),
  };
}

function validatePlatform(value: unknown): Platform {
  if (typeof value !== "string" || !PLATFORMS.has(value as Platform)) {
    throw new Error(
      "suggested_platform must be TikTok, YouTube Shorts, or Instagram Reels."
    );
  }

  return value as Platform;
}

function validateHashtags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error("suggested_hashtags must be an array.");
  }

  return value.map((hashtag, index) =>
    normalizeHashtag(
      validateNonEmptyString(
        hashtag,
        `suggested_hashtags #${index + 1}`
      )
    )
  );
}

function normalizeHashtag(value: string): string {
  const tag = value
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, "")
    .toLowerCase();

  if (!tag) {
    throw new Error("suggested_hashtags cannot contain empty hashtags.");
  }

  return `#${tag}`;
}

function validateScore(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }

  if (value < 1 || value > 100) {
    throw new Error(`${label} must be between 1 and 100.`);
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
