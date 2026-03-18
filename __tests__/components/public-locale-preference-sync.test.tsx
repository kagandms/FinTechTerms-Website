/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render } from '@testing-library/react';
import PublicLocalePreferenceSync from '@/components/public-locale-preference-sync';

const mockPersistLocalePreference = jest.fn();

jest.mock('@/lib/client-locale-preference', () => ({
    persistLocalePreference: (...args: unknown[]) => mockPersistLocalePreference(...args),
}));

describe('PublicLocalePreferenceSync', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('persists the current public locale on mount and when it changes', () => {
        const { rerender } = render(<PublicLocalePreferenceSync locale="ru" />);

        expect(mockPersistLocalePreference).toHaveBeenCalledWith('ru');

        rerender(<PublicLocalePreferenceSync locale="en" />);

        expect(mockPersistLocalePreference).toHaveBeenLastCalledWith('en');
    });
});
