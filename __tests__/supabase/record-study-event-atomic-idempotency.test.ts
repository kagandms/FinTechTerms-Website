/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.join(
    process.cwd(),
    'supabase/migrations/20260424121000_record_study_event_atomic_idempotency.sql'
);

describe('record study event atomic idempotency migration', () => {
    const source = fs.readFileSync(migrationPath, 'utf8');

    it('serializes study-event writes per user before reading SRS state', () => {
        expect(source).toContain('insert into public.user_progress (user_id)');
        expect(source).toContain('from public.user_progress');
        expect(source).toContain('where user_id = p_user_id');
        expect(source).toContain('for update;');
        expect(source.indexOf('from public.user_progress')).toBeLessThan(
            source.indexOf('from public.user_term_srs')
        );
    });

    it('rejects idempotency replay when the request fingerprint differs', () => {
        expect(source).toContain('v_existing_attempt.term_id is distinct from p_term_id');
        expect(source).toContain('v_existing_attempt.is_correct is distinct from p_is_correct');
        expect(source).toContain('coalesce(v_existing_attempt.response_time_ms, 0) is distinct from v_response_time_ms');
        expect(source).toContain('v_existing_attempt.quiz_type is distinct from p_quiz_type');
        expect(source).toContain('v_existing_attempt.session_id is distinct from v_effective_session_id');
        expect(source).toContain('p_occurred_at is not null');
        expect(source).toContain('v_existing_attempt.created_at is distinct from v_occurred_at');
        expect(source).toContain("raise exception 'Idempotency key already used for a different study event.'");
    });
});
