import type { Term } from '../../types';
import { createTerm } from './utils';

export const testCatalogTerms: Term[] = [
    createTerm(
        'term_001',
        'Gross Domestic Product (GDP)',
        'Валовой внутренний продукт (ВВП)',
        'Gayri Safi Yurt İçi Hasıla (GSYİH)',
        'Finance',
        'Total value of goods and services produced in a country.',
        'Общая стоимость товаров и услуг, произведённых в стране.',
        'Bir ülkede üretilen mal ve hizmetlerin toplam değeri.',
        'GDP growth indicates a healthy economy.',
        'Рост ВВП указывает на здоровую экономику.',
        'GSYİH büyümesi sağlıklı bir ekonomiye işaret eder.',
        '/ˌdʒiː diː ˈpiː/',
        '/vɛ vɛ pɛ/',
        '/ge-se-yih/'
    ),
    createTerm(
        'term_003',
        'Inflation',
        'Инфляция',
        'Enflasyon',
        'Finance',
        'A sustained increase in the general price level.',
        'Устойчивое повышение общего уровня цен.',
        'Genel fiyat düzeyinde sürekli artış.',
        'Central banks raise rates to fight inflation.',
        'Центробанки повышают ставки для борьбы с инфляцией.',
        'Merkez bankaları enflasyonla mücadele için oranları artırır.',
        '/ɪnˈfleɪʃən/',
        '/ɪnˈfljatsɪja/',
        '/en-flas-yon/'
    ),
    createTerm(
        'term_048',
        'Bitcoin',
        'Биткоин',
        'Bitcoin',
        'Fintech',
        'First decentralized digital currency.',
        'Первая децентрализованная цифровая валюта.',
        'İlk merkeziyetsiz dijital para birimi.',
        'Bitcoin is often called digital gold.',
        'Биткоин часто называют цифровым золотом.',
        'Bitcoin sıklıkla dijital altın olarak adlandırılır.'
    ),
    createTerm(
        'term_060',
        'Open Banking',
        'Открытый банкинг',
        'Açık Bankacılık',
        'Fintech',
        'System providing third-party access to financial data through APIs.',
        'Система доступа третьих лиц к финданным через API.',
        'API’ler aracılığıyla finansal verilere üçüncü taraf erişimi sağlayan sistem.',
        'Open banking fosters competition in finance.',
        'Открытый банкинг способствует конкуренции в финансах.',
        'Açık bankacılık finansta rekabeti teşvik eder.'
    ),
    createTerm(
        'term_065',
        'SQL',
        'SQL',
        'SQL',
        'Technology',
        'Structured Query Language.',
        'Структурированный язык запросов.',
        'Yapılandırılmış Sorgu Dili.',
        'Developers use SQL to manage data.',
        'Разработчики используют SQL для управления данными.',
        'Geliştiriciler veriyi yönetmek için SQL kullanır.'
    ),
];
