/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import InstallAppCard from '@/components/profile/install-app-card';

const mockIsStandaloneDisplayMode = jest.fn();

jest.mock('@/components/InstallButton', () => ({
    __esModule: true,
    default: () => <button type="button" data-testid="install-button">Install</button>,
    isStandaloneDisplayMode: () => mockIsStandaloneDisplayMode(),
}));

const renderCard = (): void => {
    render(
        <InstallAppCard
            title="Install App"
            description="Add to your home screen."
        />
    );
};

describe('InstallAppCard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: jest.fn().mockImplementation(() => ({
                matches: false,
                media: '(display-mode: standalone)',
                onchange: null,
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                dispatchEvent: jest.fn(),
            })),
        });
    });

    it('renders the install CTA when the app is not installed', async () => {
        mockIsStandaloneDisplayMode.mockReturnValue(false);

        renderCard();

        expect(await screen.findByText('Install App')).toBeInTheDocument();
        expect(screen.getByTestId('install-button')).toBeInTheDocument();
    });

    it('hides the card in standalone PWA mode', async () => {
        mockIsStandaloneDisplayMode.mockReturnValue(true);

        renderCard();

        await waitFor(() => {
            expect(screen.queryByText('Install App')).not.toBeInTheDocument();
        });
    });

    it('hides the card after the appinstalled event', async () => {
        mockIsStandaloneDisplayMode.mockReturnValue(false);

        renderCard();

        expect(await screen.findByText('Install App')).toBeInTheDocument();
        fireEvent(window, new Event('appinstalled'));

        await waitFor(() => {
            expect(screen.queryByText('Install App')).not.toBeInTheDocument();
        });
    });
});
