import OpenAI from "openai";
import type {
  TextAIProvider,
  TextGenerationRequest,
  TextGenerationResult,
} from "./types";

export const DEFAULT_OPENAI_TEXT_MODEL = "gpt-5.5";

interface ResponsesClient {
  responses: {
    create(
      request: OpenAI.Responses.ResponseCreateParamsNonStreaming
    ): Promise<{ output_text: string }>;
  };
}

export interface OpenAITextProviderOptions {
  apiKey: string;
  model?: string;
  client?: ResponsesClient;
}

export class OpenAITextProvider implements TextAIProvider {
  private readonly client: ResponsesClient;
  private readonly model: string;

  constructor(options: OpenAITextProviderOptions) {
    if (!options.apiKey.trim() && !options.client) {
      throw new Error("OPENAI_API_KEY is required for OpenAI text AI.");
    }

    this.client =
      options.client ??
      new OpenAI({
        apiKey: options.apiKey,
      });

    this.model =
      options.model?.trim() || DEFAULT_OPENAI_TEXT_MODEL;
  }

  async generateText(
    request: TextGenerationRequest
  ): Promise<TextGenerationResult> {
    const createRequest: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
      model: this.model,
      input: request.prompt,
      text: {
        format: {
          type: "json_schema",
          name: "creator_insights",
          strict: true,
          schema: CREATOR_INSIGHTS_SCHEMA,
        },
      },
    };

    if (request.systemPrompt !== undefined) {
      createRequest.instructions = request.systemPrompt;
    }

    const response = await this.client.responses.create(createRequest);

    if (!response.output_text.trim()) {
      throw new Error("OpenAI returned an empty text response.");
    }

    return {
      text: response.output_text,
    };
  }
}

const CREATOR_INSIGHTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "confidence",
    "retention_score",
    "replay_value",
    "emotional_score",
    "action_score",
    "suggested_platform",
    "suggested_title",
    "suggested_thumbnail_text",
    "suggested_caption",
    "suggested_hashtags",
  ],
  properties: {
    confidence: scoreSchema(),
    retention_score: scoreSchema(),
    replay_value: scoreSchema(),
    emotional_score: scoreSchema(),
    action_score: scoreSchema(),
    suggested_platform: {
      type: "string",
      enum: ["TikTok", "YouTube Shorts", "Instagram Reels"],
    },
    suggested_title: nonEmptyStringSchema(),
    suggested_thumbnail_text: nonEmptyStringSchema(),
    suggested_caption: nonEmptyStringSchema(),
    suggested_hashtags: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: nonEmptyStringSchema(),
    },
  },
} satisfies Record<string, unknown>;

function scoreSchema(): Record<string, unknown> {
  return {
    type: "integer",
    minimum: 1,
    maximum: 100,
  };
}

function nonEmptyStringSchema(): Record<string, unknown> {
  return {
    type: "string",
    minLength: 1,
  };
}
