
import { financeTerms } from './finance';
import { fintechTerms } from './fintech';
import { technologyTerms } from './technology';
import { Term } from '../../types';

export const terms: Term[] = [
    ...financeTerms,
    ...fintechTerms,
    ...technologyTerms,
];
