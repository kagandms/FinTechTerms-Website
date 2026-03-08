/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { CONSENT_GRANTED_EVENT } from '@/components/ConsentModal';

jest.mock('next/script', () => {
    return function MockScript({
        children,
        id,
        src,
    }: {
        children?: React.ReactNode;
        id?: string;
        src?: string;
    }) {
        return (
            <script data-testid={id || src || 'script'}>
                {children}
            </script>
        );
    };
});

const CONSENT_KEY = 'fintechterms_research_consent';

const setConsent = (given: boolean) => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
        given,
        timestamp: new Date().toISOString(),
        version: '1.0',
    }));
};

describe('GoogleAnalytics', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('does not render analytics scripts before consent is granted', () => {
        render(<GoogleAnalytics />);

        expect(screen.queryByTestId('google-analytics')).not.toBeInTheDocument();
    });

    it('renders analytics scripts immediately when consentGranted fires in the same tab', async () => {
        render(<GoogleAnalytics />);

        setConsent(true);
        await act(async () => {
            window.dispatchEvent(new CustomEvent(CONSENT_GRANTED_EVENT));
        });

        await waitFor(() => {
            expect(screen.getByTestId('google-analytics')).toBeInTheDocument();
        });
    });
});
