/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import TelegramBanner from '@/components/TelegramBanner';

const mockUseLanguage = jest.fn();

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => mockUseLanguage(),
}));

describe('TelegramBanner', () => {
    it('renders English copy for the full variant', () => {
        mockUseLanguage.mockReturnValue({ language: 'en' });

        render(<TelegramBanner variant="full" />);

        expect(screen.getByText('Ecosystem integration')).toBeInTheDocument();
        expect(screen.getByText('Telegram API integration')).toBeInTheDocument();
        expect(screen.getByText('Open integration')).toBeInTheDocument();
    });

    it('renders Turkish copy for the compact variant', () => {
        mockUseLanguage.mockReturnValue({ language: 'tr' });

        render(<TelegramBanner variant="compact" />);

        expect(screen.getByText('Ekosistem entegrasyonu')).toBeInTheDocument();
        expect(screen.getByText('Telegram API entegrasyonu')).toBeInTheDocument();
    });
});
