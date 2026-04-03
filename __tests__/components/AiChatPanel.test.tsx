/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AiChatPanel from '@/components/home/AiChatPanel';

const mockFetchAiChatResponse = jest.fn();
const mockClearAiChatHistory = jest.fn();
const mockUseAuth = jest.fn();
const mockSaveAiChatHistory = jest.fn();

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({
        language: 'tr',
        t: (key: string) => ({
            'membership.chatHint': 'Guest önizleme 3 AI mesajı içerir.',
            'membership.hintTitle': 'Üyelikle açılanlar',
            'membership.items.aiExplain': 'AI terim koçu',
            'membership.items.aiFeedback': 'AI hata açıklamaları',
            'membership.items.studyCoach': 'AI Çalışma Koçu',
        }[key] ?? key),
    }),
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

jest.mock('@/lib/ai/client', () => ({
    fetchAiChatResponse: (...args: unknown[]) => mockFetchAiChatResponse(...args),
}));

jest.mock('@/utils/ai-session', () => ({
    createDefaultAiGuestTeaserUsage: () => ({
        quizFeedbackCount: 0,
        termExplainCount: 0,
        chatMessageCount: 0,
    }),
    getAiChatHistory: () => ([
        { role: 'user', content: 'finans' },
        { role: 'assistant', content: 'Finans aciklamasi' },
    ]),
    saveAiChatHistory: (...args: unknown[]) => mockSaveAiChatHistory(...args),
    clearAiChatHistory: () => mockClearAiChatHistory(),
}));

jest.mock('@/components/membership/ValueHintList', () => () => null);

describe('AiChatPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({
            entitlements: {
                canUseAiFeatures: true,
                canUseAdvancedAnalytics: true,
            },
            isAuthenticated: true,
        });
    });

    it('clears chat history when reset is clicked', () => {
        render(<AiChatPanel />);

        expect(screen.getByText('finans')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Sohbeti sıfırla' }));

        expect(screen.queryByText('finans')).not.toBeInTheDocument();
        expect(mockClearAiChatHistory).toHaveBeenCalled();
    });

    it('hydrates stored chat history without overwriting it with an empty state', async () => {
        render(<AiChatPanel />);

        expect(await screen.findByText('finans')).toBeInTheDocument();
        expect(mockSaveAiChatHistory).not.toHaveBeenCalledWith([]);
    });

    it('does not submit chat requests for guests', async () => {
        mockUseAuth.mockReturnValue({
            entitlements: {
                canUseAiFeatures: false,
                canUseAdvancedAnalytics: false,
            },
            isAuthenticated: false,
        });
        render(<AiChatPanel />);

        fireEvent.change(screen.getByPlaceholderText('Finans, fintek veya teknoloji hakkında sor...'), {
            target: { value: 'borsa nedir' },
        });
        fireEvent.click(screen.getByText('Gönder'));

        expect(await screen.findByText('AI sohbet yalnızca tam üyelere açıktır.')).toBeInTheDocument();
        await waitFor(() => {
            expect(mockFetchAiChatResponse).not.toHaveBeenCalled();
        });
    });
});
