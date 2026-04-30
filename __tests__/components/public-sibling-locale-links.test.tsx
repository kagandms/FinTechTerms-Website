/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import PublicSiblingLocaleLinks from '@/components/public-sibling-locale-links';

describe('PublicSiblingLocaleLinks', () => {
    it('renders crawlable sibling locale links for the current route suffix', () => {
        render(<PublicSiblingLocaleLinks currentLocale="ru" suffix="/glossary/tokenization" />);

        expect(screen.getByRole('link', { name: 'ru' })).toHaveAttribute('href', '/ru/glossary/tokenization');
        expect(screen.getByRole('link', { name: 'en' })).toHaveAttribute('href', '/en/glossary/tokenization');
        expect(screen.getByRole('link', { name: 'tr' })).toHaveAttribute('href', '/tr/glossary/tokenization');
        expect(screen.getByRole('link', { name: 'ru' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: 'en' })).toHaveAttribute('hrefLang', 'en');
        expect(screen.getByRole('link', { name: 'tr' })).toHaveAttribute('rel', 'alternate');
    });
});
