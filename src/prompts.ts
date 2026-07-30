export const CLIP_PROMPT = `
Find the 10 strongest short-form clip opportunities in this video.

Prioritize:
- Successful tricks, wins, eliminations, or major achievements
- Surprising or high-energy moments
- Celebrations and strong reactions
- Moments with a clear setup and payoff
- Moments understandable without watching the entire video

Exclude:
- Crashes, falls, and injuries
- Dead air
- Loading screens
- Long introductions
- Repetitive moments
- Moments without a clear payoff

Each clip should be between 10 and 45 seconds.

Return valid JSON only using this exact structure:

{
  "clips": [
    {
      "start_time": 0,
      "end_time": 20,
      "title": "Short title",
      "description": "What happens in the clip",
      "virality_score": 80,
      "hook": "Suggested opening hook",
      "reason": "Why this clip is worth using",
      "warnings": []
    }
  ]
}
`;