import { setCurrentLanguage } from '@/utils/storage';
import type { Language } from '@/types';

export const persistLocalePreference = (locale: Language): void => {
    setCurrentLanguage(locale);
};
