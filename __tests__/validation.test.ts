
import { terms } from '../data/terms';
import * as fs from 'fs';
import * as path from 'path';

describe('Term Database Validation', () => {
    it('should have unique term IDs', () => {
        const ids = terms.map(t => t.id);
        const uniqueIds = new Set(ids);
        const duplicates = ids.filter((item, index) => ids.indexOf(item) !== index);

        if (duplicates.length > 0) {
            console.error('Duplicate IDs found:', duplicates);
        }

        expect(uniqueIds.size).toBe(terms.length);
    });

    it('should have unique English terms', () => {
        const englishTerms = terms.map(t => t.term_en.toLowerCase().trim());
        const uniqueTerms = new Set(englishTerms);
        const duplicates = englishTerms.filter((item, index) => englishTerms.indexOf(item) !== index);

        if (duplicates.length > 0) {
            // Create a map of duplicates to their IDs
            const seen = new Set();
            const duplicateDetails: string[] = [];

            terms.forEach(t => {
                const termLower = t.term_en.toLowerCase().trim();
                if (duplicates.includes(termLower)) {
                    duplicateDetails.push(`${t.id}: ${t.term_en} (${t.category})`);
                }
            });

            console.error('Duplicate English terms found (' + duplicates.length + ' duplicates, ' + (terms.length - uniqueTerms.size) + ' redundant items):');
            console.error(duplicateDetails.join('\n'));

            // Write to log file for analysis
            fs.writeFileSync(path.join(__dirname, 'duplicates.log'), duplicateDetails.join('\n'));
        }

        expect(uniqueTerms.size).toBe(terms.length);
    });

    it('should have correct category distribution', () => {
        const categories = terms.reduce((acc, term) => {
            acc[term.category] = (acc[term.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log('Category Distribution:', categories);
        console.log('Total Terms:', terms.length);

        expect(terms.length).toBeGreaterThan(1000);
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
