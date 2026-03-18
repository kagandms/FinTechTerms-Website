import { Inter, JetBrains_Mono } from 'next/font/google';

export const inter = Inter({
    subsets: ['latin', 'cyrillic'],
    variable: '--font-inter',
    display: 'swap',
});

export const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin', 'cyrillic'],
    variable: '--font-jetbrains-mono',
    display: 'swap',
});
