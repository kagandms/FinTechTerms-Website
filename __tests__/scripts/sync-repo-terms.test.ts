/**
 * @jest-environment node
 */

const {
    MIN_RELEASE_TERM_COUNT,
    assertReleaseCorpusSize,
    assertSafePruneTarget,
    buildImpactReport,
    parseSyncOptions,
    readRequiredServiceRoleKey,
} = require('../../scripts/sync_repo_terms.js');

describe('sync repo terms release safeguards', () => {
    it('allows the curated 956-term release corpus', () => {
        // Arrange
        const terms = Array.from({ length: 956 }, (_, index) => ({ id: `term_${index}` }));

        // Act / Assert
        expect(() => assertReleaseCorpusSize(terms)).not.toThrow();
        expect(MIN_RELEASE_TERM_COUNT).toBe(900);
    });

    it('rejects a tiny incomplete corpus', () => {
        // Arrange
        const terms = Array.from({ length: 12 }, (_, index) => ({ id: `term_${index}` }));

        // Act / Assert
        expect(() => assertReleaseCorpusSize(terms)).toThrow('Expected at least 900 release terms');
    });

    it('parses dry-run and prune-extra flags without enabling writes by default', () => {
        // Arrange
        const argv = ['--dry-run', '--prune-extra'];

        // Act
        const options = parseSyncOptions(argv);

        // Assert
        expect(options).toEqual({
            isDryRun: true,
            shouldPruneExtra: true,
        });
    });

    it('blocks remote prune without explicit destructive acknowledgement', () => {
        // Arrange
        const options = { isDryRun: false, shouldPruneExtra: true };

        // Act / Assert
        expect(() => assertSafePruneTarget(
            'https://project.supabase.co',
            options,
            {}
        )).toThrow('refused to prune remote Supabase target');
    });

    it('allows remote prune during dry-run without destructive acknowledgement', () => {
        // Arrange
        const options = { isDryRun: true, shouldPruneExtra: true };

        // Act / Assert
        expect(() => assertSafePruneTarget(
            'https://project.supabase.co',
            options,
            {}
        )).not.toThrow();
    });

    it('requires a service-role key for sync and prune paths', () => {
        // Act / Assert
        expect(() => readRequiredServiceRoleKey({})).toThrow('SUPABASE_SERVICE_ROLE_KEY');
        expect(readRequiredServiceRoleKey({
            SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
        })).toBe('service-role-key');
    });

    it('builds a structured impact report before pruning extras', () => {
        // Arrange
        const comparison = {
            repoCount: 956,
            mirrorCount: 1267,
            missingIds: ['term_9012'],
            extraIds: ['term_056', 'term_074'],
            slugMismatches: [],
        };
        const referenceCounts = {
            user_favorites: 2,
            quiz_attempts: 4,
            user_term_srs: 1,
            academic_deck_terms: 0,
        };

        // Act
        const report = buildImpactReport(comparison, referenceCounts);

        // Assert
        expect(report).toEqual({
            repoCount: 956,
            mirrorCount: 1267,
            missingIds: ['term_9012'],
            missingIdsCount: 1,
            extraIds: ['term_056', 'term_074'],
            extraIdsCount: 2,
            slugMismatches: [],
            slugMismatchesCount: 0,
            affectedReferenceRows: referenceCounts,
        });
    });
});
