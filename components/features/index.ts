/**
 * Components Barrel Exports (M18)
 * Skill: code-refactoring-refactor-clean, typescript-pro
 *
 * Central re-export point for all feature components.
 * Enables cleaner imports: import { AuthForm, SettingsPanel } from '@/components/features';
 */

// ── Auth Components ──────────────────────────────────────
export { default as AuthForm } from './auth/AuthForm';
export { default as AuthModal } from './auth/AuthModal';
export { default as OTPVerification } from './auth/OTPVerification';
export { default as UpdatePasswordForm } from './auth/UpdatePasswordForm';

// ── Profile Components ───────────────────────────────────
export { default as SettingsPanel } from './profile/SettingsPanel';
export { default as StatsGrid } from './profile/StatsGrid';
export { default as ResetConfirmModal } from './profile/ResetConfirmModal';
