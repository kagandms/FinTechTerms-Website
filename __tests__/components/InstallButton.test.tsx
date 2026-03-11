import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InstallButton from '@/components/InstallButton';

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({
        language: 'en',
    }),
}));

const setStandaloneMode = (value: boolean) => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(() => ({
            matches: value,
            media: '(display-mode: standalone)',
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    });
};

describe('InstallButton', () => {
    beforeEach(() => {
        setStandaloneMode(false);
        Object.defineProperty(window.navigator, 'userAgent', {
            configurable: true,
            value: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36',
        });
        Object.defineProperty(window.navigator, 'standalone', {
            configurable: true,
            value: false,
        });
    });

    it('does not render before an install prompt is available', () => {
        render(<InstallButton />);

        expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument();
    });

    it('renders after beforeinstallprompt and invokes the prompt on click', async () => {
        const prompt = jest.fn().mockResolvedValue(undefined);
        const userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' });
        const installEvent = new Event('beforeinstallprompt') as Event & {
            prompt: typeof prompt;
            userChoice: typeof userChoice;
        };

        installEvent.prompt = prompt;
        installEvent.userChoice = userChoice;

        render(<InstallButton />);
        await act(async () => {
            window.dispatchEvent(installEvent);
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Install' }));

        await waitFor(() => {
            expect(prompt).toHaveBeenCalledTimes(1);
        });
    });
});
