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
const mockIncrementAiGuestTeaserUsage = jest.fn();

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
    getAiChatHistory: () => ([
        { role: 'user', content: 'finans' },
        { role: 'assistant', content: 'Finans aciklamasi' },
    ]),
    saveAiChatHistory: jest.fn(),
    clearAiChatHistory: () => mockClearAiChatHistory(),
    getAiGuestTeaserUsage: () => ({
        quizFeedbackCount: 0,
        termExplainCount: 0,
        chatMessageCount: 0,
    }),
    incrementAiGuestTeaserUsage: (...args: unknown[]) => mockIncrementAiGuestTeaserUsage(...args),
}));

jest.mock('@/components/membership/ValueHintList', () => () => null);

describe('AiChatPanel', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAuth.mockReturnValue({
            entitlements: {
                canUseAdvancedAnalytics: true,
            },
            isAuthenticated: true,
        });
        mockIncrementAiGuestTeaserUsage.mockReturnValue({
            quizFeedbackCount: 0,
            termExplainCount: 0,
            chatMessageCount: 1,
        });
    });

    it('clears chat history when reset is clicked', () => {
        render(<AiChatPanel />);

        expect(screen.getByText('finans')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Sohbeti sıfırla' }));

        expect(screen.queryByText('finans')).not.toBeInTheDocument();
        expect(mockClearAiChatHistory).toHaveBeenCalled();
    });

    it('increments guest usage only after a successful guest response', async () => {
        mockUseAuth.mockReturnValue({
            entitlements: {
                canUseAdvancedAnalytics: false,
            },
            isAuthenticated: false,
        });
        mockFetchAiChatResponse.mockResolvedValue({
            answer: 'Yanıt',
        });

        render(<AiChatPanel />);

        fireEvent.change(screen.getByPlaceholderText('Finans, fintek veya teknoloji hakkında sor...'), {
            target: { value: 'borsa nedir' },
        });
        fireEvent.click(screen.getByText('Gönder'));

        expect(await screen.findByText('Yanıt')).toBeInTheDocument();
        expect(mockIncrementAiGuestTeaserUsage).toHaveBeenCalledWith('chat-message');
    });

    it('does not increment guest usage when the guest request fails', async () => {
        mockUseAuth.mockReturnValue({
            entitlements: {
                canUseAdvancedAnalytics: false,
            },
            isAuthenticated: false,
        });
        mockFetchAiChatResponse.mockRejectedValue(new Error('AI unavailable'));

        render(<AiChatPanel />);

        fireEvent.change(screen.getByPlaceholderText('Finans, fintek veya teknoloji hakkında sor...'), {
            target: { value: 'borsa nedir' },
        });
        fireEvent.click(screen.getByText('Gönder'));

        expect(await screen.findByText('AI unavailable')).toBeInTheDocument();
        await waitFor(() => {
            expect(mockIncrementAiGuestTeaserUsage).not.toHaveBeenCalled();
        });
    });
});
