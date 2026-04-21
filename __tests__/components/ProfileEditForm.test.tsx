import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
    createAbortError,
    PROFILE_PASSWORD_HARD_TIMEOUT_MS,
    PROFILE_SUBMIT_TIMEOUT_MS,
    ProfileEditForm,
    runWithAbortSignal,
} from '@/components/features/profile/ProfileEditForm';

const mockShowToast = jest.fn();
const mockShowToastAfterRefresh = jest.fn();
const mockRefresh = jest.fn();
const mockFetch = jest.fn();

jest.mock('@/contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: mockShowToast,
        showToastAfterRefresh: mockShowToastAfterRefresh,
    }),
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        user: {
            id: 'user-1',
            email: 'alex@example.com',
            name: 'Alex Stone',
            createdAt: '2026-03-11T00:00:00.000Z',
            primaryProvider: 'email',
            providers: ['email'],
        },
        isAuthenticated: true,
    }),
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        refresh: mockRefresh,
    }),
}));

const initialData = {
    userId: 'user-1',
    name: 'Alex',
    surname: 'Stone',
    email: 'alex@example.com',
    birthDate: '2000-01-01',
};

describe('ProfileEditForm timeout helpers', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('rejects with an abort error when the submit controller times out', async () => {
        const controller = new AbortController();
        const timeoutMessage = 'Profile update timed out. Please try again.';

        const pendingOperation = runWithAbortSignal(
            controller.signal,
            async () => await new Promise<never>(() => {}),
            timeoutMessage
        );
        const expectation = expect(pendingOperation).rejects.toEqual(createAbortError(timeoutMessage));

        setTimeout(() => {
            controller.abort();
        }, PROFILE_SUBMIT_TIMEOUT_MS);

        await jest.advanceTimersByTimeAsync(PROFILE_SUBMIT_TIMEOUT_MS);
        await expectation;
    });
});

describe('ProfileEditForm submit flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = mockFetch as unknown as typeof fetch;
    });

    it('shows full success when profile save succeeds', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: 'ok',
                message: 'Successfully saved',
            }),
        });

        render(
            <ProfileEditForm
                language="en"
                initialData={initialData}
            />
        );

        fireEvent.click(screen.getByTestId('profile-save'));

        await waitFor(() => {
            expect(mockShowToastAfterRefresh).toHaveBeenCalledWith('Successfully saved', 'success');
        });

        expect(mockRefresh).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Successfully saved')).toBeInTheDocument();
    });

    it('hydrates profile fields from the authenticated fallback when server initial data is missing', async () => {
        render(
            <ProfileEditForm
                language="en"
                initialData={null}
            />
        );

        await waitFor(() => {
            expect(screen.getByTestId('profile-name')).toHaveValue('Alex');
            expect(screen.getByTestId('profile-surname')).toHaveValue('Stone');
            expect(screen.getByDisplayValue('alex@example.com')).toBeInTheDocument();
        });
    });

    it('hydrates profile fields from the authenticated fallback when server initial data is incomplete', async () => {
        render(
            <ProfileEditForm
                language="en"
                initialData={{
                    userId: 'user-1',
                    name: '',
                    surname: '',
                    email: null,
                    birthDate: '',
                }}
            />
        );

        await waitFor(() => {
            expect(screen.getByTestId('profile-name')).toHaveValue('Alex');
            expect(screen.getByTestId('profile-surname')).toHaveValue('Stone');
            expect(screen.getByDisplayValue('alex@example.com')).toBeInTheDocument();
        });
    });

    it('treats metadata sync warnings as partial success when the route reports partial_metadata_sync', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: 'partial_metadata_sync',
                message: 'Profile details were saved, but the secondary auth sync did not complete.',
            }),
        });

        render(
            <ProfileEditForm
                language="en"
                initialData={initialData}
            />
        );

        fireEvent.click(screen.getByTestId('profile-save'));

        await waitFor(() => {
            expect(mockShowToastAfterRefresh).toHaveBeenCalledWith(
                'Profile details were saved, but the secondary auth sync did not complete.',
                'warning'
            );
        });

        expect(mockRefresh).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Profile details were saved, but the secondary auth sync did not complete.')).toBeInTheDocument();
    });

    it('treats profile route failures as hard errors', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: jest.fn().mockResolvedValue({
                message: 'Something went wrong. Please try again.',
            }),
        });

        render(
            <ProfileEditForm
                language="en"
                initialData={initialData}
            />
        );

        fireEvent.click(screen.getByTestId('profile-save'));

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(
                'Something went wrong. Please try again.',
                'error'
            );
        });

        expect(mockShowToastAfterRefresh).not.toHaveBeenCalled();
        expect(mockRefresh).not.toHaveBeenCalled();
        expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });

    it('updates password through the dedicated auth route without triggering a profile refresh', async () => {
        mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('/api/auth/update-password')) {
                return {
                    ok: true,
                    status: 200,
                    json: jest.fn().mockResolvedValue({ success: true }),
                } as unknown as Response;
            }

            return {
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({
                    status: 'ok',
                    message: 'Successfully saved',
                }),
            } as unknown as Response;
        });

        render(
            <ProfileEditForm
                language="en"
                initialData={initialData}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
        fireEvent.change(screen.getByLabelText('Current Password'), {
            target: { value: 'OldPassword1!' },
        });
        fireEvent.change(screen.getByLabelText('New Password'), {
            target: { value: 'NewPassword1!' },
        });
        fireEvent.change(screen.getByLabelText('Confirm New Password'), {
            target: { value: 'NewPassword1!' },
        });
        fireEvent.click(screen.getByTestId('profile-password-save'));

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith('Password updated successfully!', 'success');
        });

        expect(mockFetch).toHaveBeenCalledWith('/api/auth/update-password', expect.objectContaining({
            method: 'POST',
            credentials: 'same-origin',
        }));
        expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('shows a slow-operation warning for password updates instead of surfacing a timeout failure', async () => {
        jest.useFakeTimers();
        mockFetch.mockImplementation((input: RequestInfo | URL) => {
            const url = String(input);

            if (url.includes('/api/auth/update-password')) {
                return new Promise(() => undefined);
            }

            return Promise.resolve({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({ success: true }),
            } as unknown as Response);
        });

        render(
            <ProfileEditForm
                language="en"
                initialData={initialData}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
        fireEvent.change(screen.getByLabelText('Current Password'), {
            target: { value: 'OldPassword1!' },
        });
        fireEvent.change(screen.getByLabelText('New Password'), {
            target: { value: 'NewPassword1!' },
        });
        fireEvent.change(screen.getByLabelText('Confirm New Password'), {
            target: { value: 'NewPassword1!' },
        });
        fireEvent.click(screen.getByTestId('profile-password-save'));

        await act(async () => {
            await jest.advanceTimersByTimeAsync(PROFILE_SUBMIT_TIMEOUT_MS);
        });

        await waitFor(() => {
            expect(screen.getByText('Password update is taking longer than expected. Please wait.')).toBeInTheDocument();
        });

        expect(mockShowToast).not.toHaveBeenCalledWith('Password update timed out. Please try again.', 'error');
        jest.useRealTimers();
    });

    it('aborts a hanging password update after the hard timeout window', async () => {
        jest.useFakeTimers();
        let requestSignal: AbortSignal | undefined;
        mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);

            if (url.includes('/api/auth/update-password')) {
                requestSignal = init?.signal as AbortSignal | undefined;
                return new Promise((_, reject) => {
                    requestSignal?.addEventListener('abort', () => {
                        reject(new DOMException('The operation was aborted.', 'AbortError'));
                    }, { once: true });
                });
            }

            return Promise.resolve({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({ success: true }),
            } as unknown as Response);
        });

        render(
            <ProfileEditForm
                language="en"
                initialData={initialData}
            />
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
        fireEvent.change(screen.getByLabelText('Current Password'), {
            target: { value: 'OldPassword1!' },
        });
        fireEvent.change(screen.getByLabelText('New Password'), {
            target: { value: 'NewPassword1!' },
        });
        fireEvent.change(screen.getByLabelText('Confirm New Password'), {
            target: { value: 'NewPassword1!' },
        });
        fireEvent.click(screen.getByTestId('profile-password-save'));

        await act(async () => {
            await jest.advanceTimersByTimeAsync(PROFILE_PASSWORD_HARD_TIMEOUT_MS);
        });

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith('Password update timed out. Please try again.', 'error');
        });
        expect(requestSignal).toBeDefined();
        expect(requestSignal?.aborted).toBe(true);

        jest.useRealTimers();
    });
});
