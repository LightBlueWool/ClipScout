import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import type { ClipResult } from "./types";

export interface ExtractedThumbnail {
  clip: ClipResult;
  outputPath: string;
}

export async function extractThumbnails(
  videoPath: string,
  clips: ClipResult[]
): Promise<ExtractedThumbnail[]> {
  if (!ffmpegPath) {
    throw new Error("FFmpeg executable could not be located.");
  }

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Source video not found: ${videoPath}`);
  }

  const videoName = path.parse(videoPath).name;
  const outputFolder = path.resolve(
    "results",
    videoName,
    "thumbnails"
  );

  fs.mkdirSync(outputFolder, { recursive: true });

  const thumbnails: ExtractedThumbnail[] = [];

  for (const [index, clip] of clips.entries()) {
    const clipNumber = String(index + 1).padStart(2, "0");
    const safeTitle = sanitizeFilename(clip.title);

    const outputPath = path.join(
      outputFolder,
      `${clipNumber}-${safeTitle}.jpg`
    );

    const thumbnailTime =
      clip.start_time + (clip.end_time - clip.start_time) / 2;

    console.log(
      `Creating thumbnail ${index + 1}/${clips.length}: ${clip.title}`
    );

    await extractSingleThumbnail(
      videoPath,
      outputPath,
      thumbnailTime
    );

    thumbnails.push({
      clip,
      outputPath,
    });
  }

  return thumbnails;
}

async function extractSingleThumbnail(
  inputPath: string,
  outputPath: string,
  timestamp: number
): Promise<void> {
  if (!ffmpegPath) {
    throw new Error("FFmpeg executable could not be located.");
  }

  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new Error("Thumbnail timestamp must be a valid positive number.");
  }

  const argumentsList = [
    "-y",
    "-ss",
    timestamp.toString(),
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath,
  ];

  await new Promise<void>((resolve, reject) => {
    const ffmpegProcess = spawn(ffmpegPath, argumentsList, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let errorOutput = "";

    ffmpegProcess.stderr.on("data", (data: Buffer) => {
      errorOutput += data.toString();
    });

    ffmpegProcess.on("error", (error) => {
      reject(
        new Error(`Could not start FFmpeg: ${error.message}`)
      );
    });

    ffmpegProcess.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `FFmpeg thumbnail extraction failed with code ${exitCode}.\n${errorOutput}`
        )
      );
    });
  });
}

function sanitizeFilename(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 80);

  return sanitized || "untitled-thumbnail";
}