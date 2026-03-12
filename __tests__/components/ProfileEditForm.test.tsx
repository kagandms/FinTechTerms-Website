import {
    createAbortError,
    PROFILE_SUBMIT_TIMEOUT_MS,
    runWithAbortSignal,
} from '@/components/features/profile/ProfileEditForm';

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
