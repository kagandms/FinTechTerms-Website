import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
    ...nextCoreWebVitals,
    {
        files: ['**/*.{js,jsx,ts,tsx}'],
        rules: {
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            '@next/next/no-img-element': 'warn',
            'react-hooks/exhaustive-deps': 'warn',
        },
    },
    {
        ignores: [
            'node_modules/**',
            '.next/**',
            'out/**',
            'build/**',
            'dist/**',
            'coverage/**',
            'playwright-report/**',
            'test-results/**',
        ],
    },
];
