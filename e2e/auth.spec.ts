import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
    test.beforeEach(async ({ page }) => {
        // Go to profile page where auth is handled
        await page.goto('/profile');
    });

    test('should show login modal and handle invalid credentials', async ({ page }) => {
        // Open Login Modal (Text is "Sign In" or "Giriş Yap" depending on default lang, assuming English default or checking aria/role)
        // Using getByRole with generic name or testing ID is better, but following existing pattern
        await page.getByRole('button', { name: /Sign In|Giriş Yap/i }).click();

        // Check if modal is visible
        await expect(page.locator('div[role="dialog"]')).toBeVisible();

        // Fill invalid credentials
        await page.getByPlaceholder(/Email|E-posta/i).fill('invalid@example.com');
        await page.getByPlaceholder(/Password|Şifre/i).fill('wrongpassword');

        // Submit
        await page.getByRole('button', { name: /Sign In|Giriş Yap/i }).click();

        // Expect error message
        await expect(page.getByText(/Invalid credentials|Geçersiz/i)).toBeVisible();
    });

    test('should navigate to forgot password flow', async ({ page }) => {
        // Open Login Modal
        await page.getByRole('button', { name: /Sign In|Giriş Yap/i }).click();

        // Click Forgot Password
        await page.getByText(/Forgot Password|Şifremi Unuttum/i).click();

        // Verify Forgot Password view - Look for unique text like "Reset Password" or button "Send Link"
        await expect(page.getByRole('button', { name: /Send Link|Gönder/i })).toBeVisible();
        await expect(page.getByPlaceholder(/Email|E-posta/i)).toBeVisible();

        // Try to send without email
        await page.getByRole('button', { name: /Send Link|Gönder/i }).click();

        // Validation check
        await expect(page.getByText(/Enter email|E-posta girin/i)).toBeVisible();

        // Fill email and send
        await page.getByPlaceholder(/Email|E-posta/i).fill('test@example.com');
        await page.getByRole('button', { name: /Send Link|Gönder/i }).click();

        // Assert success state (e.g., toast or modal close or change of view)
        // Since we don't have a real backend, we might expect a specific UI response if mocked, 
        // or just ensure no crash.
    });

    test('should validate registration fields', async ({ page }) => {
        // Open Login Modal first then switch to Sign Up or if there is a direct Sign Up button
        // Assuming there is a "Create Account" or "Sign Up" button on Profile page for guests
        const signUpBtn = page.locator('button').filter({ hasText: /Sign Up|Kayıt Ol|Create Account/i }).first();
        if (await signUpBtn.isVisible()) {
            await signUpBtn.click();
        } else {
            // Fallback: Open Login then switch
            await page.getByRole('button', { name: /Sign In|Giriş Yap/i }).click();
            await page.getByText(/Sign up|Kayıt ol/i).click();
        }

        // Verify Register View
        await expect(page.getByPlaceholder(/Your first name|İsim/i)).toBeVisible();

        // Try to submit empty form
        await page.getByRole('button', { name: /Sign Up|Kayıt Ol/i }).click();

        // Expect validation error
        await expect(page.getByText(/required|gerekli/i).first()).toBeVisible();

        // Fill Name and try again
        await page.getByPlaceholder(/Your first name|İsim/i).fill('Test');
        await page.getByRole('button', { name: /Sign Up|Kayıt Ol/i }).click();

        // Expect validation for Last Name
        await expect(page.getByText(/required|gerekli/i).first()).toBeVisible(); // Generic check for "required" message
    });
});
