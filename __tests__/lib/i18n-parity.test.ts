import enTranslations from '@/locales/en.json';
import ruTranslations from '@/locales/ru.json';
import trTranslations from '@/locales/tr.json';
import { getAllTranslationKeys } from '@/lib/i18n';

describe('locale key parity', () => {
    it('keeps required keys aligned across en, tr, and ru locales', () => {
        const englishKeys = getAllTranslationKeys(enTranslations as Record<string, unknown>).sort();
        const russianKeys = getAllTranslationKeys(ruTranslations as Record<string, unknown>).sort();
        const turkishKeys = getAllTranslationKeys(trTranslations as Record<string, unknown>).sort();

        expect(russianKeys).toEqual(englishKeys);
        expect(turkishKeys).toEqual(englishKeys);
    });
});
