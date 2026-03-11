import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProfileEditForm } from '@/components/features/profile/ProfileEditForm';

const mockGetUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockAbortSignal = jest.fn();
const mockEq = jest.fn();
const mockUpdate = jest.fn();
const mockFrom = jest.fn();
const mockShowToast = jest.fn();
const mockShowToastAfterRefresh = jest.fn();
const mockRefresh = jest.fn();
let consoleErrorSpy: jest.SpyInstance;

jest.mock('@/lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: (...args: unknown[]) => mockGetUser(...args),
            updateUser: (...args: unknown[]) => mockUpdateUser(...args),
            signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
        },
        from: (...args: unknown[]) => mockFrom(...args),
    },
}));

jest.mock('@/lib/auth/user', () => ({
    getSupabaseUserNameSeed: jest.fn(() => 'Test User'),
    supportsPasswordSignIn: jest.fn(() => true),
}));

jest.mock('@/contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: mockShowToast,
        showToastAfterRefresh: mockShowToastAfterRefresh,
    }),
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        refresh: mockRefresh,
    }),
}));

describe('ProfileEditForm', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        mockAbortSignal.mockResolvedValue({ error: null });
        mockEq.mockReturnValue({ abortSignal: mockAbortSignal });
        mockUpdate.mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ update: mockUpdate });
        mockUpdateUser.mockResolvedValue({ error: null });
        mockSignInWithPassword.mockResolvedValue({ error: null });
        mockGetUser
            .mockResolvedValueOnce({
                data: {
                    user: {
                        id: 'user-1',
                        email: 'user@example.com',
                    },
                },
                error: null,
            })
            .mockImplementationOnce(() => new Promise(() => {}));
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        jest.useRealTimers();
    });

    it('unlocks the form and surfaces a timeout error when submit hangs', async () => {
        render(
            <ProfileEditForm
                language="en"
                initialData={{
                    userId: 'user-1',
                    name: 'Jane',
                    surname: 'Doe',
                    email: 'jane@example.com',
                    birthDate: '1990-01-01',
                }}
            />
        );

        await waitFor(() => {
            expect(mockGetUser).toHaveBeenCalledTimes(1);
        });

        const submitButton = screen.getByRole('button', { name: 'Save Changes' });
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
        });

        await act(async () => {
            await jest.advanceTimersByTimeAsync(12_000);
        });

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith('Profile update timed out. Please try again.', 'error');
        });

        expect(screen.getByText('Profile update timed out. Please try again.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save Changes' })).not.toBeDisabled();
    });
});
