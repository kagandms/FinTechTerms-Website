import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import InstallButton from '@/components/InstallButton';

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({
        t: (key: string) => ({
            'install.cta': 'Install',
            'install.manualTitle': 'How to Install?',
            'install.iosTitle': 'How to Install on iOS?',
            'install.manualDescription': 'You can install the app using the browser menu:',
            'install.iosDescription': 'Follow these steps to add this app to your home screen:',
            'install.iosStep1Lead': 'Tap the',
            'install.iosStep1Action': 'Share button',
            'install.iosStep2': 'Select "Add to Home Screen"',
            'install.manualStep1': 'Open browser menu (⋮)',
            'install.manualStep2': 'Select "Install App" or "Add to Home Screen"',
            'shell.close': 'Close',
        }[key] ?? key),
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

    it('renders a manual-install fallback button when no install prompt is available', async () => {
        render(<InstallButton />);

        fireEvent.click(screen.getByRole('button', { name: 'Install' }));

        expect(await screen.findByText('How to Install?')).toBeInTheDocument();
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

    it('supports the prominent variant without changing install behavior', async () => {
        const prompt = jest.fn().mockResolvedValue(undefined);
        const userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' });
        const installEvent = new Event('beforeinstallprompt') as Event & {
            prompt: typeof prompt;
            userChoice: typeof userChoice;
        };

        installEvent.prompt = prompt;
        installEvent.userChoice = userChoice;

        render(<InstallButton variant="prominent" />);
        await act(async () => {
            window.dispatchEvent(installEvent);
        });

        const button = await screen.findByRole('button', { name: 'Install' });
        expect(button.className).toContain('px-4');

        fireEvent.click(button);

        await waitFor(() => {
            expect(prompt).toHaveBeenCalledTimes(1);
        });
    });

    it('shows iOS manual install instructions when the platform supports add-to-home-screen only', async () => {
        Object.defineProperty(window.navigator, 'userAgent', {
            configurable: true,
            value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        });

        render(<InstallButton />);

        fireEvent.click(await screen.findByRole('button', { name: 'Install' }));

        expect(await screen.findByText('How to Install on iOS?')).toBeInTheDocument();
    });
});
