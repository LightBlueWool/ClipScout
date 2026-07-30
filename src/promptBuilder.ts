export interface PromptOptions {
  objective: string;
  maxClips?: number;
  minClipLength?: number;
  maxClipLength?: number;
  platform?: string;
  exclusions?: string;
}

const SELECTION_RULES = `
Selection rules:
- Every result must directly match the user's objective
- Choose moments with a clear beginning and ending
- Keep timestamps tightly focused around the relevant event
- Prefer moments that are understandable without watching the entire video
- Rank the strongest and most relevant results first
- Do not return duplicate or substantially overlapping moments
- Return fewer results when the video does not contain enough genuine matches
- Do not select the entire video unless the entire video is one continuous relevant moment
`;

const FACTUALITY_RULES = `
Factuality rules:
- Do not invent events that are not clearly visible or audible
- Do not exaggerate events, achievements, reactions, counts, or outcomes
- Titles, descriptions, hooks, and reasons must be supported by the video
- Any hook or description that mentions duration must match the timestamps
- Any stated count must match the number of clearly observable events
- Do not describe uncertain details as definite facts
`;

const OUTPUT_FIELDS = `
For each result, provide:
- Accurate start and end timestamps in seconds
- A concise title
- A factual description of what happens
- A relevance score from 1 to 100
- A virality score from 1 to 100
- A suggested opening hook
- A reason the moment was selected
- Any content warnings
`;

export function buildClipPrompt(options: PromptOptions): string {
  const {
    objective,
    maxClips = 10,
    minClipLength = 10,
    maxClipLength = 60,
    platform = "short-form social media",
    exclusions = "",
  } = options;

  const cleanObjective = objective.trim();

  if (!cleanObjective) {
    throw new Error("A clip-search objective is required.");
  }

  const safeMaxClips = clampInteger(maxClips, 1, 50);
  const safeMinClipLength = clampNumber(minClipLength, 0, 3600);
  const safeMaxClipLength = clampNumber(maxClipLength, 1, 3600);

  if (safeMinClipLength > safeMaxClipLength) {
    throw new Error(
      "Minimum clip length cannot be greater than maximum clip length."
    );
  }

  const exclusionInstructions = exclusions.trim()
    ? `
Exclusion rules:
- Do not select moments matching the following:
${exclusions.trim()}
`
    : "";

  return `
Analyze this video and find the strongest moments matching the user's objective.

USER OBJECTIVE:
${cleanObjective}

TARGET USE:
${platform.trim() || "general video use"}

Find up to ${safeMaxClips} distinct, non-overlapping moments.

${SELECTION_RULES}
${FACTUALITY_RULES}
${exclusionInstructions}

Clip-length rules:
- Preferred minimum length: ${safeMinClipLength} seconds
- Preferred maximum length: ${safeMaxClipLength} seconds
- A shorter result is allowed when the relevant event is genuinely brief
- A longer result is allowed only when necessary to preserve important context
- Do not add unrelated footage merely to satisfy the preferred minimum length

${OUTPUT_FIELDS}

Scoring rules:
- Relevance measures how directly the moment matches the user's objective
- Virality estimates how compelling the moment may be for the target use
- Scores must be integers from 1 to 100
- Do not inflate scores
- A high virality score must be justified by the actual moment

Return valid JSON only.
Do not include Markdown, code fences, introductions, explanations, or commentary.

Use exactly this structure:

{
  "objective": "${escapeForJson(cleanObjective)}",
  "clips": [
    {
      "start_time": 0,
      "end_time": 20,
      "title": "Short descriptive title",
      "description": "What visibly or audibly happens",
      "relevance_score": 90,
      "virality_score": 80,
      "hook": "Suggested opening hook",
      "reason": "Why this result matches the objective",
      "warnings": []
    }
  ]
}
`.trim();
}

function escapeForJson(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ");
}

function clampNumber(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(Math.max(value, minimum), maximum);
}

function clampInteger(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.round(clampNumber(value, minimum, maximum));
}