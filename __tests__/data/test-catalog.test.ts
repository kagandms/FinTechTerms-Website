import { terms as fullCatalogTerms } from '@/data/terms';
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

    it('keeps the main repo catalog broader than the locked test subset', () => {
        expect(fullCatalogTerms.length).toBeGreaterThan(testCatalogTerms.length);
    });
});
