/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PublicAnalyticsGate from '@/components/PublicAnalyticsGate';
import { RESEARCH_CONSENT_KEY } from '@/lib/research-consent';

const GA_ID = 'G-TEST123456';

const normalizeDataLayerCommands = (): unknown[][] => (
    (window.dataLayer ?? [])
        .filter((entry): entry is IArguments => (
            typeof entry === 'object'
            && entry !== null
            && Object.prototype.hasOwnProperty.call(entry, 'callee')
        ))
        .map((entry) => Array.from(entry))
);

describe('PublicAnalyticsGate', () => {
    beforeEach(() => {
        localStorage.clear();
        document.head.innerHTML = '';
        window.dataLayer = undefined;
        window.gtag = undefined;
    });

    it('does not ship a consent banner when analytics is not configured', async () => {
        render(<PublicAnalyticsGate language="en" gaId={null} />);

        await waitFor(() => {
            expect(screen.queryByText('Analytics consent')).not.toBeInTheDocument();
        });
    });

    it('stores public consent and loads Google Analytics after acceptance', async () => {
        render(<PublicAnalyticsGate language="tr" gaId={GA_ID} />);

        await waitFor(() => {
            expect(screen.getByText('Analytics izni')).toBeInTheDocument();
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'İzin ver' }));
        });

        expect(JSON.parse(localStorage.getItem(RESEARCH_CONSENT_KEY) ?? '{}')).toMatchObject({
            given: true,
            version: '1.0',
        });
        await waitFor(() => {
            expect(document.getElementById('google-analytics-loader')).toHaveAttribute(
                'src',
                `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
            );
            expect(normalizeDataLayerCommands()).toEqual(expect.arrayContaining([
                ['config', GA_ID],
            ]));
        });
    });
});
