import fs from "node:fs";
import { TwelveLabs } from "twelvelabs-js";
import { buildClipPrompt } from "./promptBuilder";
import { parseAnalysis } from "./parser";
import { extractClips } from "./extractClips";
import { extractThumbnails } from "./extractThumbnails";
import { rankClips } from "./analysis/ranking";
import { saveAnalysis } from "./output/saveAnalysis";
import { printResults } from "./output/printResults";
import { deduplicateClips } from "./analysis/deduplicate";

const apiKey = process.env.TWELVE_LABS_API_KEY;

if (!apiKey) {
  throw new Error(
    "TWELVE_LABS_API_KEY is missing from .env."
  );
}

const client = new TwelveLabs({
  apiKey,
});

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );

export async function analyzeVideo(
  videoPath: string,
  objective: string
): Promise<void> {
  validateVideoPath(videoPath);

  const assetId = await uploadVideo(videoPath);

  await waitForAsset(assetId);

  const resultText = await analyzeAsset(
    assetId,
    objective
  );

  const analysis = parseAnalysis(resultText);

const rankedClips = rankClips(analysis.clips);

const uniqueClips = deduplicateClips(rankedClips, {
  overlapThreshold: 0.7,
  startTimeTolerance: 2,
});

const duplicatesRemoved =
  rankedClips.length - uniqueClips.length;

analysis.clips = uniqueClips;

if (duplicatesRemoved > 0) {
  console.log(
    `Removed ${duplicatesRemoved} duplicate ${
      duplicatesRemoved === 1 ? "clip" : "clips"
    }.`
  );
}
  const outputPath = saveAnalysis(
    videoPath,
    analysis
  );

  console.log("\nExtracting video clips...");

  const extractedClips = await extractClips(
    videoPath,
    analysis.clips
  );

  console.log("\nCreating thumbnails...");

  const extractedThumbnails =
    await extractThumbnails(
      videoPath,
      analysis.clips
    );

  printResults({
    analysis,
    outputPath,
    extractedClips,
    extractedThumbnails,
  });
}

function validateVideoPath(videoPath: string): void {
  if (!fs.existsSync(videoPath)) {
    throw new Error(
      `Video not found: ${videoPath}`
    );
  }
}

async function uploadVideo(
  videoPath: string
): Promise<string> {
  console.log(`Uploading: ${videoPath}`);

  const asset = await client.assets.create({
    method: "direct",
    file: fs.createReadStream(videoPath),
  });

  if (!asset.id) {
    throw new Error(
      "Twelve Labs did not return an asset ID."
    );
  }

  console.log(`Asset created: ${asset.id}`);

  return asset.id;
}

async function waitForAsset(
  assetId: string
): Promise<void> {
  console.log(
    "Waiting for the video to be ready..."
  );

  let asset = await client.assets.retrieve(
    assetId
  );

  while (
    asset.status !== "ready" &&
    asset.status !== "failed"
  ) {
    console.log(
      `Asset status: ${asset.status}`
    );

    await wait(5000);

    asset = await client.assets.retrieve(
      assetId
    );
  }

  if (asset.status === "failed") {
    throw new Error(
      `Asset processing failed: ${assetId}`
    );
  }

  console.log("Video is ready.");
}

async function analyzeAsset(
  assetId: string,
  objective: string
): Promise<string> {
  console.log("Starting AI analysis...");

  const prompt = buildClipPrompt({
    objective,
    maxClips: 10,
    minClipLength: 10,
    maxClipLength: 60,
  });

  const task =
    await client.analyzeAsync.tasks.create({
      modelName: "pegasus1.5",
      video: {
        type: "asset_id",
        assetId,
      },
      prompt,
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
    await client.analyzeAsync.tasks.retrieve(
      task.taskId
    );

  while (
    currentTask.status !== "ready" &&
    currentTask.status !== "failed"
  ) {
    console.log(
      `Analysis status: ${currentTask.status}`
    );

    await wait(5000);

    currentTask =
      await client.analyzeAsync.tasks.retrieve(
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

  return typeof result === "string"
    ? result
    : JSON.stringify(result);
}