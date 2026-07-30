export interface ClipResult {
    start_time: number;
    end_time: number;

    title: string;
    description: string;

    relevance_score: number;
    virality_score: number;

    hook: string;
    reason: string;

    warnings: string[];
}

export interface ClipAnalysis {
    objective: string;
    clips: ClipResult[];
}