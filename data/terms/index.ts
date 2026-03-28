import { Term } from '../../types';
import { assignUniqueSlugs } from './catalog-utils';
import { testCatalogTerms } from './test-catalog';

export const terms: Term[] = assignUniqueSlugs([
    ...testCatalogTerms,
]);
