import { z } from 'zod';
import {
    createRequestId,
    errorResponse,
    handleRouteError,
    successResponse,
} from '@/lib/api-response';
import { createServiceRoleClient } from '@/lib/supabaseAdmin';
import { logger } from '@/lib/logger';

const SeedStudyStateSchema = z.object({
    userEmail: z.string().email(),
    favoriteTermIds: z.array(z.string().min(1)).max(20),
    dueTermIds: z.array(z.string().min(1)).max(20),
    clearExistingFavorites: z.boolean().optional().default(false),
    clearExistingQuizHistory: z.boolean().optional().default(false),
    seedReviewTimestamp: z.string().datetime().optional(),
});

const E2E_SEED_SECRET_HEADER = 'x-e2e-seed-secret';

const isPreviewLikeRuntime = (): boolean => {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
        return true;
    }

    const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
    const sentryEnvironment = (
        process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT
        || process.env.SENTRY_ENVIRONMENT
        || ''
    ).trim().toLowerCase();

    return vercelEnv === 'preview'
        || sentryEnvironment === 'preview'
        || sentryEnvironment === 'staging';
};

const getConfiguredSeedSecret = (): string | null => {
    const value = process.env.E2E_SEED_SECRET?.trim();
    return value ? value : null;
};

const isRouteEnabled = (): boolean => (
    isPreviewLikeRuntime()
    && getConfiguredSeedSecret() !== null
);

const getSeedTimestamp = (requestedTimestamp?: string): string => {
    if (requestedTimestamp) {
        return requestedTimestamp;
    }

    return new Date(Date.now() - (60 * 60 * 1000)).toISOString();
};

const dedupeIds = (ids: readonly string[]): string[] => Array.from(new Set(ids));

const resolveUserIdByEmail = async (
    normalizedEmail: string
): Promise<string | null> => {
    const supabaseAdmin = createServiceRoleClient();
    const perPage = 200;

    for (let page = 1; page <= 10; page += 1) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage,
        });

        if (error) {
            throw error;
        }

        const users = data?.users ?? [];
        const matchedUser = users.find((candidate) => (
            candidate.email?.trim().toLowerCase() === normalizedEmail
        ));

        if (matchedUser?.id) {
            return matchedUser.id;
        }

        if (users.length < perPage) {
            return null;
        }
    }

    return null;
};

export async function POST(request: Request) {
    const requestId = createRequestId(request);

    if (!isRouteEnabled()) {
        return errorResponse({
            status: 404,
            code: 'NOT_FOUND',
            message: 'Not found.',
            requestId,
            retryable: false,
        });
    }

    const configuredSeedSecret = getConfiguredSeedSecret();
    if (!configuredSeedSecret) {
        return errorResponse({
            status: 404,
            code: 'NOT_FOUND',
            message: 'Not found.',
            requestId,
            retryable: false,
        });
    }

    const providedSeedSecret = request.headers.get(E2E_SEED_SECRET_HEADER)?.trim();
    if (!providedSeedSecret || providedSeedSecret !== configuredSeedSecret) {
        return errorResponse({
            status: 403,
            code: 'FORBIDDEN',
            message: 'Forbidden.',
            requestId,
            retryable: false,
        });
    }

    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return errorResponse({
            status: 400,
            code: 'INVALID_JSON',
            message: 'Invalid JSON payload.',
            requestId,
            retryable: false,
        });
    }

    const parsedPayload = SeedStudyStateSchema.safeParse(body);
    if (!parsedPayload.success) {
        return errorResponse({
            status: 400,
            code: 'INVALID_E2E_SEED_REQUEST',
            message: 'Invalid E2E seed payload.',
            requestId,
            retryable: false,
        });
    }

    try {
        const supabaseAdmin = createServiceRoleClient();
        const payload = parsedPayload.data;
        const normalizedEmail = payload.userEmail.trim().toLowerCase();
        const userId = await resolveUserIdByEmail(normalizedEmail);

        if (!userId) {
            return errorResponse({
                status: 404,
                code: 'E2E_USER_NOT_FOUND',
                message: 'Unable to find the requested E2E user.',
                requestId,
                retryable: false,
            });
        }

        const seededDueTerms = dedupeIds(payload.dueTermIds);
        const seededFavorites = dedupeIds([
            ...payload.favoriteTermIds,
            ...seededDueTerms,
        ]);
        const allSeededTermIds = dedupeIds([
            ...seededFavorites,
            ...seededDueTerms,
        ]);

        if (allSeededTermIds.length === 0) {
            return errorResponse({
                status: 400,
                code: 'EMPTY_E2E_SEED_REQUEST',
                message: 'At least one term id is required.',
                requestId,
                retryable: false,
            });
        }

        const { data: existingTerms, error: termLookupError } = await supabaseAdmin
            .from('terms')
            .select('id')
            .in('id', allSeededTermIds);

        if (termLookupError) {
            throw termLookupError;
        }

        const foundTermIds = new Set((existingTerms ?? []).map((term) => term.id));
        const missingTermIds = allSeededTermIds.filter((termId) => !foundTermIds.has(termId));

        if (missingTermIds.length > 0) {
            return errorResponse({
                status: 404,
                code: 'E2E_SEED_TERM_NOT_FOUND',
                message: `Unknown term ids: ${missingTermIds.join(', ')}`,
                requestId,
                retryable: false,
            });
        }

        const nowIso = new Date().toISOString();
        const seedTimestamp = getSeedTimestamp(payload.seedReviewTimestamp);

        const { error: progressUpsertError } = await supabaseAdmin
            .from('user_progress')
            .upsert(
                {
                    user_id: userId,
                    updated_at: nowIso,
                },
                { onConflict: 'user_id' }
            );

        if (progressUpsertError) {
            throw progressUpsertError;
        }

        if (payload.clearExistingFavorites) {
            const { error: clearFavoritesError } = await supabaseAdmin
                .from('user_favorites')
                .delete()
                .eq('user_id', userId);

            if (clearFavoritesError) {
                throw clearFavoritesError;
            }

            const { error: clearSrsError } = await supabaseAdmin
                .from('user_term_srs')
                .delete()
                .eq('user_id', userId);

            if (clearSrsError) {
                throw clearSrsError;
            }
        }

        if (payload.clearExistingQuizHistory) {
            const { error: clearQuizHistoryError } = await supabaseAdmin
                .from('quiz_attempts')
                .delete()
                .eq('user_id', userId);

            if (clearQuizHistoryError) {
                throw clearQuizHistoryError;
            }
        }

        const favoriteRows = seededFavorites.map((termId) => ({
            user_id: userId,
            term_id: termId,
            source: 'e2e',
            created_at: nowIso,
        }));

        const { error: favoriteUpsertError } = await supabaseAdmin
            .from('user_favorites')
            .upsert(favoriteRows, { onConflict: 'user_id,term_id' });

        if (favoriteUpsertError) {
            throw favoriteUpsertError;
        }

        if (seededDueTerms.length > 0) {
            const dueRows = seededDueTerms.map((termId) => ({
                user_id: userId,
                term_id: termId,
                srs_level: 1,
                next_review_date: seedTimestamp,
                last_reviewed: null,
                difficulty_score: 2.5,
                retention_rate: 0,
                times_reviewed: 0,
                times_correct: 0,
            }));

            const { error: srsUpsertError } = await supabaseAdmin
                .from('user_term_srs')
                .upsert(dueRows, { onConflict: 'user_id,term_id' });

            if (srsUpsertError) {
                throw srsUpsertError;
            }
        }

        logger.info('E2E_SEED_STUDY_STATE_COMPLETED', {
            requestId,
            route: '/api/test/e2e/seed-study-state',
            userId,
            tags: {
                seededFavorites: String(seededFavorites.length),
                seededDueTerms: String(seededDueTerms.length),
            },
        });

        return successResponse({
            ok: true,
            userId,
            seededFavorites,
            seededDueTerms,
        }, requestId);
    } catch (error) {
        return handleRouteError(error, {
            requestId,
            code: 'E2E_SEED_FAILED',
            message: 'Unable to seed deterministic E2E study state.',
            timeoutCode: 'E2E_SEED_TIMEOUT',
            timeoutMessage: 'E2E seed request timed out.',
            retryable: false,
            logLabel: 'E2E_SEED_STUDY_STATE_FAILED',
        });
    }
}
