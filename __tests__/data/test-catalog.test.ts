import { terms as activeCatalogTerms } from '@/data/terms';
import { fullRepoTerms } from '@/data/terms/repo-catalog';
import { testCatalogTerms } from '@/data/terms/test-catalog';

describe('test catalog', () => {
    it('keeps exactly the 5 locked test terms in the dedicated test catalog', () => {
        expect(testCatalogTerms.map((term) => term.id)).toEqual([
            'term_001',
            'term_003',
            'term_048',
            'term_060',
            'term_065',
        ]);
    });

    it('keeps the dedicated test catalog isolated from the active runtime catalog', () => {
        expect(activeCatalogTerms.map((term) => term.id)).toEqual(
            fullRepoTerms.map((term) => term.id)
        );
        expect(activeCatalogTerms.length).toBeGreaterThan(testCatalogTerms.length);
    });
});
