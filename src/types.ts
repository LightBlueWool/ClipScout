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
  creatorMetadata?: CreatorEnrichmentMetadata;
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

export type CreatorEnrichmentSource =
  | "ai"
  | "heuristic";

export type CreatorFallbackReason =
  | "provider_not_configured"
  | "provider_error"
  | "malformed_json"
  | "validation_failed"
  | "empty_response";

export interface CreatorEnrichmentMetadata {
  source: CreatorEnrichmentSource;
  provider: string;
  model?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  fallbackReason?: CreatorFallbackReason;
  attempts: number;
  requestId?: string;
  responseId?: string;
}

export interface CreatorEnrichmentSummary {
  clipsProcessed: number;
  aiSuccessCount: number;
  fallbackCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
  averageLatencyMs?: number;
}

export interface ClipAnalysis {
  objective: string;
  clips: ClipResult[];
  creatorSummary?: CreatorEnrichmentSummary;
}
