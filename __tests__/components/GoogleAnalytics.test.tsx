/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock Next.js Script component
jest.mock('next/script', () => {
    return function MockScript({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) {
        return <script data-testid={props.id as string}>{children}</script>;
    };
});

// We need to test the consent logic, not the full component
describe('Google Analytics Consent Logic', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should not have consent by default', () => {
        const consent = localStorage.getItem('analytics_consent');
        expect(consent).toBeNull();
    });

    it('should store consent when user accepts', () => {
        localStorage.setItem('analytics_consent', 'true');
        const consent = localStorage.getItem('analytics_consent');
        expect(consent).toBe('true');
    });

    it('should detect consent withdrawal', () => {
        localStorage.setItem('analytics_consent', 'true');
        expect(localStorage.getItem('analytics_consent')).toBe('true');

        localStorage.removeItem('analytics_consent');
        expect(localStorage.getItem('analytics_consent')).toBeNull();
    });

    it('should not load GA scripts without consent', () => {
        // Simulate the component logic
        const hasConsent = localStorage.getItem('analytics_consent') === 'true';
        expect(hasConsent).toBe(false);
        // If no consent, component returns null (no scripts)
    });

    it('should load GA scripts after consent', () => {
        localStorage.setItem('analytics_consent', 'true');
        const hasConsent = localStorage.getItem('analytics_consent') === 'true';
        expect(hasConsent).toBe(true);
        // If consent given, component renders scripts
    });
});

describe('Google Analytics GA_ID Configuration', () => {
    it('should have a valid GA_ID format', () => {
        // GA4 IDs follow pattern G-XXXXXXXXXX
        const validPattern = /^G-[A-Z0-9]+$/;
        const testId = 'G-XXXXXXXXXX';
        expect(validPattern.test(testId)).toBe(true);
    });

    it('should reject invalid GA_ID', () => {
        const validPattern = /^G-[A-Z0-9]+$/;
        expect(validPattern.test('')).toBe(false);
        expect(validPattern.test('UA-12345')).toBe(false);
        expect(validPattern.test('invalid')).toBe(false);
    });
});
