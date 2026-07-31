export interface VideoUploadResult {
  assetId: string;
}

export interface VideoAnalysisRequest {
  assetId: string;
  prompt: string;
}

export interface VideoAnalysisResult {
  text: string;
}

export interface VideoAIProvider {
  uploadVideo(videoPath: string): Promise<VideoUploadResult>;

  waitUntilVideoReady(assetId: string): Promise<void>;

  analyzeVideo(
    request: VideoAnalysisRequest
  ): Promise<VideoAnalysisResult>;
}

export interface TextGenerationRequest {
  prompt: string;
  systemPrompt?: string;
}

export interface TextGenerationResult {
  text: string;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  requestId?: string;
  responseId?: string;
}

export interface TextAIProvider {
  generateText(
    request: TextGenerationRequest
  ): Promise<TextGenerationResult>;
}
