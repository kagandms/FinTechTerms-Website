'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Link from 'next/link';
import {
    BookOpen,
    Globe,
    Brain,
    Target,
    Sparkles,
    Users,
    GraduationCap,
    ArrowRight,
    Github,
    Linkedin,
    Mail,
    Send,
} from 'lucide-react';
import TelegramBanner from '@/components/TelegramBanner';


export default function AboutPage() {
    const { language } = useLanguage();

    const content = {
        tr: {
            title: 'Hakkında',
            subtitle: 'FinTechTerms: İki Ülke Arasında Bir Dijital Ekonomi Köprüsü',
            metaDesc: 'FinTechTerms, Rusça sözünün diplomatları konseptiyle kodların ve finansın evrensel dilini birleştiriyor.',
            sections: {
                vision: {
                    title: 'Vizyonumuz',
                    text: 'Küresel piyasalarda, özellikle Türkiye ve Rusya arasındaki giderek derinleşen ekonomik ilişkiler, ticaret hacmi ve artan sınır ötesi finansal işlemler, hem profesyoneller hem de iki ülke halkları için yeni bir gereksinim doğurdu: Ortak ve doğru bir terminoloji. FinTechTerms; finans, ödeme sistemleri (FinTech) ve yazılım dünyasının karmaşık dilini Rusça, İngilizce ve Türkçe olarak tek bir merkezde birleştiren interaktif bir öğrenme ekosistemidir.'
                },
                story: {
                    title: 'Hikayemiz ve Çıkış Noktası',
                    text: 'Bu proje, Yönetim Bilişim Sistemleri (YBS) ve Ekonomi disiplinlerinin kesiştiği noktada, sahada yaşanan gerçek bir iletişimsizliği çözmek üzere hayata geçirildi. St. Petersburg ve Moskova gibi ülkenin kalbi olan şehirlerdeki köklü kurumlarda akademik kariyerini derinleştirmeyi hedefleyen ve iki ülke halkları arasındaki ticari bağları güçlendirmek isteyen vizyoner bir altyapının eseridir. Bizim için Rusça sadece edebi bir araç değil; iki halkın dijital ekonomilerini, girişimcilerini ve günlük finansal etkileşimlerini birbirine bağlayan stratejik bir anahtardır.'
                },
                tech: {
                    title: 'Teknoloji ve Kesintisiz Deneyim',
                    text: 'Geleneksel sözlüklerin aksine FinTechTerms; kullanıcılarını Telegram botu, PWA web mimarisi ve merkezi veritabanı senkronizasyonu ile bulundukları her platformda destekler. Sadece çeviri sunmakla kalmaz; sesli telaffuzlar, akıllı testler ve kişisel istatistik takibi ile kalıcı bir mesleki gelişim sağlar.'
                },
                mission: {
                    title: 'Misyonumuz',
                    text: '"Rus Sözünün Diplomatları" projesiyle tam uyumlu olarak amacımız; Rus dilinin modern finans, teknoloji ve sınır ötesi ticaretteki birleştirici gücünü kurumsal standartlarda bir dijital ürünle kanıtlamaktır.'
                }
            },
            methodology: 'Metodoloji',
            methodologyDesc: 'SRS algoritması ve Leitner sistemi hakkında detaylı bilgi için:',
            viewMethodology: 'Öğrenme Motorunu İncele',
            contact: {
                title: 'İletişim',
                text: 'Proje hakkında sorularınız veya iş birliği önerileriniz için:',
            },
            footer: {
                version: 'Versiyon',
                terms: 'terim',
                languages: 'dil'
            },
        },
        en: {
            title: 'About',
            subtitle: 'FinTechTerms: A Digital Economy Bridge Between Two Countries',
            metaDesc: 'FinTechTerms unites the universal language of finance and code under the concept of diplomats of the Russian word.',
            sections: {
                vision: {
                    title: 'Our Vision',
                    text: 'In global markets, especially given the deepening economic relations, trade volume, and increasing cross-border financial transactions between Turkey and Russia, a new necessity has emerged for both professionals and the peoples of both countries: A common and accurate terminology. FinTechTerms is an interactive learning ecosystem that unites the complex language of finance, payment systems (FinTech), and the software world in Russian, English, and Turkish within a single hub.'
                },
                story: {
                    title: 'Our Story & Starting Point',
                    text: 'This project was brought to life at the intersection of Management Information Systems (MIS) and Economics disciplines to solve a real-world communication gap experienced in the field. It is the work of a visionary foundation aiming to deepen its academic career in well-established institutions in heartland cities like St. Petersburg and Moscow, and to strengthen commercial ties between the peoples of the two countries. For us, Russian is not merely a literary tool; it is a strategic key that connects the digital economies, entrepreneurs, and daily financial interactions of the two nations.'
                },
                tech: {
                    title: 'Technology & Seamless Experience',
                    text: 'Unlike traditional dictionaries, FinTechTerms supports its users on every platform they reside through its Telegram bot, PWA web architecture, and centralized database synchronization. It does not just offer translations; it ensures lasting professional development with voice pronunciations, smart quizzes, and personal statistics tracking.'
                },
                mission: {
                    title: 'Our Mission',
                    text: 'In full alignment with the "Diplomats of the Russian Word" project, our goal is to prove the unifying power of the Russian language in modern finance, technology, and cross-border trade through an enterprise-standard digital product.'
                }
            },
            methodology: 'Methodology',
            methodologyDesc: 'For detailed information about the SRS algorithm and Leitner system:',
            viewMethodology: 'Explore Learning Engine',
            contact: {
                title: 'Contact',
                text: 'For questions about the project or collaboration proposals:',
            },
            footer: {
                version: 'Version',
                terms: 'terms',
                languages: 'languages'
            },
        },
        ru: {
            title: 'О проекте',
            subtitle: 'FinTechTerms: Цифровой экономический мост между двумя странами',
            metaDesc: 'FinTechTerms объединяет язык финансов и кода в рамках концепции дипломатов русского слова.',
            sections: {
                vision: {
                    title: 'Наше видение',
                    text: 'На глобальных рынках, особенно с учетом углубляющихся экономических отношений, объемов торговли и растущих трансграничных финансовых операций между Турцией и Россией, возникла новая потребность как для профессионалов, так и для народов обеих стран: общая и точная терминология. FinTechTerms — это интерактивная экосистема обучения, которая объединяет сложный язык финансов, платежных систем (FinTech) и мира программного обеспечения на русском, английском и турецком языках в едином центре.'
                },
                story: {
                    title: 'Наша история и отправная точка',
                    text: 'Этот проект был создан на стыке дисциплин информационных систем управления (ИСУ/MIS) и экономики для решения реальных проблем коммуникации, возникающих на практике. Это результат прорывного видения, направленного на углубление академической карьеры в ведущих учреждениях таких ключевых городов, как Санкт-Петербург и Москва, а также на укрепление деловых связей между народами двух стран. Для нас русский язык — это не просто литературный инструмент; это стратегический ключ, связывающий цифровые экономики, предпринимателей и повседневные финансовые взаимодействия двух наций.'
                },
                tech: {
                    title: 'Технологии и бесперебойный опыт',
                    text: 'В отличие от традиционных словарей, FinTechTerms поддерживает пользователей на любой платформе благодаря боту в Telegram, веб-архитектуре PWA и централизованной синхронизации баз данных. Платформа предлагает не просто переводы — она обеспечивает устойчивое профессиональное развитие с помощью голосового произношения, умных тестов и отслеживания личной статистики.'
                },
                mission: {
                    title: 'Наша миссия',
                    text: 'В полном соответствии с проектом «Дипломаты Русского Слова», наша цель — доказать объединяющую силу русского языка в современных финансах, технологиях и трансграничной торговле с помощью цифрового продукта корпоративного стандарта.'
                }
            },
            methodology: 'Методология',
            methodologyDesc: 'Подробная информация об алгоритме SRS и системе Лейтнера:',
            viewMethodology: 'Изучить движок обучения',
            contact: {
                title: 'Контакты',
                text: 'Для вопросов о проекте или предложений о сотрудничестве:',
            },
            footer: {
                version: 'Версия',
                terms: 'терминов',
                languages: 'языков'
            },
        },
    };

    const t = content[language];

    return (
        <div className="page-content px-4 py-8 max-w-2xl mx-auto">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'AboutPage',
                        name: 'About FinTechTerms',
                        description: t.metaDesc,
                        mainEntity: {
                            '@type': 'Organization',
                            name: 'FinTechTerms',
                            foundingDate: '2024',
                            description: t.sections.mission.text
                        }
                    }),
                }}
            />

            {/* Header */}
            <header className="text-center mb-10">
                <div className="inline-flex items-center justify-center p-4 bg-primary-100 dark:bg-primary-900/40 rounded-3xl mb-5 shadow-inner">
                    <Globe className="w-12 h-12 text-primary-600 dark:text-primary-400" />
                </div>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3 tracking-tight">{t.title}</h1>
                <p className="text-lg md:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-blue-600 dark:from-primary-400 dark:to-blue-400 leading-snug max-w-lg mx-auto">
                    {t.subtitle}
                </p>
            </header>

            {/* Mission (Manifesto Highlight) */}
            <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-primary-600 to-blue-700 rounded-3xl p-6 md:p-8 text-white mb-8 shadow-xl shadow-primary-500/20 transform transition-transform hover:scale-[1.01]">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-white/20 backdrop-blur-md rounded-xl">
                            <Target className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-xl md:text-2xl font-bold tracking-wide">{t.sections.mission.title}</h2>
                    </div>
                    <p className="text-white/95 text-base md:text-lg leading-relaxed font-medium">
                        "{t.sections.mission.text.replace(/^"|"$/g, '')}"
                    </p>
                </div>
            </section>

            {/* Vision */}
            <section className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.sections.vision.title}</h2>
                </div>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                    {t.sections.vision.text}
                </p>
            </section>

            {/* Story */}
            <section className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 dark:bg-amber-900/10 rounded-bl-full -z-0"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.sections.story.title}</h2>
                    </div>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                        {t.sections.story.text}
                    </p>
                </div>
            </section>

            {/* Tech */}
            <section className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                        <Brain className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.sections.tech.title}</h2>
                </div>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
                    {t.sections.tech.text}
                </p>

                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1">{t.methodology}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t.methodologyDesc}</p>
                    </div>
                    <Link
                        href="/about-project"
                        className="w-full sm:w-auto inline-flex justify-center items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shrink-0"
                    >
                        {t.viewMethodology}
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </section>

            {/* Telegram Bot CTA */}
            <section className="mb-8">
                <TelegramBanner variant="full" />
            </section>

            {/* Contact */}
            <section className="text-center mb-10">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{t.contact.title}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{t.contact.text}</p>
                <div className="flex flex-wrap justify-center gap-3">
                    <a
                        href="mailto:contact@fintechterms.com"
                        className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:border-primary-500 transition-colors"
                    >
                        <Mail className="w-4 h-4" />
                        Email
                    </a>
                    <a
                        href="https://github.com/kagandms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:border-gray-900 dark:hover:border-white transition-colors"
                    >
                        <Github className="w-4 h-4" />
                        GitHub
                    </a>
                </div>
            </section>

            {/* Footer */}
            <footer className="text-center pt-6 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-center gap-3 text-xs md:text-sm font-medium text-gray-400 dark:text-gray-500 mb-3">
                    <span>v1.0.0</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></span>
                    <span>100+ {t.footer.terms}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></span>
                    <span>3 {t.footer.languages}</span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-600">© {new Date().getFullYear()} FinTechTerms.</p>
            </footer>
        </div>
    );
}
