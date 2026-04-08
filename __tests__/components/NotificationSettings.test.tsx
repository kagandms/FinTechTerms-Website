import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotificationSettings from '@/components/NotificationSettings';

const mockShowToast = jest.fn();

jest.mock('@/contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}));

describe('NotificationSettings', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockShowToast.mockReset();
        localStorage.clear();
        Object.defineProperty(window, 'Notification', {
            configurable: true,
            value: Object.assign(jest.fn(), {
                permission: 'default',
                requestPermission: jest.fn().mockResolvedValue('default'),
            }),
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    it('states clearly that reminders are open-app only and not background push notifications', () => {
        render(<NotificationSettings language="en" />);

        expect(screen.getByText('Open-App Reminder')).toBeInTheDocument();
        expect(screen.getByText('Not a background push notification')).toBeInTheDocument();
        expect(screen.getByText(/It only works while the app is open\./)).toBeInTheDocument();
    });

    it('does not enable reminders when config persistence fails after permission is granted', async () => {
        const notificationMock = Object.assign(jest.fn(), {
            permission: 'default',
            requestPermission: jest.fn().mockResolvedValue('granted'),
        });
        Object.defineProperty(window, 'Notification', {
            configurable: true,
            value: notificationMock,
        });

        const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('storage write failed');
        });

        render(<NotificationSettings language="en" />);

        fireEvent.click(screen.getByRole('button', { name: 'Enable Open-App Reminder' }));

        await act(async () => {
            await Promise.resolve();
        });

        expect(notificationMock.requestPermission).toHaveBeenCalledTimes(1);
        expect(mockShowToast).toHaveBeenCalledWith('Notification settings could not be saved.', 'error');
        expect(screen.queryByText('Active In Open Tab')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Enable Open-App Reminder' })).toBeInTheDocument();

        setItemSpy.mockRestore();
    });

    it('guards scheduled reminder storage access so the interval does not crash', () => {
        const now = new Date();
        const currentHour = String(now.getHours()).padStart(2, '0');
        const currentMinute = String(now.getMinutes()).padStart(2, '0');
        localStorage.setItem('ftt_notification_settings', JSON.stringify({
            enabled: true,
            hour: Number(currentHour),
            minute: Number(currentMinute),
        }));

        const notificationMock = Object.assign(jest.fn(), {
            permission: 'granted',
            requestPermission: jest.fn().mockResolvedValue('granted'),
        });
        Object.defineProperty(window, 'Notification', {
            configurable: true,
            value: notificationMock,
        });

        const originalSetItem = Storage.prototype.setItem;
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string): void {
            if (key === 'ftt_last_notification_date') {
                throw new Error('storage unavailable');
            }

            return originalSetItem.call(this, key, value);
        });

        render(<NotificationSettings language="en" />);

        act(() => {
            jest.advanceTimersByTime(60000);
        });

        expect(screen.getByText('Open-App Reminder')).toBeInTheDocument();
        expect(notificationMock).not.toHaveBeenCalled();
    });
});
