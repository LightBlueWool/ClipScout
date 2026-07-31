import fs from "node:fs";
import path from "node:path";
import type { ClipAnalysis } from "../types";

export function saveAnalysis(
  videoPath: string,
  analysis: ClipAnalysis
): string {
  const resultsFolder = path.resolve("results");

  fs.mkdirSync(resultsFolder, {
    recursive: true,
  });

  const videoName = path.parse(videoPath).name;

  const outputPath = path.join(
    resultsFolder,
    `${videoName}-clips.json`
  );

  fs.writeFileSync(
    outputPath,
    JSON.stringify(analysis, null, 2),
    "utf8"
  );

  return outputPath;
}