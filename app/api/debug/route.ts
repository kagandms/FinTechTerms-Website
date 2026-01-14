
import { NextResponse } from 'next/server';
import { mockTerms } from '@/data/mockData';
import { terms } from '@/data/terms';

export async function GET() {
    return NextResponse.json({
        message: 'Debug Info',
        mockTermsCount: mockTerms ? mockTerms.length : 'undefined',
        termsCount: terms ? terms.length : 'undefined',
        sampleTerm: mockTerms && mockTerms.length > 0 ? mockTerms[0] : 'none'
    });
}
