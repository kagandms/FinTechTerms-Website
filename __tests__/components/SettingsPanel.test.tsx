/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { SettingsPanel } from '@/components/features/profile/SettingsPanel';

jest.mock('@/components/NotificationSettings', () => () => <div data-testid="notification-settings" />);

describe('SettingsPanel', () => {
    it('links profile destinations to app-shell pages and renders the integrated profile editor section', () => {
        render(
            <SettingsPanel
                t={(key: string) => key}
                language="en"
                setLanguage={jest.fn()}
                theme="light"
                setTheme={jest.fn()}
                onResetClick={jest.fn()}
                profileEditorSection={{
                    title: 'Edit Profile',
                    description: 'Update account details.',
                    isOpen: true,
                    toggleLabel: 'Close',
                    onToggle: jest.fn(),
                    toggleTestId: 'profile-edit-toggle',
                    content: <div data-testid="profile-edit-form">Form</div>,
                }}
            />
        );

        expect(screen.getByTestId('profile-edit-toggle')).toBeInTheDocument();
        expect(screen.getByTestId('profile-edit-form')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /about.viewAbout/i })).toHaveAttribute('href', '/profile/about');
        expect(screen.getByRole('link', { name: /settingsPanel.methodology/i })).toHaveAttribute('href', '/profile/methodology');
    });
});
