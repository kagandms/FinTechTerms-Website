/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AiChatPanel from '@/components/home/AiChatPanel';

const mockFetchAiChatResponse = jest.fn();
const mockClearAiChatHistory = jest.fn();

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
    useAuth: () => ({
        entitlements: {
            canUseAdvancedAnalytics: true,
        },
        isAuthenticated: true,
    }),
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
    incrementAiGuestTeaserUsage: jest.fn(() => ({
        quizFeedbackCount: 0,
        termExplainCount: 0,
        chatMessageCount: 1,
    })),
}));

jest.mock('@/components/membership/ValueHintList', () => () => null);

describe('AiChatPanel', () => {
    it('clears chat history when reset is clicked', () => {
        render(<AiChatPanel />);

        expect(screen.getByText('finans')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Sohbeti sıfırla' }));

        expect(screen.queryByText('finans')).not.toBeInTheDocument();
        expect(mockClearAiChatHistory).toHaveBeenCalled();
    });
});
