import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import type { ClipResult } from "./types";

export interface ExtractedClip {
  clip: ClipResult;
  outputPath: string;
}

export async function extractClips(
  videoPath: string,
  clips: ClipResult[]
): Promise<ExtractedClip[]> {
  if (!ffmpegPath) {
    throw new Error("FFmpeg executable could not be located.");
  }

  if (!fs.existsSync(videoPath)) {
    throw new Error(`Source video not found: ${videoPath}`);
  }

  const videoName = path.parse(videoPath).name;
  const outputFolder = path.resolve("results", videoName, "clips");

  fs.mkdirSync(outputFolder, { recursive: true });

  const extractedClips: ExtractedClip[] = [];

  for (const [index, clip] of clips.entries()) {
    const clipNumber = String(index + 1).padStart(2, "0");
    const safeTitle = sanitizeFilename(clip.title);

    const outputPath = path.join(
      outputFolder,
      `${clipNumber}-${safeTitle}.mp4`
    );

    console.log(
      `Extracting clip ${index + 1}/${clips.length}: ${clip.title}`
    );

    await extractSingleClip(
      videoPath,
      outputPath,
      clip.start_time,
      clip.end_time
    );

    extractedClips.push({
      clip,
      outputPath,
    });
  }

  return extractedClips;
}

async function extractSingleClip(
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number
): Promise<void> {
  if (!ffmpegPath) {
    throw new Error("FFmpeg executable could not be located.");
  }

  const duration = endTime - startTime;

  if (startTime < 0) {
    throw new Error("Clip start time cannot be negative.");
  }

  if (duration <= 0) {
    throw new Error("Clip duration must be greater than zero.");
  }

  const argumentsList = [
    "-y",
    "-i",
    inputPath,
    "-ss",
    startTime.toString(),
    "-t",
    duration.toString(),
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  await new Promise<void>((resolve, reject) => {
    const process = spawn(ffmpegPath, argumentsList, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let errorOutput = "";

    process.stderr.on("data", (data: Buffer) => {
      errorOutput += data.toString();
    });

    process.on("error", (error) => {
      reject(
        new Error(`Could not start FFmpeg: ${error.message}`)
      );
    });

    process.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `FFmpeg exited with code ${exitCode}.\n${errorOutput}`
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

  return sanitized || "untitled-clip";
}