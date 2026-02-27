/**
 * Components Barrel Exports (M18)
 * Skill: code-refactoring-refactor-clean, typescript-pro
 *
 * Central re-export point for all feature components.
 * Enables cleaner imports: import { LoginForm, SettingsPanel } from '@/components/features';
 */

// ── Auth Components ──────────────────────────────────────
export { default as LoginForm } from './auth/LoginForm';
export { default as OTPModal } from './auth/OTPModal';
export { default as PasswordRecovery } from './auth/PasswordRecovery';

// ── Profile Components ───────────────────────────────────
export { default as SettingsPanel } from './profile/SettingsPanel';
