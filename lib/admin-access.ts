import { getServerEnv, type ServerEnv } from '@/lib/env';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const normalizeAdminUserIds = (rawValue: string | null | undefined): string[] => {
    if (!rawValue) {
        return [];
    }

    return rawValue
        .split(',')
        .map((value) => value.trim())
        .filter((value) => UUID_PATTERN.test(value));
};

export const isAdminUserId = (
    userId: string | null | undefined,
    env: Pick<ServerEnv, 'adminUserIds'> = getServerEnv()
): boolean => (
    typeof userId === 'string'
    && userId.length > 0
    && Array.isArray(env.adminUserIds)
    && env.adminUserIds.includes(userId)
);
