'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw, SendHorizonal, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getAiUiCopy } from '@/lib/ai-copy';
import { fetchAiChatResponse } from '@/lib/ai/client';
import { clearAiChatHistory, getAiChatHistory, getAiGuestTeaserUsage, incrementAiGuestTeaserUsage, saveAiChatHistory } from '@/utils/ai-session';
import type { AiChatMessage } from '@/types/ai';
import ValueHintList from '@/components/membership/ValueHintList';

export default function AiChatPanel() {
    const { language, t } = useLanguage();
    const { entitlements, isAuthenticated } = useAuth();
    const aiCopy = getAiUiCopy(language);
    const [messages, setMessages] = useState<AiChatMessage[]>(() => getAiChatHistory());
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [guestAiUsage, setGuestAiUsage] = useState(() => getAiGuestTeaserUsage());
    const hasFullAiAccess = isAuthenticated && entitlements.canUseAdvancedAnalytics;

    useEffect(() => {
        saveAiChatHistory(messages);
    }, [messages]);

    const remainingGuestMessages = Math.max(0, 3 - guestAiUsage.chatMessageCount);
    const helperLabel = useMemo(() => {
        if (hasFullAiAccess) {
            return aiCopy.chatDescription;
        }

        return `${aiCopy.chatDescription} ${remainingGuestMessages}/3`;
    }, [aiCopy.chatDescription, hasFullAiAccess, remainingGuestMessages]);

    const handleResetChat = () => {
        setMessages([]);
        setError(null);
        clearAiChatHistory();
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const nextMessage = input.trim();

        if (!nextMessage || isLoading) {
            return;
        }

        if (!hasFullAiAccess && guestAiUsage.chatMessageCount >= 3) {
            setError(aiCopy.chatGuestLimit);
            return;
        }

        const previousMessages = messages.slice(-6);
        const nextHistory: AiChatMessage[] = [
            ...messages,
            {
                role: 'user',
                content: nextMessage,
            },
        ];

        setMessages(nextHistory);
        setInput('');
        setError(null);
        setIsLoading(true);

        try {
            const response = await fetchAiChatResponse({
                language,
                message: nextMessage,
                history: previousMessages,
            });

            if (!hasFullAiAccess) {
                setGuestAiUsage(incrementAiGuestTeaserUsage('chat-message'));
            }

            setMessages((currentMessages) => [
                ...currentMessages,
                {
                    role: 'assistant',
                    content: response.answer,
                },
            ]);
        } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : aiCopy.genericError);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-card">
            <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-primary-500/10 p-3 text-primary-600 dark:text-primary-300">
                    <Sparkles className="h-6 w-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{aiCopy.chatTitle}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{helperLabel}</p>
                </div>
                <button
                    type="button"
                    onClick={handleResetChat}
                    className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                    <RotateCcw className="h-4 w-4" />
                    <span>{aiCopy.chatReset}</span>
                </button>
            </div>

            {!hasFullAiAccess ? (
                <div className="mt-4 space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300">{t('membership.chatHint')}</p>
                    <ValueHintList
                        title={t('membership.hintTitle')}
                        items={[
                            t('membership.items.aiExplain'),
                            t('membership.items.aiFeedback'),
                            t('membership.items.studyCoach'),
                        ]}
                    />
                </div>
            ) : null}

            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-2xl bg-gray-50 p-4 dark:bg-slate-800/70">
                {messages.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{aiCopy.chatEmpty}</p>
                ) : (
                    messages.map((message, index) => (
                        <div
                            key={`${message.role}:${index}:${message.content.slice(0, 20)}`}
                            className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user'
                                ? 'ml-auto bg-primary-500 text-white'
                                : 'bg-white text-gray-700 shadow-sm dark:bg-slate-900 dark:text-gray-100'
                                }`}
                        >
                            {message.content}
                        </div>
                    ))
                )}

                {isLoading ? (
                    <div className="max-w-[90%] rounded-2xl bg-white px-4 py-3 text-sm text-gray-500 shadow-sm dark:bg-slate-900 dark:text-gray-300">
                        {aiCopy.chatLoading}
                    </div>
                ) : null}
            </div>

            {error ? (
                <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
                <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={aiCopy.chatPlaceholder}
                    className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-primary-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-300"
                >
                    <SendHorizonal className="h-4 w-4" />
                    <span>{aiCopy.chatSend}</span>
                </button>
            </form>
        </section>
    );
}
