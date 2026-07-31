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
    ): Promise<{
      id?: string;
      model?: string;
      output_text: string;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        total_tokens?: number;
      };
    }>;
  };
}

export interface OpenAITextProviderOptions {
  apiKey: string;
  model?: string;
  inputCostPerMillion?: number;
  outputCostPerMillion?: number;
  client?: ResponsesClient;
}

export class OpenAITextProvider implements TextAIProvider {
  private readonly client: ResponsesClient;
  private readonly model: string;
  private readonly inputCostPerMillion: number | undefined;
  private readonly outputCostPerMillion: number | undefined;

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

    this.inputCostPerMillion = options.inputCostPerMillion;
    this.outputCostPerMillion = options.outputCostPerMillion;
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

    const result: TextGenerationResult = {
      text: response.output_text,
      provider: "openai",
      model: response.model ?? this.model,
    };

    assignIfDefined(result, "inputTokens", response.usage?.input_tokens);
    assignIfDefined(result, "outputTokens", response.usage?.output_tokens);
    assignIfDefined(result, "totalTokens", response.usage?.total_tokens);
    assignIfDefined(
      result,
      "estimatedCostUsd",
      this.calculateEstimatedCost(
        response.usage?.input_tokens,
        response.usage?.output_tokens
      )
    );
    assignIfDefined(result, "responseId", response.id);

    return result;
  }

  private calculateEstimatedCost(
    inputTokens: number | undefined,
    outputTokens: number | undefined
  ): number | undefined {
    if (
      this.inputCostPerMillion === undefined ||
      this.outputCostPerMillion === undefined ||
      inputTokens === undefined ||
      outputTokens === undefined
    ) {
      return undefined;
    }

    return (
      (inputTokens / 1_000_000) * this.inputCostPerMillion +
      (outputTokens / 1_000_000) * this.outputCostPerMillion
    );
  }
}

function assignIfDefined<TKey extends keyof TextGenerationResult>(
  result: TextGenerationResult,
  key: TKey,
  value: TextGenerationResult[TKey] | undefined
): void {
  if (value !== undefined) {
    result[key] = value;
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
