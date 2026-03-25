/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import ProfileLinkedPageClient from '@/app/profile/ProfileLinkedPageClient';

const mockUseLanguage = jest.fn();

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => mockUseLanguage(),
}));

describe('ProfileLinkedPageClient', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the app-shell about page with a back link to profile', () => {
        mockUseLanguage.mockReturnValue({ language: 'en' });

        render(<ProfileLinkedPageClient page="about" />);

        expect(screen.getByRole('link', { name: /back to profile/i })).toHaveAttribute('href', '/profile');
        expect(screen.getByText('About the Project')).toBeInTheDocument();
    });

    it('renders the app-shell methodology page in Turkish', () => {
        mockUseLanguage.mockReturnValue({ language: 'tr' });

        render(<ProfileLinkedPageClient page="methodology" />);

        expect(screen.getByRole('link', { name: /profile dön/i })).toHaveAttribute('href', '/profile');
        expect(screen.getByText('Metodoloji')).toBeInTheDocument();
        expect(screen.getByText('Yöntem özeti')).toBeInTheDocument();
    });

    it('renders Turkish characters for the about page copy', () => {
        mockUseLanguage.mockReturnValue({ language: 'tr' });

        render(<ProfileLinkedPageClient page="about" />);

        expect(screen.getByText('Proje Hakkında')).toBeInTheDocument();
        expect(screen.getByText('Genel bakış')).toBeInTheDocument();
    });
});
