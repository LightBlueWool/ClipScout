import fs from "node:fs";
import path from "node:path";
import { TwelveLabs } from "twelvelabs-js";
import { buildClipPrompt } from "./promptBuilder";
import { parseAnalysis } from "./parser";
import { extractClips } from "./extractClips";
import { extractThumbnails } from "./extractThumbnails";

const apiKey = process.env.TWELVE_LABS_API_KEY;

if (!apiKey) {
  throw new Error("TWELVE_LABS_API_KEY is missing from .env.");
}

const client = new TwelveLabs({ apiKey });

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function analyzeVideo(
  videoPath: string,
  objective: string
): Promise<void> {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video not found: ${videoPath}`);
  }

  console.log(`Uploading: ${videoPath}`);

  const asset = await client.assets.create({
    method: "direct",
    file: fs.createReadStream(videoPath),
  });

  if (!asset.id) {
    throw new Error("Twelve Labs did not return an asset ID.");
  }

  console.log(`Asset created: ${asset.id}`);
  console.log("Waiting for the video to be ready...");

  let readyAsset = await client.assets.retrieve(asset.id);

  while (
    readyAsset.status !== "ready" &&
    readyAsset.status !== "failed"
  ) {
    console.log(`Asset status: ${readyAsset.status}`);

    await wait(5000);
    readyAsset = await client.assets.retrieve(asset.id);
  }

  if (readyAsset.status === "failed") {
    throw new Error(`Asset processing failed: ${asset.id}`);
  }

  console.log("Video is ready.");
  console.log("Starting AI analysis...");

  const prompt = buildClipPrompt({
    objective,
    maxClips: 10,
    minClipLength: 10,
    maxClipLength: 60,
  });

  const task = await client.analyzeAsync.tasks.create({
    modelName: "pegasus1.5",
    video: {
      type: "asset_id",
      assetId: asset.id,
    },
    prompt,
  });

  if (!task.taskId) {
    throw new Error("Twelve Labs did not return an analysis task ID.");
  }

  console.log(`Analysis task created: ${task.taskId}`);

  let currentTask = await client.analyzeAsync.tasks.retrieve(task.taskId);

  while (
    currentTask.status !== "ready" &&
    currentTask.status !== "failed"
  ) {
    console.log(`Analysis status: ${currentTask.status}`);

    await wait(5000);
    currentTask = await client.analyzeAsync.tasks.retrieve(task.taskId);
  }

  if (currentTask.status === "failed") {
    throw new Error(`Analysis failed: ${task.taskId}`);
  }

  const result = currentTask.result?.data;

  if (!result) {
    throw new Error("Analysis completed, but no result was returned.");
  }

  const resultText =
    typeof result === "string"
      ? result
      : JSON.stringify(result);

  const analysis = parseAnalysis(resultText);

  analysis.clips.sort(
    (a, b) =>
      b.virality_score +
      b.relevance_score -
      (a.virality_score + a.relevance_score)
  );

  const resultsFolder = path.resolve("results");
  fs.mkdirSync(resultsFolder, { recursive: true });

  const outputPath = path.join(
    resultsFolder,
    `${path.parse(videoPath).name}-clips.json`
  );

  fs.writeFileSync(
    outputPath,
    JSON.stringify(analysis, null, 2),
    "utf8"
  );

  console.log("\nExtracting video clips...");

  const extractedClips = await extractClips(
    videoPath,
    analysis.clips
  );

  console.log("\nCreating thumbnails...");

  const extractedThumbnails = await extractThumbnails(
    videoPath,
    analysis.clips
  );

  console.clear();

  console.log("\n==============================");
  console.log("      CLIPSCOUT RESULTS");
  console.log("==============================\n");

  console.log(`Objective: ${analysis.objective}\n`);

  if (analysis.clips.length === 0) {
    console.log("No matching clips were found.");
  }

  analysis.clips.forEach((clip, index) => {
    const combinedScore = Math.round(
      (clip.virality_score + clip.relevance_score) / 2
    );

    console.log(`Clip #${index + 1}`);
    console.log("-----------------------");
    console.log(`Title: ${clip.title}`);
    console.log(
      `Time: ${formatTimestamp(clip.start_time)} - ${formatTimestamp(
        clip.end_time
      )}`
    );
    console.log(`Combined score: ${combinedScore}/100`);
    console.log(`Virality: ${clip.virality_score}/100`);
    console.log(`Relevance: ${clip.relevance_score}/100`);
    console.log(`\nDescription:\n${clip.description}`);
    console.log(`\nHook:\n${clip.hook}`);
    console.log(`\nReason:\n${clip.reason}`);

    if (clip.warnings.length > 0) {
      console.log(`\nWarnings: ${clip.warnings.join(", ")}`);
    }

    console.log("");
  });

  console.log(`Results saved to: ${outputPath}`);

  if (extractedClips.length > 0) {
    console.log("\nExtracted files:");

    extractedClips.forEach((extractedClip, index) => {
      console.log(`${index + 1}. ${extractedClip.outputPath}`);
    });
  }

  if (extractedThumbnails.length > 0) {
    console.log("\nGenerated thumbnails:");

    extractedThumbnails.forEach((thumbnail, index) => {
      console.log(`${index + 1}. ${thumbnail.outputPath}`);
    });
  }
}

function formatTimestamp(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}