/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import SRSNotificationCard from '@/components/profile/SRSNotificationCard';

const mockUseLanguage = jest.fn();

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => mockUseLanguage(),
}));

describe('SRSNotificationCard', () => {
    it('renders English copy when the selected language is en', () => {
        mockUseLanguage.mockReturnValue({ language: 'en' });

        render(<SRSNotificationCard dueCount={3} lastReviewDate="2026-03-20T00:00:00.000Z" />);

        expect(screen.getByText('Academic SRS notification')).toBeInTheDocument();
        expect(screen.getByText(/3 terms are currently ready/i)).toBeInTheDocument();
    });

    it('renders Turkish compact copy when the selected language is tr', () => {
        mockUseLanguage.mockReturnValue({ language: 'tr' });

        render(<SRSNotificationCard dueCount={0} variant="compact" />);

        expect(screen.getByText('Akademik SRS bildirimi')).toBeInTheDocument();
        expect(screen.getByText('Bir sonraki tekrar bildirimi')).toBeInTheDocument();
    });
});
