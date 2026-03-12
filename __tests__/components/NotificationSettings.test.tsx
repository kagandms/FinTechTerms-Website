import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationSettings from '@/components/NotificationSettings';

jest.mock('@/contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: jest.fn(),
    }),
}));

describe('NotificationSettings', () => {
    beforeEach(() => {
        localStorage.clear();
        Object.defineProperty(window, 'Notification', {
            configurable: true,
            value: {
                permission: 'default',
                requestPermission: jest.fn().mockResolvedValue('default'),
            },
        });
    });

    it('states clearly that reminders are open-app only and not background push notifications', () => {
        render(<NotificationSettings language="en" />);

        expect(screen.getByText('Open-App Reminder')).toBeInTheDocument();
        expect(screen.getByText('Not a background push notification')).toBeInTheDocument();
        expect(screen.getByText(/It only works while the app is open\./)).toBeInTheDocument();
    });
});
