import assert from "node:assert/strict";
import test from "node:test";
import type { TextAIProvider } from "../../src/ai/providers/types";
import { enrichClips } from "../../src/creator/enrichClips";
import type { ClipResult, CreatorInsights } from "../../src/types";

test("uses valid AI response", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips([createClip("First")], {
      textProvider: createProvider([
        fencedJson(createInsights({ suggested_title: "AI First" })),
      ]),
    });

    assert.equal(clips[0]?.creator?.suggested_title, "AI First");
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
  });
});

test("falls back for provider exception", async () => {
  await withQuietConsole(async () => {
    const clips = await enrichClips([createClip("Provider Error")], {
      textProvider: createProvider([new Error("request failed")]),
    });

    assert.equal(clips[0]?.creator?.suggested_title, "Provider Error");
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

function createProvider(
  responses: Array<string | Error>
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

      return {
        text: response,
      };
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
