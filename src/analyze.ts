import { createClipAnalysisPrompt } from "./ai/providers/clipPrompt";
import { createTextProvider } from "./ai/providers/createTextProvider";
import { createVideoProvider } from "./ai/providers/createVideoProvider";
import { parseAnalysis } from "./parser";
import { extractClips } from "./extractClips";
import { extractThumbnails } from "./extractThumbnails";
import { rankClips } from "./analysis/ranking";
import { deduplicateClips } from "./analysis/deduplicate";
import {
  enrichClips,
  summarizeCreatorEnrichment,
} from "./creator/enrichClips";
import { saveAnalysis } from "./output/saveAnalysis";
import { printResults } from "./output/printResults";

const apiKey = process.env.TWELVE_LABS_API_KEY;

if (!apiKey) {
  throw new Error(
    "TWELVE_LABS_API_KEY is missing from .env."
  );
}

const videoProvider = createVideoProvider({
  provider: "twelve-labs",
  twelveLabsApiKey: apiKey,
});

const textProvider = createTextProvider();

export async function analyzeVideo(
  videoPath: string,
  objective: string
): Promise<void> {
  const uploadResult =
    await videoProvider.uploadVideo(videoPath);

  await videoProvider.waitUntilVideoReady(
    uploadResult.assetId
  );

  const prompt = createClipAnalysisPrompt({
    objective,
    maxClips: 10,
    minClipLength: 10,
    maxClipLength: 60,
  });

  const analysisResult =
    await videoProvider.analyzeVideo({
      assetId: uploadResult.assetId,
      prompt,
    });

  const analysis = parseAnalysis(
    analysisResult.text
  );

  const rankedClips = rankClips(
    analysis.clips
  );

  const uniqueClips = deduplicateClips(
    rankedClips,
    {
      overlapThreshold: 0.7,
      startTimeTolerance: 2,
    }
  );

  const duplicatesRemoved =
    rankedClips.length - uniqueClips.length;

  analysis.clips = await enrichClips(
    uniqueClips,
    textProvider ? { textProvider } : {}
  );
  analysis.creatorSummary =
    summarizeCreatorEnrichment(analysis.clips);

  if (duplicatesRemoved > 0) {
    console.log(
      `Removed ${duplicatesRemoved} duplicate ${
        duplicatesRemoved === 1
          ? "clip"
          : "clips"
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
