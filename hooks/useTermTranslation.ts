import { useLanguage } from '@/contexts/LanguageContext';
import { Term, Language } from '@/types';

export function useTermTranslation(term: Term) {
    const { language, t } = useLanguage();

    const getTermByLang = (lang: Language = language): string => {
        const terms: Record<Language, string> = {
            tr: term.term_tr,
            en: term.term_en,
            ru: term.term_ru,
        };
        return terms[lang];
    };

    const getDefinitionByLang = (lang: Language = language): string => {
        const defs: Record<Language, string> = {
            tr: term.definition_tr,
            en: term.definition_en,
            ru: term.definition_ru,
        };
        return defs[lang];
    };

    const getPhoneticByLang = (lang: Language = language): string | undefined => {
        const phonetics: Record<Language, string | undefined> = {
            tr: term.phonetic_tr,
            en: term.phonetic_en,
            ru: term.phonetic_ru,
        };
        return phonetics[lang];
    };

    const getExampleByLang = (lang: Language = language): string => {
        const examples: Record<Language, string> = {
            tr: term.example_sentence_tr,
            en: term.example_sentence_en,
            ru: term.example_sentence_ru,
        };
        return examples[lang];
    };

    return {
        language,
        t,
        getTermByLang,
        getDefinitionByLang,
        getPhoneticByLang,
        getExampleByLang,
        currentTerm: getTermByLang(language),
        currentDefinition: getDefinitionByLang(language),
        currentPhonetic: getPhoneticByLang(language),
        currentExample: getExampleByLang(language),
    };
}
