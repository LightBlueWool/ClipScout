import type { ClipResult } from "../types";

export const CREATOR_SYSTEM_PROMPT =
  "You are ClipScout's creator intelligence engine. Return valid JSON only.";

export function buildCreatorPrompt(clip: ClipResult): string {
  return `
Analyze this selected video clip for short-form creator strategy.

Clip:
${JSON.stringify(
  {
    start_time: clip.start_time,
    end_time: clip.end_time,
    title: clip.title,
    description: clip.description,
    relevance_score: clip.relevance_score,
    virality_score: clip.virality_score,
    overall_score: clip.overall_score,
    hook: clip.hook,
    reason: clip.reason,
    warnings: clip.warnings,
  },
  null,
  2
)}

Return exactly this JSON shape:

{
  "confidence": 90,
  "retention_score": 90,
  "replay_value": 85,
  "emotional_score": 80,
  "action_score": 75,
  "suggested_platform": "TikTok",
  "suggested_title": "Short title for the clip",
  "suggested_thumbnail_text": "3 to 6 punchy words",
  "suggested_caption": "A caption a creator could post with this clip",
  "suggested_hashtags": ["#example", "#clip"]
}

Rules:
- Scores must be integers from 1 to 100.
- suggested_platform must be one of: TikTok, YouTube Shorts, Instagram Reels.
- Base recommendations only on the provided clip facts.
- Do not invent events, names, outcomes, or claims that are not supported by the clip.
- Use concise, creator-ready language.
- Return JSON only. Do not include Markdown or commentary.
`.trim();
}
