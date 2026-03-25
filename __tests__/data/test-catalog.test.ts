import { mockTerms } from '@/data/mockData';

describe('test catalog', () => {
    it('keeps exactly the 5 locked test terms in the repo catalog', () => {
        expect(mockTerms.map((term) => term.id)).toEqual([
            'term_001',
            'term_003',
            'term_048',
            'term_060',
            'term_065',
        ]);
    });
});
