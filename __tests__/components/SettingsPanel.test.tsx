/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { SettingsPanel } from '@/components/features/profile/SettingsPanel';

jest.mock('@/components/NotificationSettings', () => () => <div data-testid="notification-settings" />);

describe('SettingsPanel', () => {
    it('links the about entry to the selected public locale route', () => {
        render(
            <SettingsPanel
                t={(key: string) => key}
                language="en"
                setLanguage={jest.fn()}
                theme="light"
                setTheme={jest.fn()}
                onResetClick={jest.fn()}
            />
        );

        expect(screen.getByRole('link', { name: /about.viewAbout/i })).toHaveAttribute('href', '/en/about');
        expect(screen.getByRole('link', { name: /settingsPanel.methodology/i })).toHaveAttribute('href', '/en/methodology');
    });
});
