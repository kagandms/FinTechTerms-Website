'use client';

import { useEffect, useId, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface UseAccessibleDialogOptions {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly initialFocusRef?: RefObject<HTMLElement>;
}

interface AccessibleDialogState {
    readonly dialogRef: RefObject<HTMLDivElement>;
    readonly titleId: string;
    readonly descriptionId: string;
}

const getFocusableElements = (dialog: HTMLElement): HTMLElement[] => (
    Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
);

const focusInitialElement = (
    dialog: HTMLElement,
    initialFocusRef?: RefObject<HTMLElement>
): void => {
    if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
    }

    const [firstFocusableElement] = getFocusableElements(dialog);
    if (firstFocusableElement) {
        firstFocusableElement.focus();
        return;
    }

    dialog.focus();
};

const trapFocus = (dialog: HTMLElement, event: KeyboardEvent): void => {
    if (event.key !== 'Tab') {
        return;
    }

    const focusableElements = getFocusableElements(dialog);
    if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
    }

    const [firstFocusableElement] = focusableElements;
    const lastFocusableElement = focusableElements[focusableElements.length - 1];

    if (!firstFocusableElement || !lastFocusableElement) {
        return;
    }

    const activeElement = document.activeElement;

    if (!event.shiftKey && activeElement === lastFocusableElement) {
        event.preventDefault();
        firstFocusableElement.focus();
        return;
    }

    if (event.shiftKey && activeElement === firstFocusableElement) {
        event.preventDefault();
        lastFocusableElement.focus();
    }
};

/**
 * Provides keyboard, focus-trap, and scroll-lock behavior for modal dialogs.
 *
 * @param options Dialog lifecycle callbacks and optional initial focus target.
 * @returns Stable ids and a dialog ref to wire into the modal surface.
 */
export function useAccessibleDialog({
    isOpen,
    onClose,
    initialFocusRef,
}: UseAccessibleDialogOptions): AccessibleDialogState {
    const dialogRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const descriptionId = useId();

    const onCloseRef = useRef(onClose);
    const initialFocusRefRef = useRef(initialFocusRef);

    useEffect(() => {
        onCloseRef.current = onClose;
        initialFocusRefRef.current = initialFocusRef;
    }, [onClose, initialFocusRef]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const activeElementBeforeOpen = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.body.style.overflow;

        document.body.style.overflow = 'hidden';

        const focusFrameId = window.requestAnimationFrame(() => {
            const dialog = dialogRef.current;
            if (dialog) {
                focusInitialElement(dialog, initialFocusRefRef.current);
            }
        });

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCloseRef.current();
                return;
            }

            const dialog = dialogRef.current;
            if (!dialog || !dialog.contains(document.activeElement)) {
                return;
            }

            trapFocus(dialog, event);
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.cancelAnimationFrame(focusFrameId);
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
            activeElementBeforeOpen?.focus();
        };
    }, [isOpen]);

    return {
        dialogRef,
        titleId,
        descriptionId,
    };
}
