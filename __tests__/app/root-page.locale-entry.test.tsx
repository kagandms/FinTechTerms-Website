/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import RootPage from '@/app/(root)/page';

const mockPersistLocalePreference = jest.fn();

jest.mock('@/lib/client-locale-preference', () => ({
    persistLocalePreference: (...args: unknown[]) => mockPersistLocalePreference(...args),
}));

jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ href, onClick, children, ...props }: { href: string; onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void; children: React.ReactNode }) => (
        <a
            href={href}
            {...props}
            onClick={(event) => {
                event.preventDefault();
                onClick?.(event);
            }}
        >
            {children}
        </a>
    ),
}));

describe('root locale entry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('persists locale preference when opening a public locale from the x-default page', () => {
        render(<RootPage />);

        fireEvent.click(screen.getByRole('link', { name: 'Open English' }));

        expect(mockPersistLocalePreference).toHaveBeenCalledWith('en');
    });
});
