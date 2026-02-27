/**
 * API Versioning Strategy (M44)
 * Skill: api-design-principles, api-patterns
 *
 * Documents the API versioning approach for FinTechTerms.
 * Currently, API routes are minimal (Supabase handles most data access),
 * but this establishes conventions for future growth.
 */

/**
 * API Version Convention
 *
 * Pattern: /api/v{major}/{resource}
 * Current: No versioned routes (all at /api/)
 * Target:  /api/v1/record-quiz, /api/v1/debug
 *
 * Versioning Rules:
 * 1. Breaking changes → increment major version
 * 2. New fields → backward compatible (no version bump)
 * 3. Deprecated fields → mark in docs, remove in next major
 *
 * Migration Strategy:
 * - Keep v1 running for 6 months after v2 release
 * - Return Deprecation header on old versions
 * - Use Next.js middleware for version routing
 */

export const API_VERSION = 'v1';
export const API_BASE = `/api/${API_VERSION}`;

/**
 * Creates a versioned API URL.
 * @example apiUrl('/record-quiz') → '/api/v1/record-quiz'
 */
export function apiUrl(path: string): string {
    return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Standard API response envelope.
 * All API responses should follow this shape.
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
    meta?: {
        version: string;
        timestamp: string;
    };
}

/**
 * Creates a standard success response.
 */
export function createSuccessResponse<T>(data: T): ApiResponse<T> {
    return {
        success: true,
        data,
        meta: {
            version: API_VERSION,
            timestamp: new Date().toISOString(),
        },
    };
}

/**
 * Creates a standard error response.
 */
export function createErrorResponse(code: string, message: string): ApiResponse {
    return {
        success: false,
        error: { code, message },
        meta: {
            version: API_VERSION,
            timestamp: new Date().toISOString(),
        },
    };
}
