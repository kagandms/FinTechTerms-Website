import { getPublicEnv } from '@/lib/public-env';

export const getSiteUrl = (): string => getPublicEnv().siteUrl;
