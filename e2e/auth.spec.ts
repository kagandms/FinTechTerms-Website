import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
    test.beforeEach(async ({ page }) => {
        // Go to profile page where auth is handled
        await page.goto('/profile');
    });

    test('should show login modal and handle invalid credentials', async ({ page }) => {
        // Open Login Modal (Text is "Sign In" in en.json)
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();

        // Check if modal is visible - Header uses "Sign In"
        await expect(page.locator('h3').filter({ hasText: 'Sign In' })).toBeVisible();

        // Fill invalid credentials
        await page.getByPlaceholder('Email').fill('invalid@example.com');
        await page.getByPlaceholder('Password').fill('wrongpassword');

        // Submit - Button also says "Sign In"
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();

        // Expect error message
        await expect(page.getByText('Invalid credentials')).toBeVisible();
    });

    test('should navigate to forgot password flow', async ({ page }) => {
        // Open Login Modal
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();

        // Click Forgot Password
        await page.getByRole('button', { name: 'Forgot Password?' }).click();

        // Verify Forgot Password view
        await expect(page.locator('h3').filter({ hasText: 'Reset Password' })).toBeVisible();
        await expect(page.getByPlaceholder('Email')).toBeVisible();

        // Try to send without email
        await page.getByRole('button', { name: 'Send Link' }).click();

        // Validation check (The app shows "Enter email" as error message text? Need to verify)
        // In page.tsx: setAuthError(... 'Enter email');
        await expect(page.getByText('Enter email')).toBeVisible();

        // Fill email and send
        await page.getByPlaceholder('Email').fill('test@example.com');
        await page.getByRole('button', { name: 'Send Link' }).click();
    });

    test('should validate registration fields', async ({ page }) => {
        // Open Register Modal
        await page.getByRole('button', { name: 'Sign Up', exact: true }).click();

        // Verify Register View
        await expect(page.locator('h3').filter({ hasText: 'Sign Up' })).toBeVisible();

        // Try to submit empty form
        await page.getByRole('button', { name: 'Sign Up', exact: true }).click();

        // Expect validation error for First Name (First field)
        await expect(page.getByText('First name is required')).toBeVisible();

        // Fill Name and try again
        await page.getByPlaceholder('Your first name').fill('Test');
        await page.getByRole('button', { name: 'Sign Up', exact: true }).click();

        // Expect validation for Last Name
        await expect(page.getByText('Last name is required')).toBeVisible();
    });
});
