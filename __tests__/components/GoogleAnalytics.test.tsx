/**
 * @jest-environment jsdom
 */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { CONSENT_GRANTED_EVENT } from '@/components/ConsentModal';

const CONSENT_KEY = 'fintechterms_research_consent';
const GA_ID = 'G-TEST123456';

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
        document.head.innerHTML = '';
        window.dataLayer = undefined;
        window.gtag = undefined;
        process.env.NEXT_PUBLIC_GA_ID = GA_ID;
    });

    it('does not load analytics before consent is granted', () => {
        render(<GoogleAnalytics />);

        expect(document.getElementById('google-analytics-loader')).not.toBeInTheDocument();
    });

    it('loads analytics immediately when consentGranted fires in the same tab', async () => {
        render(<GoogleAnalytics />);
        const getItemSpy = jest.spyOn(Storage.prototype, 'getItem');

        setConsent(true);
        await act(async () => {
            window.dispatchEvent(new CustomEvent(CONSENT_GRANTED_EVENT));
        });

        expect(getItemSpy).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            const script = document.getElementById('google-analytics-loader');
            expect(script).toHaveAttribute(
                'src',
                `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
            );
            expect(window.dataLayer).toEqual(expect.arrayContaining([
                ['config', GA_ID],
            ]));
        });

        getItemSpy.mockRestore();
    });
});
