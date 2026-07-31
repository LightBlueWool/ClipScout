import type { ClipResult, CreatorInsights } from "../types";

export function scoreClip(
  clip: ClipResult
): CreatorInsights {

  const confidence = Math.round(
    clip.overall_score ??
      (clip.relevance_score * 0.6 +
        clip.virality_score * 0.4)
  );

  const retention = Math.min(
    100,
    Math.round(
      confidence +
        clip.virality_score * 0.05
    )
  );

  const replay = Math.min(
    100,
    Math.round(
      clip.virality_score * 0.9
    )
  );

  const emotion = Math.min(
    100,
    Math.round(
      clip.virality_score * 0.85
    )
  );

  const action = Math.min(
    100,
    Math.round(
      clip.relevance_score * 0.95
    )
  );

  return {
    confidence,

    retention_score: retention,
    replay_value: replay,
    emotional_score: emotion,
    action_score: action,

    suggested_platform:
      choosePlatform(retention, action),

    suggested_title: clip.title,

    suggested_thumbnail_text:
      generateThumbnailText(clip.title),

    suggested_caption:
      generateCaption(clip),

    suggested_hashtags:
      generateHashtags(clip),
  };
}

function choosePlatform(
  retention: number,
  action: number
) {
  if (retention >= 90 && action >= 90)
    return "TikTok";

  if (action >= 80)
    return "YouTube Shorts";

  return "Instagram Reels";
}

function generateThumbnailText(
  title: string
) {
  return title.toUpperCase();
}

function generateCaption(
  clip: ClipResult
) {
  return `${clip.hook}\n\n${clip.description}`;
}

function generateHashtags(
  clip: ClipResult
) {
  const tags = [
    "#clips",
    "#gaming",
    "#viral",
  ];

  if (
    clip.title.toLowerCase().includes("kill")
  ) {
    tags.push("#fps");
  }

  return tags;
}