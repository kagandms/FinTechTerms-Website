/**
 * Components Barrel Exports (M18)
 *
 * Central re-export point for all feature components.
 * Usage: import { AuthForm, SettingsPanel } from '@/components/features';
 */

// ── Auth Components ──────────────────────────────────────
export { AuthForm } from './auth/AuthForm';
export { OTPVerification } from './auth/OTPVerification';
export { UpdatePasswordForm } from './auth/UpdatePasswordForm';

// ── Profile Components ───────────────────────────────────
export { default as SettingsPanel } from './profile/SettingsPanel';
