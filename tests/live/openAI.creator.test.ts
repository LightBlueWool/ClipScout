import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import type { TextAIProvider } from "../../src/ai/providers/types";
import { createTextProvider } from "../../src/ai/providers/createTextProvider";
import { enrichClips } from "../../src/creator/enrichClips";
import {
  DEFAULT_CREATOR_EVALUATION_FIXTURE,
  loadCreatorEvaluationFixture,
} from "../../src/creator/evaluationFixture";
import type { CreatorInsights } from "../../src/types";

const skipReason = getLiveOpenAISkipReason();

test(
  "live OpenAI creator intelligence generates one validated response",
  { skip: skipReason },
  async () => {
    const fixture = loadCreatorEvaluationFixture(
      process.env.CREATOR_EVALUATION_FIXTURE ||
        DEFAULT_CREATOR_EVALUATION_FIXTURE
    );
    const provider = createRequiredProvider();
    const guardedProvider = createSingleRequestProvider(provider);

    const clips = await withQuietConsole(() =>
      enrichClips([fixture.clip], {
        textProvider: guardedProvider,
        evaluationMode: true,
        concurrency: 1,
      })
    );
    const clip = clips[0];

    assert.equal(guardedProvider.requestCount, 1);
    assert.ok(clip);
    assert.ok(clip.creator);
    assertCreatorInsights(clip.creator);
    assert.equal(clip.creatorMetadata?.source, "ai");
    assert.equal(clip.creatorMetadata?.provider, "openai");
    assert.equal(typeof clip.creatorMetadata?.model, "string");
    assert.equal(typeof clip.creatorMetadata?.latencyMs, "number");
    assert.equal(clip.creatorMetadata?.attempts, 1);

    if (clip.creatorMetadata?.inputTokens !== undefined) {
      assert.equal(typeof clip.creatorMetadata.inputTokens, "number");
    }

    if (clip.creatorMetadata?.outputTokens !== undefined) {
      assert.equal(typeof clip.creatorMetadata.outputTokens, "number");
    }

    if (clip.creatorMetadata?.totalTokens !== undefined) {
      assert.equal(typeof clip.creatorMetadata.totalTokens, "number");
    }

    assert.ok(clip.creatorEvaluation);
    assert.equal(clip.creatorEvaluation.aiSucceeded, true);
  }
);

function getLiveOpenAISkipReason(): string | false {
  if (process.env.ENABLE_LIVE_OPENAI_TESTS !== "true") {
    return "ENABLE_LIVE_OPENAI_TESTS is not true.";
  }

  if (process.env.TEXT_AI_PROVIDER?.trim().toLowerCase() !== "openai") {
    return "TEXT_AI_PROVIDER is not openai.";
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return "OPENAI_API_KEY is missing.";
  }

  return false;
}

function createRequiredProvider(): TextAIProvider {
  const provider = createTextProvider();

  if (!provider) {
    throw new Error("OpenAI text provider was not configured.");
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
        throw new Error("Live test attempted more than one OpenAI request.");
      }

      return textProvider.generateText(request);
    },
  } satisfies TextAIProvider & { readonly requestCount: number };
}

function assertCreatorInsights(insights: CreatorInsights): void {
  assertScore(insights.confidence);
  assertScore(insights.retention_score);
  assertScore(insights.replay_value);
  assertScore(insights.emotional_score);
  assertScore(insights.action_score);
  assert.ok(insights.suggested_platform);
  assert.ok(insights.suggested_title);
  assert.ok(insights.suggested_thumbnail_text);
  assert.ok(insights.suggested_caption);
  assert.ok(insights.suggested_hashtags.length > 0);

  for (const hashtag of insights.suggested_hashtags) {
    assert.match(hashtag, /^#[^\s]+$/);
    assert.equal(hashtag, hashtag.toLowerCase());
  }
}

function assertScore(value: number): void {
  assert.equal(Number.isInteger(value), true);
  assert.equal(value >= 1, true);
  assert.equal(value <= 100, true);
}

async function withQuietConsole<T>(
  callback: () => Promise<T>
): Promise<T> {
  const originalLog = console.log;
  const originalWarn = console.warn;

  console.log = () => undefined;
  console.warn = () => undefined;

  try {
    return await callback();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}
