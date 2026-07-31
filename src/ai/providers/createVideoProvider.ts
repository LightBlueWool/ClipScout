import type { VideoAIProvider } from "./types";
import { TwelveLabsProvider } from "./twelveLabsProvider";

export type VideoProviderName =
  | "twelve-labs";

export interface CreateVideoProviderOptions {
  provider: VideoProviderName;
  twelveLabsApiKey?: string;
}

export function createVideoProvider({
  provider,
  twelveLabsApiKey,
}: CreateVideoProviderOptions): VideoAIProvider {
  switch (provider) {
    case "twelve-labs": {
      if (!twelveLabsApiKey) {
        throw new Error(
          "TWELVE_LABS_API_KEY is required for the Twelve Labs provider."
        );
      }

      return new TwelveLabsProvider({
        apiKey: twelveLabsApiKey,
        modelName: "pegasus1.5",
        pollingIntervalMs: 5000,
      });
    }

    default: {
      return assertNever(provider);
    }
  }
}

function assertNever(value: never): never {
  throw new Error(
    `Unsupported video provider: ${String(value)}`
  );
}