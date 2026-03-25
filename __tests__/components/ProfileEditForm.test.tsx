import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
    createAbortError,
    PROFILE_SUBMIT_TIMEOUT_MS,
    ProfileEditForm,
    runWithAbortSignal,
} from '@/components/features/profile/ProfileEditForm';

const mockGetSupabaseClient = jest.fn();
const mockShowToast = jest.fn();
const mockShowToastAfterRefresh = jest.fn();
const mockRefresh = jest.fn();

jest.mock('@/lib/supabase', () => ({
    getSupabaseClient: () => mockGetSupabaseClient(),
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

type SupabaseUserResponse = {
    data: {
        user: {
            id: string;
            email: string;
            user_metadata: Record<string, unknown>;
            app_metadata: Record<string, unknown>;
        };
    };
    error: null;
};

const baseUserResponse: SupabaseUserResponse = {
    data: {
        user: {
            id: 'user-1',
            email: 'alex@example.com',
            user_metadata: {
                full_name: 'Alex Stone',
                birth_date: '2000-01-01',
            },
            app_metadata: {
                provider: 'email',
                providers: ['email'],
            },
        },
    },
    error: null,
};

const initialData = {
    userId: 'user-1',
    name: 'Alex',
    surname: 'Stone',
    email: 'alex@example.com',
    birthDate: '2000-01-01',
};

const createSupabaseMock = (options?: {
    metadataError?: { code?: string; message?: string } | null;
    profileError?: { message?: string } | null;
    profileLoadError?: { message?: string } | null;
    profileLoadData?: { full_name?: string | null; birth_date?: string | null } | null;
    loadUserResponse?: SupabaseUserResponse;
}): {
    auth: {
        getUser: jest.Mock;
        updateUser: jest.Mock;
        signInWithPassword: jest.Mock;
    };
    from: jest.Mock;
} => {
    const maybeSingle = jest.fn().mockResolvedValue({
        data: options?.profileLoadData ?? null,
        error: options?.profileLoadError ?? null,
    });
    const selectEq = jest.fn(() => ({ maybeSingle }));
    const select = jest.fn(() => ({ eq: selectEq }));
    const abortSignal = jest.fn().mockResolvedValue({
        error: options?.profileError ?? null,
    });
    const eq = jest.fn(() => ({ abortSignal }));
    const update = jest.fn(() => ({ eq }));

    return {
        auth: {
            getUser: jest.fn().mockResolvedValue(options?.loadUserResponse ?? baseUserResponse),
            updateUser: jest.fn().mockResolvedValue({
                error: options?.metadataError ?? null,
            }),
            signInWithPassword: jest.fn(),
        },
        from: jest.fn(() => ({ update, select })),
    };
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
    });

    it('shows full success when auth metadata and profile sync both succeed', async () => {
        mockGetSupabaseClient.mockReturnValue(createSupabaseMock());

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
        expect(mockShowToast).not.toHaveBeenCalledWith(expect.stringContaining('secondary profile sync'), 'warning');
    });

    it('hydrates profile fields from the authenticated fallback when server initial data is missing', async () => {
        mockGetSupabaseClient.mockReturnValue(createSupabaseMock({
            loadUserResponse: {
                data: {
                    user: {
                        ...baseUserResponse.data.user,
                        user_metadata: {},
                    },
                },
                error: null,
            },
            profileLoadData: {
                full_name: 'Alex Stone',
                birth_date: '2000-01-01',
            },
        }));

        render(
            <ProfileEditForm
                language="en"
                initialData={null}
            />
        );

        await waitFor(() => {
            expect(screen.getByTestId('profile-name')).toHaveValue('Alex');
            expect(screen.getByTestId('profile-surname')).toHaveValue('Stone');
            expect(screen.getByTestId('profile-birth-date')).toHaveValue('2000-01-01');
            expect(screen.getByDisplayValue('alex@example.com')).toBeInTheDocument();
        });
    });

    it('keeps metadata failures as hard errors', async () => {
        mockGetSupabaseClient.mockReturnValue(createSupabaseMock({
            metadataError: {
                code: '42501',
                message: 'RLS denied',
            },
        }));

        render(
            <ProfileEditForm
                language="en"
                initialData={initialData}
            />
        );

        fireEvent.click(screen.getByTestId('profile-save'));

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(
                'You do not have permission to perform this action.',
                'error'
            );
        });

        expect(mockShowToastAfterRefresh).not.toHaveBeenCalled();
        expect(mockRefresh).not.toHaveBeenCalled();
        expect(screen.getByText('You do not have permission to perform this action.')).toBeInTheDocument();
    });

    it('treats profile sync failures as partial success after metadata succeeds', async () => {
        mockGetSupabaseClient.mockReturnValue(createSupabaseMock({
            profileError: {
                message: 'profiles sync failed',
            },
        }));

        render(
            <ProfileEditForm
                language="en"
                initialData={initialData}
            />
        );

        fireEvent.click(screen.getByTestId('profile-save'));

        await waitFor(() => {
            expect(mockShowToastAfterRefresh).toHaveBeenCalledWith(
                'Profile details were saved, but the secondary profile sync did not complete.',
                'warning'
            );
        });

        expect(mockRefresh).toHaveBeenCalledTimes(1);
        expect(screen.getByText('Profile details were saved, but the secondary profile sync did not complete.')).toBeInTheDocument();
    });

    it('updates password through the dedicated password action without triggering a profile refresh', async () => {
        const supabaseMock = createSupabaseMock();
        supabaseMock.auth.signInWithPassword.mockResolvedValue({ error: null });
        mockGetSupabaseClient.mockReturnValue(supabaseMock);

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

        expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledTimes(1);
        expect(supabaseMock.auth.updateUser).toHaveBeenCalledTimes(1);
        expect(mockRefresh).not.toHaveBeenCalled();
    });
});
