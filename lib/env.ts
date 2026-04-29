import 'server-only';

export type { PublicEnv } from '@/lib/public-env';
export {
    getPublicEnv,
    hasConfiguredPublicSupabaseEnv,
} from '@/lib/public-env';

export type { ServerEnv } from '@/lib/server-env';
export {
    assertProductionRateLimiterEnv,
    assertProductionRuntimeEnv,
    getServerEnv,
    hasConfiguredAiEnv,
    hasConfiguredRateLimiterEnv,
    hasConfiguredServiceRoleEnv,
    hasConfiguredStudySessionEnv,
} from '@/lib/server-env';
