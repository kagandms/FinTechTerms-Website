/**
 * @jest-environment jsdom
 */

import {
    STUDY_SESSION_TAB_ID_KEY,
    buildStudySessionStorageKey,
    readTrackedStudySessionState,
} from '@/lib/study-session-storage';

describe('study-session storage recovery', () => {
    beforeEach(() => {
        sessionStorage.clear();
        sessionStorage.setItem(STUDY_SESSION_TAB_ID_KEY, 'tab-1');
    });

    it('returns corrupt when the stored session JSON is malformed', () => {
        sessionStorage.setItem(buildStudySessionStorageKey('tab-1'), '{broken-json');

        expect(readTrackedStudySessionState()).toEqual({
            status: 'corrupt',
            context: null,
        });
    });

    it('returns corrupt when only one side of the session token pair is present', () => {
        sessionStorage.setItem(buildStudySessionStorageKey('tab-1'), JSON.stringify({
            id: 'session-1',
            token: '',
        }));

        expect(readTrackedStudySessionState()).toEqual({
            status: 'corrupt',
            context: null,
        });
    });

    it('keeps fully unresolved session payloads in pending state', () => {
        sessionStorage.setItem(buildStudySessionStorageKey('tab-1'), JSON.stringify({
            id: null,
            token: null,
            startTime: Date.now(),
        }));

        expect(readTrackedStudySessionState()).toEqual({
            status: 'pending',
            context: null,
        });
    });

    it('restores a ready session context from the durable localStorage mirror', () => {
        localStorage.setItem(buildStudySessionStorageKey('tab-1'), JSON.stringify({
            id: 'session-1',
            token: 'token-1',
        }));

        expect(readTrackedStudySessionState()).toEqual({
            status: 'ready',
            context: {
                sessionId: 'session-1',
                sessionToken: 'token-1',
            },
        });
    });
});
