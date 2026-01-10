import type { Config } from 'tailwindcss';

const config: Config = {
    darkMode: 'class', // Changed from 'media' to 'class' for manual toggle
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                // Academic Fintech Theme
                primary: {
                    50: '#e6f0f5',
                    100: '#cce1eb',
                    200: '#99c3d7',
                    300: '#66a5c3',
                    400: '#3387af',
                    500: '#0e3b5e', // Navy Blue - Main
                    600: '#0c3452',
                    700: '#0a2d46',
                    800: '#08263a',
                    900: '#061f2e',
                    950: '#041822',
                },
                accent: {
                    50: '#fffbeb',
                    100: '#fef3c7',
                    200: '#fde68a',
                    300: '#fcd34d',
                    400: '#fbbf24',
                    500: '#f59e0b', // Gold/Orange - Accent
                    600: '#d97706',
                    700: '#b45309',
                    800: '#92400e',
                    900: '#78350f',
                    950: '#451a03',
                },
                surface: {
                    light: '#ffffff',
                    dark: '#1a1a2e',
                    card: '#f8fafc',
                    cardDark: '#16213e',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            boxShadow: {
                'card': '0 4px 20px rgba(14, 59, 94, 0.08)',
                'card-hover': '0 8px 30px rgba(14, 59, 94, 0.15)',
                'nav': '0 -4px 20px rgba(14, 59, 94, 0.1)',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.4s ease-out',
                'pulse-soft': 'pulseSoft 2s infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                pulseSoft: {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.7' },
                },
            },
        },
    },
    plugins: [],
};

export default config;
