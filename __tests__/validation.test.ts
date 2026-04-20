import { terms } from '../data/terms';

const collectDuplicates = (values: readonly string[]): string[] => values.filter(
    (value, index) => values.indexOf(value) !== index
);

describe('Term Database Validation', () => {
    it('should have unique term IDs', () => {
        const ids = terms.map(t => t.id);
        expect(collectDuplicates(ids)).toEqual([]);
    });

    it('should have unique English terms', () => {
        const englishTerms = terms.map(t => t.term_en.toLowerCase().trim());
        expect(collectDuplicates(englishTerms)).toEqual([]);
    });

    it('should keep broad category coverage across the active runtime catalog', () => {
        const categories = terms.reduce((acc, term) => {
            acc[term.category] = (acc[term.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        expect(categories.Finance).toBeGreaterThan(0);
        expect(categories.Fintech).toBeGreaterThan(0);
        expect(categories.Technology).toBeGreaterThan(0);
        expect(Object.values(categories).reduce((total, count) => total + count, 0)).toBe(terms.length);
    });

    it('should include contest taxonomy fields on every term', () => {
        const validMarkets = new Set(['MOEX', 'BIST', 'GLOBAL']);

        terms.forEach((term) => {
            expect(validMarkets.has(term.regional_market)).toBe(true);
            expect(term.context_tags).toBeDefined();
            expect(Array.isArray(term.context_tags.disciplines)).toBe(true);
            expect(Array.isArray(term.context_tags.target_universities)).toBe(true);
        });
    });
});
