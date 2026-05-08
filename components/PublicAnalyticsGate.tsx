'use client';

import { useCallback, useEffect, useSyncExternalStore, type ReactElement } from 'react';
import {
    RESEARCH_CONSENT_KEY,
    CONSENT_UPDATED_EVENT,
    readResearchConsent,
    writeResearchConsent,
} from '@/lib/research-consent';
import type { Language } from '@/types';

interface PublicAnalyticsGateProps {
    readonly language: Language;
    readonly gaId: string | null;
}

interface PublicAnalyticsCopy {
    readonly title: string;
    readonly body: string;
    readonly accept: string;
    readonly decline: string;
}

interface ConsentActionsProps {
    readonly copy: PublicAnalyticsCopy;
    readonly onAccept: () => void;
    readonly onDecline: () => void;
}

const SCRIPT_ID = 'google-analytics-loader';

const analyticsCopy: Record<Language, PublicAnalyticsCopy> = {
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

type GtagCommand =
    | ['js', Date]
    | ['config', string]
    | ['event', string, Record<string, unknown>?];

type ConsentSnapshot = boolean | null | 'pending';

declare global {
    interface Window {
        dataLayer?: Array<IArguments | Record<string, unknown>>;
        gtag?: (...args: GtagCommand) => void;
    }
}

const appendGoogleAnalyticsScript = (gaId: string): void => {
    if (document.getElementById(SCRIPT_ID)) {
        return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(script);
};

const initializeGoogleAnalytics = (gaId: string): void => {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = window.gtag ?? function gtag(..._args: GtagCommand): void {
        window.dataLayer?.push(arguments);
    };

    appendGoogleAnalyticsScript(gaId);
    window.gtag('js', new Date());
    window.gtag('config', gaId);
};

const subscribeToConsentDecision = (onStoreChange: () => void): (() => void) => {
    const handleStorage = (event: StorageEvent): void => {
        if (event.key === RESEARCH_CONSENT_KEY) {
            onStoreChange();
        }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(CONSENT_UPDATED_EVENT, onStoreChange);
    return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(CONSENT_UPDATED_EVENT, onStoreChange);
    };
};

const getConsentSnapshot = (): ConsentSnapshot => readResearchConsent();
const getServerConsentSnapshot = (): ConsentSnapshot => 'pending';

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

export default function PublicAnalyticsGate({
    language,
    gaId,
}: PublicAnalyticsGateProps): ReactElement | null {
    const copy = analyticsCopy[language];
    const consentDecision = useSyncExternalStore(
        subscribeToConsentDecision,
        getConsentSnapshot,
        getServerConsentSnapshot
    );

    const closeWithDecision = useCallback((given: boolean): void => {
        writeResearchConsent(given);
    }, []);

    useEffect(() => {
        if (gaId && consentDecision === true) {
            initializeGoogleAnalytics(gaId);
        }
    }, [consentDecision, gaId]);

    if (!gaId || consentDecision !== null) {
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
