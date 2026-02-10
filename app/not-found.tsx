import Link from 'next/link';
import { Search } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="text-center max-w-md">
                {/* 404 visual */}
                <div className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-blue-600 mb-4">
                    404
                </div>

                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    Sayfa Bulunamadı
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                    Aradığınız sayfa mevcut değil veya taşınmış olabilir.
                </p>

                <div className="flex gap-3 justify-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors shadow-md"
                    >
                        Ana Sayfa
                    </Link>
                    <Link
                        href="/search"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        <Search className="w-4 h-4" />
                        Arama
                    </Link>
                </div>
            </div>
        </div>
    );
}
