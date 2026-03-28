import type { Term } from '../../types';
import { assignUniqueSlugs } from './catalog-utils';
import { financeTerms } from './finance';
import { fintechTerms } from './fintech';
import { seoGapTerms } from './seo-gap';
import { technologyTerms } from './technology';

export const fullRepoTerms: Term[] = assignUniqueSlugs([
    ...financeTerms,
    ...fintechTerms,
    ...technologyTerms,
    ...seoGapTerms,
]);
