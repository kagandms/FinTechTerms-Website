import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SearchClient from '@/app/search/SearchClient';

const mockUseLanguage = jest.fn();
const mockUseSRS = jest.fn();
const mockUseSearchParams = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => mockUseLanguage(),
}));

jest.mock('@/contexts/SRSContext', () => ({
    useSRS: () => mockUseSRS(),
}));

jest.mock('@/components/SmartCard', () => ({
    __esModule: true,
    default: () => <div data-testid="smart-card">SmartCard</div>,
}));

jest.mock('next/navigation', () => ({
    usePathname: () => '/search',
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
    }),
    useSearchParams: () => mockUseSearchParams(),
}));

describe('Search market empty state', () => {
    beforeEach(() => {
        mockPush.mockReset();
        mockReplace.mockReset();
        mockUseSearchParams.mockReturnValue(new URLSearchParams('market=MOEX'));

        const translationMap: Record<string, string> = {
            'search.filteredMarketTitle': 'Термины не найдены для выбранного рынка',
            'search.filteredMarketDescription': 'Выбранный рыночный фильтр не вернул терминов. Попробуйте другой рынок или сбросьте фильтр.',
            'search.markets.MOEX': 'Рынок: MOEX',
            'search.containerLabel': 'Поиск терминов',
            'search.placeholder': 'Поиск на турецком, английском или русском...',
            'search.clearSearch': 'Очистить поиск',
            'search.showFilters': 'Показать фильтры категорий',
            'search.hideFilters': 'Скрыть фильтры категорий',
            'search.allTerms': 'Все термины',
            'search.allMarkets': 'Все рынки',
            'search.marketLabel': 'Рыночная таксономия',
            'search.sortLabel': 'Порядок сортировки',
            'search.sort.alphaAsc': 'По алфавиту (А-Я)',
            'search.sort.alphaDesc': 'По алфавиту (Я-А)',
            'search.noResultsTitle': 'Ничего не найдено',
            'search.noResultsDescription': 'Измените запрос или снимите активные фильтры, чтобы расширить выборку.',
            'search.title': 'Поиск',
            'search.description': 'Описание',
            'search.results': 'результатов найдено',
            'search.loadingTitle': 'Загружаем словарь',
            'search.loadingDescription': 'Подготавливаем термины для поиска. Пожалуйста, подождите.',
            'search.errorTitle': 'Ошибка загрузки данных',
            'search.errorDescription': 'Сейчас не удалось загрузить данные для поиска. Попробуйте еще раз.',
            'search.degradedTitle': 'Показаны сохраненные термины',
            'search.degradedDescription': 'Сервер недоступен. Поиск работает по последним сохраненным терминам.',
            'search.emptyTitle': 'Термины недоступны',
            'search.emptyDescription': 'Сейчас нет терминов для отображения.',
            'search.retry': 'Повторить',
        };

        mockUseLanguage.mockReturnValue({
            language: 'ru',
            t: (key: string) => translationMap[key] ?? key,
        });

        mockUseSRS.mockReturnValue({
            terms: [],
            isLoading: false,
            termsStatus: 'ready',
            refreshData: jest.fn(),
        });
    });

    it('shows the Russian market-specific empty state when a market filter returns no results', () => {
        render(<SearchClient />);

        expect(screen.getByText('Термины не найдены для выбранного рынка')).toBeInTheDocument();
        expect(screen.getByText('Выбранный рыночный фильтр не вернул терминов. Попробуйте другой рынок или сбросьте фильтр.')).toBeInTheDocument();
        expect(screen.getAllByText('Рынок: MOEX')).toHaveLength(2);
    });
});
