'use client';

import { useEffect, useState, type ReactElement } from 'react';
import { getPublicEnv } from '@/lib/public-env';
import { readResearchConsent, writeResearchConsent } from '@/lib/research-consent';
import type { Language } from '@/types';

interface PublicAnalyticsConsentProps {
    readonly language: Language;
}

interface PublicAnalyticsConsentCopy {
    readonly title: string;
    readonly body: string;
    readonly accept: string;
    readonly decline: string;
}

const consentCopy: Record<Language, PublicAnalyticsConsentCopy> = {
    en: {
        title: 'Analytics consent',
        body: 'FinTechTerms uses privacy-conscious analytics to understand public glossary usage. No personal account data is sent to Google Analytics.',
        accept: 'Allow',
        decline: 'Decline',
    },
    ru: {
        title: 'Согласие на аналитику',
        body: 'FinTechTerms использует конфиденциальную аналитику, чтобы понимать использование публичного глоссария. Данные личного аккаунта не отправляются в Google Analytics.',
        accept: 'Разрешить',
        decline: 'Отклонить',
    },
    tr: {
        title: 'Analytics izni',
        body: 'FinTechTerms, public sözlük kullanımını anlamak için gizliliğe duyarlı analytics kullanır. Kişisel hesap verileri Google Analytics’e gönderilmez.',
        accept: 'İzin ver',
        decline: 'Reddet',
    },
};

const shouldShowConsent = (): boolean => {
    if (!getPublicEnv().gaId) {
        return false;
    }

    return readResearchConsent() === null;
};

interface ConsentActionsProps {
    readonly copy: PublicAnalyticsConsentCopy;
    readonly onAccept: () => void;
    readonly onDecline: () => void;
}

function ConsentActions({
    copy,
    onAccept,
    onDecline,
}: ConsentActionsProps): ReactElement {
    return (
        <div className="flex shrink-0 gap-2 sm:justify-end">
            <button
                type="button"
                onClick={onDecline}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-500 hover:text-slate-950"
            >
                {copy.decline}
            </button>
            <button
                type="button"
                onClick={onAccept}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
                {copy.accept}
            </button>
        </div>
    );
}

/**
 * Renders a lightweight consent banner for public SEO pages without app-shell providers.
 *
 * @param language - Public locale used for banner copy.
 * @returns The consent banner or `null` after a stored decision.
 */
export default function PublicAnalyticsConsent({
    language,
}: PublicAnalyticsConsentProps): ReactElement | null {
    const [isVisible, setIsVisible] = useState(false);
    const copy = consentCopy[language];
    const closeWithDecision = (given: boolean): void => {
        writeResearchConsent(given);
        setIsVisible(false);
    };

    useEffect(() => {
        const frameId = window.requestAnimationFrame(() => {
            setIsVisible(shouldShowConsent());
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, []);

    if (!isVisible) {
        return null;
    }

    return (
        <aside className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-4 text-slate-950 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-3xl">
                    <p className="text-sm font-bold">{copy.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{copy.body}</p>
                </div>
                <ConsentActions
                    copy={copy}
                    onAccept={() => closeWithDecision(true)}
                    onDecline={() => closeWithDecision(false)}
                />
            </div>
        </aside>
    );
}
