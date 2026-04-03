/**
 * @jest-environment jsdom
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ResetConfirmModal } from '@/components/features/profile/ResetConfirmModal';

describe('ResetConfirmModal', () => {
    it('renders a dialog and closes on Escape', () => {
        const onClose = jest.fn();

        render(
            <ResetConfirmModal
                isOpen
                onClose={onClose}
                onConfirm={jest.fn()}
                language="en"
            />
        );

        expect(screen.getByRole('dialog', { name: 'Warning!' })).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
