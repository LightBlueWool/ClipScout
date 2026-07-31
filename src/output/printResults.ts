import type { ClipAnalysis } from "../types";

interface GeneratedFile {
  outputPath: string;
}

interface PrintResultsOptions {
  analysis: ClipAnalysis;
  outputPath: string;
  extractedClips: GeneratedFile[];
  extractedThumbnails: GeneratedFile[];
}

export function printResults({
  analysis,
  outputPath,
  extractedClips,
  extractedThumbnails,
}: PrintResultsOptions): void {
  console.clear();

  console.log("\n==============================");
  console.log("      CLIPSCOUT RESULTS");
  console.log("==============================\n");

  console.log(`Objective: ${analysis.objective}\n`);

  if (analysis.clips.length === 0) {
    console.log("No matching clips were found.\n");
  }

  analysis.clips.forEach((clip, index) => {
    console.log(`Clip #${index + 1}`);
    console.log("-----------------------");
    console.log(`Title: ${clip.title}`);

    console.log(
      `Time: ${formatTimestamp(
        clip.start_time
      )} - ${formatTimestamp(clip.end_time)}`
    );

    console.log(
      `Overall score: ${
        clip.overall_score ?? "Not calculated"
      }/100`
    );

    console.log(`Virality: ${clip.virality_score}/100`);
    console.log(`Relevance: ${clip.relevance_score}/100`);

    console.log(`\nDescription:\n${clip.description}`);
    console.log(`\nHook:\n${clip.hook}`);
    console.log(`\nReason:\n${clip.reason}`);

    if (clip.warnings.length > 0) {
      console.log(
        `\nWarnings: ${clip.warnings.join(", ")}`
      );
    }

    console.log("");
  });

  console.log(`Results saved to: ${outputPath}`);

  if (extractedClips.length > 0) {
    console.log("\nExtracted files:");

    extractedClips.forEach((extractedClip, index) => {
      console.log(
        `${index + 1}. ${extractedClip.outputPath}`
      );
    });
  }

  if (extractedThumbnails.length > 0) {
    console.log("\nGenerated thumbnails:");

    extractedThumbnails.forEach((thumbnail, index) => {
      console.log(
        `${index + 1}. ${thumbnail.outputPath}`
      );
    });
  }

  console.log("");
}

function formatTimestamp(totalSeconds: number): string {
  const safeSeconds = Math.max(
    0,
    Math.floor(totalSeconds)
  );

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor(
    (safeSeconds % 3600) / 60
  );
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${seconds
    .toString()
    .padStart(2, "0")}`;
}