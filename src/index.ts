import "dotenv/config";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { analyzeVideo } from "./analyze";

async function main(): Promise<void> {
  console.log("ClipScout started");

  const providedPath = process.argv[2];

  if (!providedPath) {
    console.error(
      'Provide a video path.\nExample: npm run dev -- "videos\\test.mp4"'
    );
    process.exit(1);
  }

  const terminal = readline.createInterface({ input, output });

  const objective = await terminal.question(
    "\nWhat should ClipScout look for?\n> "
  );

  terminal.close();

  if (!objective.trim()) {
    throw new Error("You must enter an objective.");
  }

  const videoPath = path.resolve(providedPath);

  console.log(`\nObjective: ${objective}`);

  await analyzeVideo(videoPath, objective.trim());
}

main().catch((error: unknown) => {
  console.error("\nClipScout failed:");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exit(1);
});