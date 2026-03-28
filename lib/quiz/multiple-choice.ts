import type { Language, RegionalMarket, Term } from '@/types';

export interface MultipleChoiceOption {
    termId: string;
    label: string;
    isCorrect: boolean;
}

export interface MultipleChoiceQuestion {
    prompt: string;
    options: MultipleChoiceOption[];
    correctOptionTermId: string;
}

const getLocalizedTermLabel = (term: Term, language: Language): string => (
    language === 'tr' ? term.term_tr : language === 'ru' ? term.term_ru : term.term_en
);

const getLocalizedDefinition = (term: Term, language: Language): string => (
    language === 'tr' ? term.definition_tr : language === 'ru' ? term.definition_ru : term.definition_en
);

const getRegionalMarkets = (term: Term): readonly RegionalMarket[] => (
    term.regional_markets.length > 0 ? term.regional_markets : [term.regional_market]
);

const countSharedValues = <T,>(left: readonly T[], right: readonly T[]): number => {
    const rightSet = new Set(right);
    return left.filter((value) => rightSet.has(value)).length;
};

const getCandidateScore = (currentTerm: Term, candidateTerm: Term): number => {
    let score = 0;

    if (candidateTerm.category === currentTerm.category) {
        score += 6;
    }

    if (candidateTerm.regional_market === currentTerm.regional_market) {
        score += 3;
    }

    score += countSharedValues(currentTerm.topic_ids, candidateTerm.topic_ids) * 2;
    score += countSharedValues(getRegionalMarkets(currentTerm), getRegionalMarkets(candidateTerm));
    score += countSharedValues(currentTerm.related_term_ids, candidateTerm.related_term_ids);

    if (candidateTerm.difficulty_level === currentTerm.difficulty_level) {
        score += 1;
    }

    return score;
};

const createDeterministicSeed = (value: string): number => {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }

    return Math.abs(hash);
};

const sortCandidates = (currentTerm: Term, language: Language, candidates: readonly Term[]): Term[] => (
    [...candidates].sort((left, right) => {
        const scoreDelta = getCandidateScore(currentTerm, right) - getCandidateScore(currentTerm, left);

        if (scoreDelta !== 0) {
            return scoreDelta;
        }

        return getLocalizedTermLabel(left, language).localeCompare(getLocalizedTermLabel(right, language), language);
    })
);

const createStableOptionOrder = (
    currentTerm: Term,
    language: Language,
    options: readonly MultipleChoiceOption[]
): MultipleChoiceOption[] => {
    const seedBase = createDeterministicSeed(`${currentTerm.id}:${language}`);

    return [...options].sort((left, right) => {
        const leftSeed = createDeterministicSeed(`${seedBase}:${left.termId}`);
        const rightSeed = createDeterministicSeed(`${seedBase}:${right.termId}`);

        if (leftSeed === rightSeed) {
            return left.label.localeCompare(right.label, language);
        }

        return leftSeed - rightSeed;
    });
};

const collectDistractors = (
    currentTerm: Term,
    language: Language,
    prioritizedPool: readonly Term[],
    fallbackPool: readonly Term[]
): Term[] => {
    const correctLabel = getLocalizedTermLabel(currentTerm, language);
    const selectedDistractors: Term[] = [];
    const usedTermIds = new Set<string>([currentTerm.id]);
    const usedLabels = new Set<string>([correctLabel]);

    const appendCandidates = (pool: readonly Term[]) => {
        for (const candidate of sortCandidates(currentTerm, language, pool)) {
            if (selectedDistractors.length >= 3) {
                return;
            }

            const label = getLocalizedTermLabel(candidate, language);
            if (usedTermIds.has(candidate.id) || usedLabels.has(label)) {
                continue;
            }

            selectedDistractors.push(candidate);
            usedTermIds.add(candidate.id);
            usedLabels.add(label);
        }
    };

    appendCandidates(prioritizedPool);

    if (selectedDistractors.length < 3) {
        appendCandidates(fallbackPool);
    }

    return selectedDistractors.slice(0, 3);
};

export const buildMultipleChoiceQuestion = (
    currentTerm: Term,
    activePool: readonly Term[],
    fallbackCatalog: readonly Term[],
    language: Language
): MultipleChoiceQuestion | null => {
    const samePoolCandidates = activePool.filter((term) => term.id !== currentTerm.id);
    const fallbackCandidates = fallbackCatalog.filter((term) => term.id !== currentTerm.id);
    const distractors = collectDistractors(currentTerm, language, samePoolCandidates, fallbackCandidates);

    if (distractors.length < 3) {
        return null;
    }

    const options = createStableOptionOrder(currentTerm, language, [
        {
            termId: currentTerm.id,
            label: getLocalizedTermLabel(currentTerm, language),
            isCorrect: true,
        },
        ...distractors.map((term) => ({
            termId: term.id,
            label: getLocalizedTermLabel(term, language),
            isCorrect: false,
        })),
    ]);

    return {
        prompt: getLocalizedDefinition(currentTerm, language),
        options,
        correctOptionTermId: currentTerm.id,
    };
};
