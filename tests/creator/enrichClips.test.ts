import assert from "node:assert/strict";
import test from "node:test";
import type { TextAIProvider } from "../../src/ai/providers/types";
import { OpenAITextProvider } from "../../src/ai/providers/openAITextProvider";
import {
  enrichClips,
  summarizeCreatorEnrichment,
  summarizeCreatorEvaluation,
} from "../../src/creator/enrichClips";
import type { ClipResult, CreatorInsights } from "../../src/types";

test("uses valid AI response", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips([createClip("First")], {
      textProvider: createProvider([
        fencedJson(createInsights({ suggested_title: "AI First" })),
      ]),
    });

    assert.equal(clips[0]?.creator?.suggested_title, "AI First");
    assert.equal(clips[0]?.creatorMetadata?.source, "ai");
    assert.equal(clips[0]?.creatorMetadata?.provider, "mock");
    assert.equal(clips[0]?.creatorMetadata?.model, "mock-model");
    assert.equal(clips[0]?.creatorMetadata?.inputTokens, 100);
    assert.equal(clips[0]?.creatorMetadata?.outputTokens, 20);
    assert.equal(clips[0]?.creatorMetadata?.totalTokens, 120);
    assert.deepEqual(clips[0]?.creator?.suggested_hashtags, [
      "#clipscout",
      "#viral",
    ]);
  });
});

test("falls back for malformed JSON", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips([createClip("Malformed")], {
      textProvider: createProvider(["not-json"]),
    });

    assert.equal(clips[0]?.creator?.suggested_title, "Malformed");
    assert.equal(
      clips[0]?.creatorMetadata?.fallbackReason,
      "malformed_json"
    );
  });
});

test("falls back for invalid scores", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips([createClip("Invalid Score")], {
      textProvider: createProvider([
        JSON.stringify(createInsights({ confidence: 101 })),
      ]),
    });

    assert.equal(clips[0]?.creator?.suggested_title, "Invalid Score");
    assert.equal(
      clips[0]?.creatorMetadata?.fallbackReason,
      "validation_failed"
    );
  });
});

test("falls back for provider exception", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips([createClip("Provider Error")], {
      textProvider: createProvider([new Error("request failed")]),
    });

    assert.equal(clips[0]?.creator?.suggested_title, "Provider Error");
    assert.equal(
      clips[0]?.creatorMetadata?.fallbackReason,
      "provider_error"
    );
    assert.equal(
      JSON.stringify(clips[0]?.creatorMetadata).includes("request failed"),
      false
    );
  });
});

test("returns mixed AI and fallback results in original order", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips(
      [
        createClip("One"),
        createClip("Two"),
        createClip("Three"),
      ],
      {
        concurrency: 3,
        textProvider: createProvider([
          JSON.stringify(createInsights({ suggested_title: "AI One" })),
          new Error("request failed"),
          JSON.stringify(createInsights({ suggested_title: "AI Three" })),
        ]),
      }
    );

    assert.deepEqual(
      clips.map((clip) => clip.creator?.suggested_title),
      ["AI One", "Two", "AI Three"]
    );
  });
});

test("limits creator AI concurrency to three requests", async () => {
  await withQuietConsole(async () => {
    let activeRequests = 0;
    let maxActiveRequests = 0;

    const textProvider: TextAIProvider = {
      async generateText() {
        activeRequests += 1;
        maxActiveRequests = Math.max(
          maxActiveRequests,
          activeRequests
        );

        await new Promise((resolve) =>
          setTimeout(resolve, 10)
        );

        activeRequests -= 1;

        return {
          text: JSON.stringify(createInsights()),
        };
      },
    };

    await enrichClips(
      [
        createClip("One"),
        createClip("Two"),
        createClip("Three"),
        createClip("Four"),
        createClip("Five"),
      ],
      { textProvider }
    );

    assert.equal(maxActiveRequests, 3);
  });
});

test("adds heuristic metadata when no provider is configured", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips([createClip("Heuristic")]);

    assert.equal(clips[0]?.creatorMetadata?.source, "heuristic");
    assert.equal(clips[0]?.creatorMetadata?.provider, "heuristic");
    assert.equal(
      clips[0]?.creatorMetadata?.fallbackReason,
      "provider_not_configured"
    );
    assert.equal(clips[0]?.creatorMetadata?.attempts, 0);
  });
});

test("summarizes aggregate creator usage totals", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips(
      [createClip("One"), createClip("Two")],
      {
        textProvider: createProvider([
          {
            text: JSON.stringify(
              createInsights({ suggested_title: "AI One" })
            ),
            estimatedCostUsd: 0.00042,
          },
          new Error("sensitive provider detail"),
        ]),
      }
    );

    const summary = summarizeCreatorEnrichment(clips);

    assert.equal(summary.clipsProcessed, 2);
    assert.equal(summary.aiSuccessCount, 1);
    assert.equal(summary.fallbackCount, 1);
    assert.equal(summary.totalInputTokens, 100);
    assert.equal(summary.totalOutputTokens, 20);
    assert.equal(summary.totalTokens, 120);
    assert.equal(summary.estimatedCostUsd, 0.00042);
    assert.equal(typeof summary.averageLatencyMs, "number");
  });
});

test("leaves OpenAI estimated cost undefined without pricing configuration", async () => {
  const provider = new OpenAITextProvider({
    apiKey: "test-key",
    model: "test-model",
    client: createOpenAIClient(),
  });

  const result = await provider.generateText({
    prompt: "redacted prompt",
  });

  assert.equal(result.estimatedCostUsd, undefined);
});

test("calculates OpenAI estimated cost with configured pricing", async () => {
  const provider = new OpenAITextProvider({
    apiKey: "test-key",
    model: "test-model",
    inputCostPerMillion: 2,
    outputCostPerMillion: 10,
    client: createOpenAIClient(),
  });

  const result = await provider.generateText({
    prompt: "redacted prompt",
  });

  assert.equal(result.inputTokens, 1000);
  assert.equal(result.outputTokens, 200);
  assert.equal(result.totalTokens, 1200);
  assert.equal(result.estimatedCostUsd, 0.004);
});

test("omits evaluation fields when evaluation mode is disabled", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips([createClip("Disabled")], {
      textProvider: createProvider([
        JSON.stringify(createInsights({ suggested_title: "AI Disabled" })),
      ]),
    });

    assert.equal(clips[0]?.creator?.suggested_title, "AI Disabled");
    assert.equal(clips[0]?.creatorEvaluation, undefined);
    assert.equal(summarizeCreatorEvaluation(clips), undefined);
  });
});

test("adds successful AI comparison in evaluation mode", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips([createClip("Compared")], {
      evaluationMode: true,
      textProvider: createProvider([
        JSON.stringify(
          createInsights({
            confidence: 92,
            retention_score: 96,
            replay_value: 80,
            emotional_score: 75,
            action_score: 91,
            suggested_platform: "TikTok",
            suggested_title: "AI Compared",
          })
        ),
      ]),
    });

    const evaluation = clips[0]?.creatorEvaluation;

    assert.equal(clips[0]?.creator?.suggested_title, "AI Compared");
    assert.equal(evaluation?.aiSucceeded, true);
    assert.equal(evaluation?.heuristic.suggested_platform, "YouTube Shorts");
    assert.equal(evaluation?.ai?.suggested_platform, "TikTok");
    assert.equal(evaluation?.differences.confidenceDelta, 6);
    assert.equal(evaluation?.differences.retentionScoreDelta, 6);
    assert.equal(evaluation?.differences.replayValueDelta, 8);
    assert.equal(evaluation?.differences.emotionalScoreDelta, 7);
    assert.equal(evaluation?.differences.actionScoreDelta, 5);
    assert.equal(evaluation?.differences.platformChanged, true);
  });
});

test("keeps heuristic fallback and comparison when AI fails in evaluation mode", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips([createClip("Evaluation Failure")], {
      evaluationMode: true,
      textProvider: createProvider([new Error("raw sensitive error")]),
    });

    assert.equal(clips[0]?.creator?.suggested_title, "Evaluation Failure");
    assert.equal(clips[0]?.creatorEvaluation?.ai, undefined);
    assert.equal(clips[0]?.creatorEvaluation?.aiSucceeded, false);
    assert.equal(
      clips[0]?.creatorMetadata?.fallbackReason,
      "provider_error"
    );
    assert.equal(
      JSON.stringify(clips[0]).includes("raw sensitive error"),
      false
    );
  });
});

test("tracks platform agreement in evaluation summary", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips([createClip("Agreement")], {
      evaluationMode: true,
      textProvider: createProvider([
        JSON.stringify(
          createInsights({
            suggested_platform: "YouTube Shorts",
          })
        ),
      ]),
    });

    const summary = summarizeCreatorEvaluation(clips);

    assert.equal(
      clips[0]?.creatorEvaluation?.differences.platformChanged,
      false
    );
    assert.equal(summary?.platformAgreementCount, 1);
    assert.equal(summary?.platformAgreementRate, 1);
  });
});

test("tracks platform disagreement in evaluation summary", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips([createClip("Disagreement")], {
      evaluationMode: true,
      textProvider: createProvider([
        JSON.stringify(
          createInsights({
            suggested_platform: "Instagram Reels",
          })
        ),
      ]),
    });

    const summary = summarizeCreatorEvaluation(clips);

    assert.equal(
      clips[0]?.creatorEvaluation?.differences.platformChanged,
      true
    );
    assert.equal(summary?.platformAgreementCount, 0);
    assert.equal(summary?.platformAgreementRate, 0);
  });
});

test("summarizes aggregate evaluation deltas", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips(
      [createClip("One"), createClip("Two")],
      {
        evaluationMode: true,
        textProvider: createProvider([
          JSON.stringify(
            createInsights({
              confidence: 96,
              retention_score: 94,
              replay_value: 78,
              emotional_score: 74,
              action_score: 90,
              suggested_platform: "YouTube Shorts",
            })
          ),
          JSON.stringify(
            createInsights({
              confidence: 88,
              retention_score: 86,
              replay_value: 70,
              emotional_score: 66,
              action_score: 82,
              suggested_platform: "TikTok",
            })
          ),
        ]),
      }
    );

    const summary = summarizeCreatorEvaluation(clips);

    assert.equal(summary?.clipsCompared, 2);
    assert.equal(summary?.aiSuccessCount, 2);
    assert.equal(summary?.platformAgreementCount, 1);
    assert.equal(summary?.platformAgreementRate, 0.5);
    assert.equal(summary?.averageConfidenceDelta, 6);
    assert.equal(summary?.averageRetentionDelta, 0);
    assert.equal(summary?.averageReplayDelta, 2);
    assert.equal(summary?.averageEmotionalDelta, 2);
    assert.equal(summary?.averageActionDelta, 0);
  });
});

test("preserves clip ordering in evaluation mode", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips(
      [createClip("One"), createClip("Two"), createClip("Three")],
      {
        evaluationMode: true,
        textProvider: createProvider([
          JSON.stringify(createInsights({ suggested_title: "AI One" })),
          JSON.stringify(createInsights({ suggested_title: "AI Two" })),
          JSON.stringify(createInsights({ suggested_title: "AI Three" })),
        ]),
      }
    );

    assert.deepEqual(
      clips.map((clip) => clip.creator?.suggested_title),
      ["AI One", "AI Two", "AI Three"]
    );
  });
});

test("does not make additional AI calls in evaluation mode", async () => {
  await withQuietConsole(async () => {
    let calls = 0;
    const textProvider: TextAIProvider = {
      async generateText() {
        calls += 1;

        return {
          text: JSON.stringify(createInsights()),
        };
      },
    };

    await enrichClips(
      [createClip("One"), createClip("Two"), createClip("Three")],
      {
        evaluationMode: true,
        textProvider,
      }
    );

    assert.equal(calls, 3);
  });
});

function createProvider(
  responses: Array<
    string | Error | Awaited<ReturnType<TextAIProvider["generateText"]>>
  >
): TextAIProvider {
  let callIndex = 0;

  return {
    async generateText() {
      const response = responses[callIndex];
      callIndex += 1;

      if (response instanceof Error) {
        throw response;
      }

      if (response === undefined) {
        throw new Error("No mock response configured.");
      }

      if (typeof response !== "string") {
        return {
          provider: "mock",
          model: "mock-model",
          inputTokens: 100,
          outputTokens: 20,
          totalTokens: 120,
          responseId: "mock-response-id",
          ...response,
        };
      }

      return {
        provider: "mock",
        model: "mock-model",
        inputTokens: 100,
        outputTokens: 20,
        totalTokens: 120,
        responseId: "mock-response-id",
        text: response,
      };
    },
  };
}

function createOpenAIClient() {
  return {
    responses: {
      async create() {
        return {
          id: "resp_test",
          model: "test-model",
          output_text: JSON.stringify(createInsights()),
          usage: {
            input_tokens: 1000,
            output_tokens: 200,
            total_tokens: 1200,
          },
        };
      },
    },
  };
}

function createClip(title: string): ClipResult {
  return {
    start_time: 10,
    end_time: 25,
    title,
    description: `${title} description`,
    relevance_score: 90,
    virality_score: 80,
    overall_score: 86,
    hook: `${title} hook`,
    reason: `${title} reason`,
    warnings: [],
  };
}

function createInsights(
  overrides: Partial<CreatorInsights> = {}
): CreatorInsights {
  return {
    confidence: 90,
    retention_score: 88,
    replay_value: 82,
    emotional_score: 80,
    action_score: 84,
    suggested_platform: "TikTok",
    suggested_title: "AI Title",
    suggested_thumbnail_text: "WATCH THIS",
    suggested_caption: "A creator-ready caption.",
    suggested_hashtags: ["ClipScout", "#Viral"],
    ...overrides,
  };
}

function fencedJson(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value)}\n\`\`\``;
}

async function withQuietConsole(
  callback: () => Promise<void>
): Promise<void> {
  const originalLog = console.log;
  const originalWarn = console.warn;

  console.log = () => undefined;
  console.warn = () => undefined;

  try {
    await callback();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}
