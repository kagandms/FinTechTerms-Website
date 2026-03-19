import { headers } from 'next/headers';
import { CSP_NONCE_HEADER } from '@/lib/csp';

export const getScriptNonce = async (): Promise<string | undefined> => {
    try {
        const requestHeaders = await headers();
        const nonce = requestHeaders.get(CSP_NONCE_HEADER)?.trim();
        return nonce || undefined;
    } catch {
        return undefined;
    }
};
