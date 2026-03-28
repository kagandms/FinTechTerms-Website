export interface QuizAnswerRequest {
    isCorrect: boolean;
    responseTimeMs: number;
    selectedOptionLabel?: string | null;
    selectedOptionTermId?: string | null;
}

export interface QuizAnswerResult {
    keepLocked?: boolean;
}
