import { getPublicEnv } from '@/lib/env';

export const getSiteUrl = (): string => getPublicEnv().siteUrl;
