import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { globalRateLimiter } from '@/lib/rate-limiter';
import { QuizAttemptSchema } from '@/lib/validators';
import { z } from 'zod';

const API_KEY = process.env.QUIZ_API_KEY;

function validateApiKey(request: NextRequest): boolean {
    if (!API_KEY) return false;
    const apiKey = request.headers.get('X-API-Key');
    return apiKey === API_KEY;
}

export async function POST(request: NextRequest) {
    // 1. Rate Limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const limitCheck = globalRateLimiter.check(ip);

    const headers = {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': limitCheck.remaining.toString(),
    };

    if (!limitCheck.allowed) {
        return NextResponse.json(
            { error: 'Rate limit exceeded' },
            { status: 429, headers: { ...headers, 'Retry-After': limitCheck.retryAfter.toString() } }
        );
    }

    // 2. Auth Check
    if (!validateApiKey(request)) {
        return NextResponse.json(
            { error: 'Invalid API Key' },
            { status: 401, headers }
        );
    }

    try {
        const body = await request.json();

        // 3. Validation with Zod
        const validatedData = QuizAttemptSchema.parse(body);

        const {
            term_id, is_correct, response_time_ms,
            quiz_type, anonymous_id, user_id
        } = validatedData;

        // 4. Database Insert
        const { data, error } = await supabase.from('quiz_attempts').insert({
            user_id: user_id || null, // Ensure null if undefined
            term_id,
            is_correct,
            response_time_ms,
            quiz_type,
            // anonymous_id could be stored in metadata or a separate column if schema supports it
        }).select('id').single();

        if (error) {
            console.error('DB Error:', error);
            return NextResponse.json({ error: 'Database error' }, { status: 500, headers });
        }

        return NextResponse.json({
            success: true,
            id: data.id,
            message: 'Recorded successfully'
        }, { headers });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({
                error: 'Validation Error',
                details: error.errors
            }, { status: 400, headers });
        }

        return NextResponse.json({
            error: 'Internal Server Error'
        }, { status: 500, headers });
    }
}

export async function GET() {
    return NextResponse.json({
        status: 'active',
        service: 'FinTechTerms Quiz API',
        rate_limit: '100/min',
        documentation: 'POST /api/record-quiz with X-API-Key'
    });
}

