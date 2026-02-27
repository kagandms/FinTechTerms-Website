/**
 * DynamicHtmlLang — Client-side html lang attribute updater (M32)
 * Skill: i18n-localization, react-best-practices
 *
 * Since Next.js App Router renders <html lang="en"> at build time,
 * this effect updates it dynamically based on the user's selected language.
 */

'use client';

import { useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DynamicHtmlLang() {
    const { language } = useLanguage();

    useEffect(() => {
        if (typeof document !== 'undefined') {
            const htmlEl = document.documentElement;
            const currentLang = htmlEl.getAttribute('lang');
            if (currentLang !== language) {
                htmlEl.setAttribute('lang', language);
                // Also set dir for RTL (M33 - future-proofing)
                htmlEl.setAttribute('dir', 'ltr');
            }
        }
    }, [language]);

    return null; // Render nothing — side-effect only
}
