/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import LanguageSwitcher from '@/components/LanguageSwitcher';

const mockUseLanguage = jest.fn();

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => mockUseLanguage(),
    languageNames: {
        tr: { native: 'Türkçe', english: 'Turkish' },
        en: { native: 'English', english: 'English' },
        ru: { native: 'Русский', english: 'Russian' },
    },
    languageFlags: {
        tr: '🇹🇷',
        en: '🇬🇧',
        ru: '🇷🇺',
    },
}));

describe('LanguageSwitcher', () => {
    it('keeps dark-mode contrast classes on the trigger and dropdown items', () => {
        mockUseLanguage.mockReturnValue({
            language: 'en',
            setLanguage: jest.fn(),
        });

        render(<LanguageSwitcher />);

        const trigger = screen.getByRole('button');
        expect(trigger.className).toContain('dark:bg-slate-900/90');
        expect(trigger.className).toContain('dark:border-slate-600');

        fireEvent.click(trigger);

        const englishOption = screen.getAllByText('English')[1]?.closest('button');
        expect(englishOption?.className).toContain('dark:bg-primary-500/20');

        const turkishOption = screen.getByText('Türkçe').closest('button');
        expect(turkishOption?.className).toContain('dark:hover:bg-slate-800');
    });
});
