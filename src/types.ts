export interface ClipResult {
  start_time: number;
  end_time: number;

  title: string;
  description: string;

  relevance_score: number;
  virality_score: number;
  overall_score?: number;

  hook: string;
  reason: string;

  warnings: string[];

  creator?: CreatorInsights;
}

export interface CreatorInsights {
  confidence: number;

  retention_score: number;
  replay_value: number;
  emotional_score: number;
  action_score: number;

  suggested_platform: Platform;

  suggested_title: string;
  suggested_thumbnail_text: string;
  suggested_caption: string;

  suggested_hashtags: string[];
}

export type Platform =
  | "TikTok"
  | "YouTube Shorts"
  | "Instagram Reels";

export interface ClipAnalysis {
  objective: string;
  clips: ClipResult[];
}