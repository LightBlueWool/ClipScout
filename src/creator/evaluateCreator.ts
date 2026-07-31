import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import type { TextAIProvider } from "../ai/providers/types";
import { createTextProvider } from "../ai/providers/createTextProvider";
import type { ClipResult } from "../types";
import {
  enrichClips,
  summarizeCreatorEnrichment,
  summarizeCreatorEvaluation,
} from "./enrichClips";
import {
  DEFAULT_CREATOR_EVALUATION_FIXTURE,
  loadCreatorEvaluationFixture,
} from "./evaluationFixture";

async function main(): Promise<void> {
  assertLiveOptIn();

  const fixture = loadCreatorEvaluationFixture(
    process.env.CREATOR_EVALUATION_FIXTURE ||
      DEFAULT_CREATOR_EVALUATION_FIXTURE
  );
  const textProvider = createRequiredTextProvider();
  const guardedProvider = createSingleRequestProvider(textProvider);

  const [enrichedClip] = await enrichClips([fixture.clip], {
    textProvider: guardedProvider,
    evaluationMode: true,
    concurrency: 1,
  });

  if (!enrichedClip) {
    throw new Error("Creator evaluation did not produce a clip.");
  }

  if (guardedProvider.requestCount !== 1) {
    throw new Error(
      `Creator evaluation expected exactly one provider request, got ${guardedProvider.requestCount}.`
    );
  }

  const creatorSummary = summarizeCreatorEnrichment([enrichedClip]);
  const creatorEvaluationSummary =
    summarizeCreatorEvaluation([enrichedClip]);
  const outputPath = saveEvaluationResult({
    objective: fixture.objective,
    fixturePath: fixture.fixturePath,
    clip: enrichedClip,
    creatorSummary,
    creatorEvaluationSummary,
  });

  printEvaluation(enrichedClip, outputPath);
}

function assertLiveOptIn(): void {
  if (process.env.ENABLE_LIVE_OPENAI_TESTS !== "true") {
    throw new Error(
      "Refusing to run live creator evaluation. Set ENABLE_LIVE_OPENAI_TESTS=true to opt in."
    );
  }
}

function createRequiredTextProvider(): TextAIProvider {
  if (process.env.TEXT_AI_PROVIDER?.trim().toLowerCase() !== "openai") {
    throw new Error(
      "Creator evaluation requires TEXT_AI_PROVIDER=openai."
    );
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("Creator evaluation requires OPENAI_API_KEY.");
  }

  const provider = createTextProvider();

  if (!provider) {
    throw new Error("Creator evaluation text provider was not configured.");
  }

  return provider;
}

function createSingleRequestProvider(textProvider: TextAIProvider) {
  let requestCount = 0;

  return {
    get requestCount() {
      return requestCount;
    },
    async generateText(request) {
      requestCount += 1;

      if (requestCount > 1) {
        throw new Error(
          "Creator evaluation attempted more than one provider request."
        );
      }

      return textProvider.generateText(request);
    },
  } satisfies TextAIProvider & { readonly requestCount: number };
}

function saveEvaluationResult(value: unknown): string {
  const outputFolder = path.resolve("results", "evaluations");
  fs.mkdirSync(outputFolder, { recursive: true });

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
  const outputPath = path.join(outputFolder, `${timestamp}.json`);

  fs.writeFileSync(
    outputPath,
    JSON.stringify(value, null, 2),
    "utf8"
  );

  return outputPath;
}

function printEvaluation(clip: ClipResult, outputPath: string): void {
  const evaluation = clip.creatorEvaluation;
  const metadata = clip.creatorMetadata;

  if (!clip.creator || !evaluation) {
    throw new Error("Creator evaluation data was not produced.");
  }

  console.log("\nCreator evaluation");
  console.log("==================");
  console.log(`Clip: ${clip.title}`);
  console.log("\nHeuristic recommendation:");
  console.log(`Platform: ${evaluation.heuristic.suggested_platform}`);
  console.log(`Title: ${evaluation.heuristic.suggested_title}`);
  console.log(`Thumbnail: ${evaluation.heuristic.suggested_thumbnail_text}`);
  console.log(`Hashtags: ${evaluation.heuristic.suggested_hashtags.join(" ")}`);

  console.log("\nAI recommendation:");
  console.log(`Platform: ${clip.creator.suggested_platform}`);
  console.log(`Title: ${clip.creator.suggested_title}`);
  console.log(`Thumbnail: ${clip.creator.suggested_thumbnail_text}`);
  console.log(`Hashtags: ${clip.creator.suggested_hashtags.join(" ")}`);

  console.log("\nScore deltas:");
  printDelta("Confidence", evaluation.differences.confidenceDelta);
  printDelta("Retention", evaluation.differences.retentionScoreDelta);
  printDelta("Replay", evaluation.differences.replayValueDelta);
  printDelta("Emotional", evaluation.differences.emotionalScoreDelta);
  printDelta("Action", evaluation.differences.actionScoreDelta);

  console.log(
    `\nPlatform difference: ${
      evaluation.differences.platformChanged ? "changed" : "same"
    }`
  );

  if (metadata?.latencyMs !== undefined) {
    console.log(`Latency: ${metadata.latencyMs}ms`);
  }

  console.log(
    `Token usage: ${metadata?.totalTokens ?? 0} total (${metadata?.inputTokens ?? 0} in, ${metadata?.outputTokens ?? 0} out)`
  );

  if (metadata?.estimatedCostUsd !== undefined) {
    console.log(`Estimated cost: $${metadata.estimatedCostUsd.toFixed(6)}`);
  }

  console.log(`\nSaved evaluation: ${outputPath}`);
}

function printDelta(label: string, value: number | undefined): void {
  if (value === undefined) {
    console.log(`${label}: n/a`);
    return;
  }

  console.log(`${label}: ${value > 0 ? `+${value}` : value}`);
}

main().catch((error: unknown) => {
  console.error("\nCreator evaluation failed:");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Unknown error.");
  }

  process.exit(1);
});
