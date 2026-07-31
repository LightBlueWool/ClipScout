import type {
  ClipResult,
  CreatorEnrichmentMetadata,
  CreatorEnrichmentSummary,
  CreatorEvaluation,
  CreatorEvaluationSummary,
  CreatorFallbackReason,
  CreatorInsightDifferences,
  CreatorInsights,
} from "../types";
import type { TextAIProvider } from "../ai/providers/types";
import { generateCreatorInsights } from "./creatorAI";
import {
  CreatorEmptyResponseError,
  CreatorMalformedJsonError,
  CreatorValidationError,
} from "./creatorErrors";
import { scoreClip } from "./scoreClips";

export interface EnrichClipsOptions {
  textProvider?: TextAIProvider;
  fallbackToHeuristic?: boolean;
  concurrency?: number;
  evaluationMode?: boolean;
}

export async function enrichClips(
  clips: ClipResult[],
  options: EnrichClipsOptions = {}
): Promise<ClipResult[]> {
  const fallbackToHeuristic = options.fallbackToHeuristic ?? true;
  const concurrency = normalizeConcurrency(options.concurrency);
  const enrichedClips = new Array<ClipResult>(clips.length);

  await runWithConcurrency(clips, concurrency, async (clip, index) => {
      if (!options.textProvider) {
        const heuristic = scoreClip(clip);

        console.log(
          `Creator intelligence ${index + 1}/${clips.length}: fallback (no text AI provider configured).`
        );

        enrichedClips[index] = {
          ...clip,
          creator: heuristic,
          creatorMetadata: createFallbackMetadata(
            "provider_not_configured",
            0
          ),
        };
        return;
      }

      const startedAt = Date.now();
      const heuristic = options.evaluationMode
        ? scoreClip(clip)
        : undefined;

      try {
        const generated = await generateCreatorInsights(
          clip,
          options.textProvider
        );
        const latencyMs = Date.now() - startedAt;

        enrichedClips[index] = {
          ...clip,
          creator: generated.insights,
          creatorMetadata: createAiMetadata(
            generated.generation,
            latencyMs
          ),
        };
        attachEvaluation(
          enrichedClips[index],
          heuristic,
          generated.insights
        );
        console.log(
          `Creator intelligence ${index + 1}/${clips.length}: AI (${latencyMs}ms).`
        );
      } catch (error) {
        if (!fallbackToHeuristic) {
          throw error;
        }

        const fallbackReason = classifyFallbackReason(error);
        const latencyMs = Date.now() - startedAt;

        console.log(
          `Creator intelligence ${index + 1}/${clips.length}: fallback (${fallbackReason}).`
        );

        enrichedClips[index] = {
          ...clip,
          creator: heuristic ?? scoreClip(clip),
          creatorMetadata: createFallbackMetadata(
            fallbackReason,
            latencyMs
          ),
        };
        attachEvaluation(
          enrichedClips[index],
          heuristic,
          undefined
        );
      }
    }
  );

  return enrichedClips;
}

export function summarizeCreatorEnrichment(
  clips: ClipResult[]
): CreatorEnrichmentSummary {
  const metadata = clips
    .map((clip) => clip.creatorMetadata)
    .filter((value): value is CreatorEnrichmentMetadata => value !== undefined);

  const aiSuccessCount = metadata.filter(
    (item) => item.source === "ai"
  ).length;
  const fallbackCount = metadata.filter(
    (item) => item.source === "heuristic"
  ).length;
  const totalInputTokens = sum(metadata, "inputTokens");
  const totalOutputTokens = sum(metadata, "outputTokens");
  const totalTokens = sum(metadata, "totalTokens");
  const knownCosts = metadata
    .map((item) => item.estimatedCostUsd)
    .filter((value): value is number => value !== undefined);
  const latencies = metadata
    .map((item) => item.latencyMs)
    .filter((value): value is number => value !== undefined);

  const summary: CreatorEnrichmentSummary = {
    clipsProcessed: clips.length,
    aiSuccessCount,
    fallbackCount,
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
  };

  if (knownCosts.length > 0) {
    summary.estimatedCostUsd = roundCost(
      knownCosts.reduce((total, cost) => total + cost, 0)
    );
  }

  if (latencies.length > 0) {
    summary.averageLatencyMs = Math.round(
      latencies.reduce((total, latency) => total + latency, 0) /
        latencies.length
    );
  }

  return summary;
}

export function summarizeCreatorEvaluation(
  clips: ClipResult[]
): CreatorEvaluationSummary | undefined {
  const evaluations = clips
    .map((clip) => clip.creatorEvaluation)
    .filter((value): value is CreatorEvaluation => value !== undefined);

  if (evaluations.length === 0) {
    return undefined;
  }

  const aiSuccessCount = evaluations.filter(
    (evaluation) => evaluation.aiSucceeded
  ).length;
  const platformAgreementCount = evaluations.filter(
    (evaluation) =>
      evaluation.aiSucceeded &&
      !evaluation.differences.platformChanged
  ).length;

  const summary: CreatorEvaluationSummary = {
    clipsCompared: evaluations.length,
    aiSuccessCount,
    platformAgreementCount,
    platformAgreementRate:
      aiSuccessCount === 0
        ? 0
        : platformAgreementCount / aiSuccessCount,
  };

  assignEvaluationAverage(
    summary,
    "averageConfidenceDelta",
    evaluations,
    "confidenceDelta"
  );
  assignEvaluationAverage(
    summary,
    "averageRetentionDelta",
    evaluations,
    "retentionScoreDelta"
  );
  assignEvaluationAverage(
    summary,
    "averageReplayDelta",
    evaluations,
    "replayValueDelta"
  );
  assignEvaluationAverage(
    summary,
    "averageEmotionalDelta",
    evaluations,
    "emotionalScoreDelta"
  );
  assignEvaluationAverage(
    summary,
    "averageActionDelta",
    evaluations,
    "actionScoreDelta"
  );

  return summary;
}

function attachEvaluation(
  clip: ClipResult,
  heuristic: CreatorInsights | undefined,
  ai: CreatorInsights | undefined
): void {
  if (!heuristic) {
    return;
  }

  const evaluation: CreatorEvaluation = {
    heuristic,
    differences: compareCreatorInsights(heuristic, ai),
    aiSucceeded: ai !== undefined,
  };

  if (ai !== undefined) {
    evaluation.ai = ai;
  }

  clip.creatorEvaluation = evaluation;
}

function compareCreatorInsights(
  heuristic: CreatorInsights,
  ai: CreatorInsights | undefined
): CreatorInsightDifferences {
  if (!ai) {
    return {
      platformChanged: false,
      titleChanged: false,
      captionChanged: false,
      thumbnailTextChanged: false,
      hashtagsChanged: false,
    };
  }

  return {
    confidenceDelta: ai.confidence - heuristic.confidence,
    retentionScoreDelta:
      ai.retention_score - heuristic.retention_score,
    replayValueDelta:
      ai.replay_value - heuristic.replay_value,
    emotionalScoreDelta:
      ai.emotional_score - heuristic.emotional_score,
    actionScoreDelta:
      ai.action_score - heuristic.action_score,
    platformChanged:
      ai.suggested_platform !== heuristic.suggested_platform,
    titleChanged:
      ai.suggested_title !== heuristic.suggested_title,
    captionChanged:
      ai.suggested_caption !== heuristic.suggested_caption,
    thumbnailTextChanged:
      ai.suggested_thumbnail_text !==
      heuristic.suggested_thumbnail_text,
    hashtagsChanged:
      ai.suggested_hashtags.join("\n") !==
      heuristic.suggested_hashtags.join("\n"),
  };
}

function createAiMetadata(
  generation: {
    provider?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    estimatedCostUsd?: number;
    requestId?: string;
    responseId?: string;
  },
  latencyMs: number
): CreatorEnrichmentMetadata {
  const metadata: CreatorEnrichmentMetadata = {
    source: "ai",
    provider: generation.provider ?? "unknown",
    attempts: 1,
    latencyMs,
  };

  assignIfDefined(metadata, "model", generation.model);
  assignIfDefined(metadata, "inputTokens", generation.inputTokens);
  assignIfDefined(metadata, "outputTokens", generation.outputTokens);
  assignIfDefined(metadata, "totalTokens", generation.totalTokens);
  assignIfDefined(
    metadata,
    "estimatedCostUsd",
    generation.estimatedCostUsd === undefined
      ? undefined
      : roundCost(generation.estimatedCostUsd)
  );
  assignIfDefined(metadata, "requestId", generation.requestId);
  assignIfDefined(metadata, "responseId", generation.responseId);

  return metadata;
}

function createFallbackMetadata(
  fallbackReason: CreatorFallbackReason,
  latencyMs: number
): CreatorEnrichmentMetadata {
  return {
    source: "heuristic",
    provider: "heuristic",
    latencyMs,
    fallbackReason,
    attempts:
      fallbackReason === "provider_not_configured"
        ? 0
        : 1,
  };
}

function classifyFallbackReason(error: unknown): CreatorFallbackReason {
  if (error instanceof CreatorEmptyResponseError) {
    return "empty_response";
  }

  if (error instanceof CreatorMalformedJsonError) {
    return "malformed_json";
  }

  if (error instanceof CreatorValidationError) {
    return "validation_failed";
  }

  return "provider_error";
}

function assignIfDefined<
  TKey extends keyof CreatorEnrichmentMetadata
>(
  metadata: CreatorEnrichmentMetadata,
  key: TKey,
  value: CreatorEnrichmentMetadata[TKey] | undefined
): void {
  if (value !== undefined) {
    metadata[key] = value;
  }
}

function assignEvaluationAverage(
  summary: CreatorEvaluationSummary,
  key: keyof Pick<
    CreatorEvaluationSummary,
    | "averageConfidenceDelta"
    | "averageRetentionDelta"
    | "averageReplayDelta"
    | "averageEmotionalDelta"
    | "averageActionDelta"
  >,
  evaluations: CreatorEvaluation[],
  differenceKey: keyof Pick<
    CreatorInsightDifferences,
    | "confidenceDelta"
    | "retentionScoreDelta"
    | "replayValueDelta"
    | "emotionalScoreDelta"
    | "actionScoreDelta"
  >
): void {
  const values = evaluations
    .map((evaluation) => evaluation.differences[differenceKey])
    .filter((value): value is number => value !== undefined);

  if (values.length === 0) {
    return;
  }

  summary[key] =
    Math.round(
      (values.reduce((total, value) => total + value, 0) /
        values.length) *
        100
    ) / 100;
}

function sum(
  metadata: CreatorEnrichmentMetadata[],
  key: "inputTokens" | "outputTokens" | "totalTokens"
): number {
  return metadata.reduce(
    (total, item) => total + (item[key] ?? 0),
    0
  );
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function normalizeConcurrency(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 3;
  }

  return Math.max(1, Math.floor(value));
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  handler: (item: T, index: number) => Promise<void>
): Promise<void> {
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      const item = items[currentIndex];

      if (item !== undefined) {
        await handler(item, currentIndex);
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, () => worker())
  );
}
