import fs from "node:fs";
import { TwelveLabs } from "twelvelabs-js";
import type {
  VideoAIProvider,
  VideoAnalysisRequest,
  VideoAnalysisResult,
  VideoUploadResult,
} from "./types";

export interface TwelveLabsProviderOptions {
  apiKey: string;
  modelName?: "pegasus1.2" | "pegasus1.5";
  pollingIntervalMs?: number;
}

export class TwelveLabsProvider
  implements VideoAIProvider
{
  private readonly client: TwelveLabs;
  private readonly modelName: "pegasus1.2" | "pegasus1.5";
  private readonly pollingIntervalMs: number;

  constructor(options: TwelveLabsProviderOptions) {
    if (!options.apiKey.trim()) {
      throw new Error(
        "A Twelve Labs API key is required."
      );
    }

    this.client = new TwelveLabs({
      apiKey: options.apiKey,
    });

    this.modelName =
      options.modelName ?? "pegasus1.5";

    this.pollingIntervalMs =
      options.pollingIntervalMs ?? 5000;
  }

  async uploadVideo(
    videoPath: string
  ): Promise<VideoUploadResult> {
    if (!fs.existsSync(videoPath)) {
      throw new Error(
        `Video not found: ${videoPath}`
      );
    }

    console.log(`Uploading: ${videoPath}`);

    const asset = await this.client.assets.create({
      method: "direct",
      file: fs.createReadStream(videoPath),
    });

    if (!asset.id) {
      throw new Error(
        "Twelve Labs did not return an asset ID."
      );
    }

    console.log(`Asset created: ${asset.id}`);

    return {
      assetId: asset.id,
    };
  }

  async waitUntilVideoReady(
    assetId: string
  ): Promise<void> {
    console.log(
      "Waiting for the video to be ready..."
    );

    let asset =
      await this.client.assets.retrieve(assetId);

    while (
      asset.status !== "ready" &&
      asset.status !== "failed"
    ) {
      console.log(
        `Asset status: ${asset.status}`
      );

      await this.wait(this.pollingIntervalMs);

      asset =
        await this.client.assets.retrieve(assetId);
    }

    if (asset.status === "failed") {
      throw new Error(
        `Asset processing failed: ${assetId}`
      );
    }

    console.log("Video is ready.");
  }

  async analyzeVideo(
    request: VideoAnalysisRequest
  ): Promise<VideoAnalysisResult> {
    console.log("Starting AI analysis...");

    const task =
      await this.client.analyzeAsync.tasks.create({
        modelName: this.modelName,
        video: {
          type: "asset_id",
          assetId: request.assetId,
        },
        prompt: request.prompt,
      });

    if (!task.taskId) {
      throw new Error(
        "Twelve Labs did not return an analysis task ID."
      );
    }

    console.log(
      `Analysis task created: ${task.taskId}`
    );

    let currentTask =
      await this.client.analyzeAsync.tasks.retrieve(
        task.taskId
      );

    while (
      currentTask.status !== "ready" &&
      currentTask.status !== "failed"
    ) {
      console.log(
        `Analysis status: ${currentTask.status}`
      );

      await this.wait(this.pollingIntervalMs);

      currentTask =
        await this.client.analyzeAsync.tasks.retrieve(
          task.taskId
        );
    }

    if (currentTask.status === "failed") {
      throw new Error(
        `Analysis failed: ${task.taskId}`
      );
    }

    const result = currentTask.result?.data;

    if (!result) {
      throw new Error(
        "Analysis completed, but no result was returned."
      );
    }

    return {
      text:
        typeof result === "string"
          ? result
          : JSON.stringify(result),
    };
  }

  private wait(
    milliseconds: number
  ): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}
