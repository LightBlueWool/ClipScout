import type {
  TextAIProvider,
  TextGenerationRequest,
  TextGenerationResult,
} from "./types";

export class UnconfiguredTextProvider implements TextAIProvider {
  async generateText(
    _request: TextGenerationRequest
  ): Promise<TextGenerationResult> {
    throw new Error(
      "No text AI provider is configured for creator intelligence."
    );
  }
}
