/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import TelegramIcon from '@/components/icons/telegram-icon';

describe('TelegramIcon', () => {
    it('renders a decorative Telegram glyph with inherited color', () => {
        render(<TelegramIcon data-testid="telegram-icon" className="text-white" />);

        const icon = screen.getByTestId('telegram-icon');
        expect(icon).toHaveAttribute('viewBox', '0 0 24 24');
        expect(icon).toHaveAttribute('aria-hidden', 'true');
        expect(icon.querySelector('path')).toHaveAttribute('fill', 'currentColor');
    });
});
