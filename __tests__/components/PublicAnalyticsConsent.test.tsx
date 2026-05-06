/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PublicAnalyticsConsent from '@/components/PublicAnalyticsConsent';
import { RESEARCH_CONSENT_KEY } from '@/lib/research-consent';

const GA_ID = 'G-TEST123456';

describe('PublicAnalyticsConsent', () => {
    beforeEach(() => {
        localStorage.clear();
        process.env.NEXT_PUBLIC_GA_ID = GA_ID;
    });

    it('stores granted consent from the public banner', async () => {
        render(<PublicAnalyticsConsent language="tr" />);

        await waitFor(() => {
            expect(screen.getByText('Analytics izni')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', { name: 'İzin ver' }));

        expect(screen.queryByText('Analytics izni')).not.toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem(RESEARCH_CONSENT_KEY) ?? '{}')).toMatchObject({
            given: true,
            version: '1.0',
        });
    });

    it('does not render when Google Analytics is not configured', async () => {
        process.env.NEXT_PUBLIC_GA_ID = '';

        render(<PublicAnalyticsConsent language="en" />);

        await waitFor(() => {
            expect(screen.queryByText('Analytics consent')).not.toBeInTheDocument();
        });
    });
});
