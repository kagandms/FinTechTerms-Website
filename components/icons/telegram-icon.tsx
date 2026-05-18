import type React from 'react';

/**
 * Telegram brand-style glyph used where lucide does not provide the official mark.
 */
export default function TelegramIcon(props: React.SVGProps<SVGSVGElement>): React.JSX.Element {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            focusable="false"
            {...props}
        >
            <path
                d="M21.72 4.44c.22-.95-.7-1.73-1.58-1.34L2.78 10.77c-1.04.46-.99 1.93.08 2.31l4.24 1.5 1.62 5.06c.32.99 1.6 1.22 2.24.4l2.3-2.94 4.4 3.21c.78.57 1.9.13 2.12-.82L21.72 4.44Zm-4.45 3.4-7.42 6.58-.29 3.21-1.08-3.36 8.79-6.43Z"
                fill="currentColor"
            />
        </svg>
    );
}
