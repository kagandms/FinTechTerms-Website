import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// API Key for bot/simulation access (store in environment variable)
const API_KEY = process.env.QUIZ_API_KEY || 'ftt_research_api_key_2026';

// Rate limiting map (simple in-memory, resets on restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

/**
 * Validate API key from request headers
 */
function validateApiKey(request: NextRequest): boolean {
    const apiKey = request.headers.get('X-API-Key');
    return apiKey === API_KEY;
}

/**
 * Check rate limit for IP address
 */
function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
        return true;
    }

    if (record.count >= RATE_LIMIT) {
        return false;
    }

    record.count += 1;
    return true;
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
    if (!checkRateLimit(ip)) {
        return NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.' },
            { status: 429 }
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
