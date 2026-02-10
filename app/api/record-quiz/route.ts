import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// API Key for bot/simulation access (MUST be set in environment variables)
const API_KEY = process.env.QUIZ_API_KEY;

// Sliding window rate limiter with automatic cleanup
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 100; // max requests per window
const RATE_WINDOW = 60000; // 1 minute window

// Cleanup stale entries every 5 minutes to prevent memory leaks
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanupStaleEntries(): void {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;
    const cutoff = now - RATE_WINDOW;
    for (const [ip, timestamps] of rateLimitMap.entries()) {
        const valid = timestamps.filter(t => t > cutoff);
        if (valid.length === 0) {
            rateLimitMap.delete(ip);
        } else {
            rateLimitMap.set(ip, valid);
        }
    }
}

/**
 * Validate API key from request headers
 */
function validateApiKey(request: NextRequest): boolean {
    if (!API_KEY) return false; // Reject all if env var is not configured
    const apiKey = request.headers.get('X-API-Key');
    return apiKey === API_KEY;
}

/**
 * Sliding window rate limiter — returns remaining count or -1 if exceeded
 */
function checkRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfter: number } {
    cleanupStaleEntries();
    const now = Date.now();
    const cutoff = now - RATE_WINDOW;
    const timestamps = (rateLimitMap.get(ip) || []).filter(t => t > cutoff);

    if (timestamps.length >= RATE_LIMIT) {
        const oldestInWindow = timestamps[0] ?? now;
        const retryAfter = Math.ceil((oldestInWindow + RATE_WINDOW - now) / 1000);
        return { allowed: false, remaining: 0, retryAfter };
    }

    timestamps.push(now);
    rateLimitMap.set(ip, timestamps);
    return { allowed: true, remaining: RATE_LIMIT - timestamps.length, retryAfter: 0 };
}

/**
 * POST /api/record-quiz
 * 
 * Records a quiz attempt for academic research
 * Accepts external data from Python scripts or simulations
 * 
 * Headers:
 * - X-API-Key: Required API key for authentication
 * 
 * Body:
 * {
 *   term_id: string (required)
 *   is_correct: boolean (required)
 *   response_time_ms: number (required)
 *   quiz_type?: 'daily' | 'practice' | 'review' | 'simulation'
 *   anonymous_id?: string (for non-authenticated requests)
 *   user_id?: string (optional, for authenticated users)
 *   metadata?: object (optional additional data)
 * }
 */
export async function POST(request: NextRequest) {
    // Get IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';

    // Check rate limit
    const rateCheck = checkRateLimit(ip);
    const rateLimitHeaders = {
        'X-RateLimit-Limit': RATE_LIMIT.toString(),
        'X-RateLimit-Remaining': rateCheck.remaining.toString(),
    };

    if (!rateCheck.allowed) {
        return NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.' },
            {
                status: 429,
                headers: {
                    ...rateLimitHeaders,
                    'Retry-After': rateCheck.retryAfter.toString(),
                },
            }
        );
    }

    // Validate API key
    if (!validateApiKey(request)) {
        return NextResponse.json(
            { error: 'Invalid or missing API key' },
            { status: 401 }
        );
    }

    try {
        const body = await request.json();

        // Validate required fields
        const { term_id, is_correct, response_time_ms } = body;

        if (!term_id || typeof term_id !== 'string') {
            return NextResponse.json(
                { error: 'term_id is required and must be a string' },
                { status: 400 }
            );
        }

        if (typeof is_correct !== 'boolean') {
            return NextResponse.json(
                { error: 'is_correct is required and must be a boolean' },
                { status: 400 }
            );
        }

        if (typeof response_time_ms !== 'number' || response_time_ms < 0) {
            return NextResponse.json(
                { error: 'response_time_ms is required and must be a positive number' },
                { status: 400 }
            );
        }

        // Optional fields
        const quiz_type = body.quiz_type || 'simulation';
        const anonymous_id = body.anonymous_id || `api_${Date.now()}`;
        const user_id = body.user_id || null;

        // Insert into quiz_attempts table
        const { data, error } = await supabase.from('quiz_attempts').insert({
            user_id: user_id,
            term_id: term_id,
            is_correct: is_correct,
            response_time_ms: response_time_ms,
            quiz_type: quiz_type,
        }).select('id').single();

        if (error) {
            console.error('Failed to insert quiz attempt:', error);
            return NextResponse.json(
                { error: 'Failed to record quiz attempt' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            id: data.id,
            message: 'Quiz attempt recorded successfully',
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Error processing request:', error);
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }
}

/**
 * GET /api/record-quiz
 * 
 * Health check endpoint and API documentation
 */
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        api: 'FinTechTerms Quiz Recording API',
        version: '1.0',
        endpoints: {
            POST: {
                description: 'Record a quiz attempt',
                headers: {
                    'X-API-Key': 'Required API key for authentication',
                    'Content-Type': 'application/json',
                },
                body: {
                    term_id: 'string (required)',
                    is_correct: 'boolean (required)',
                    response_time_ms: 'number (required)',
                    quiz_type: 'string (optional): daily|practice|review|simulation',
                    anonymous_id: 'string (optional)',
                    user_id: 'string (optional)',
                },
            },
        },
        rate_limit: `${RATE_LIMIT} requests per minute`,
    });
}
