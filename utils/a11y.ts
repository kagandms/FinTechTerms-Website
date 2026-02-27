/**
 * Accessibility (a11y) Audit Checklist & Utilities (M29)
 * Skill: frontend-developer, react-best-practices
 *
 * WCAG 2.1 Level AA compliance checklist for FinTechTerms.
 * This file documents the audit and provides helper utilities.
 */

// ── A11y Utility: Generate unique IDs for interactive elements ──
let _counter = 0;
export function generateA11yId(prefix: string = 'ftt'): string {
    return `${prefix}-${++_counter}`;
}

// ── A11y Utility: Screen reader only text ──
export const srOnlyStyles: React.CSSProperties = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
};

/**
 * WCAG 2.1 AA Checklist for FinTechTerms
 *
 * ✅ = Implemented | ⚠️ = Partial | ❌ = Missing
 *
 * PERCEIVABLE
 * ✅ 1.1.1 Non-text Content: Images have alt text (SmartCard, Header logos)
 * ✅ 1.3.1 Info and Relationships: Semantic HTML (header, main, section, nav)
 * ⚠️ 1.3.2 Meaningful Sequence: Tab order follows visual flow (mostly)
 * ⚠️ 1.4.1 Use of Color: Some status indicators rely on color only
 * ✅ 1.4.3 Contrast (Minimum): Dark mode passes AA for most text
 * ✅ 1.4.4 Resize Text: Responsive design supports 200% zoom
 *
 * OPERABLE
 * ✅ 2.1.1 Keyboard: Interactive elements are keyboard accessible
 * ⚠️ 2.4.1 Bypass Blocks: Missing "skip to content" link
 * ✅ 2.4.2 Page Titled: Each page has descriptive title
 * ⚠️ 2.4.4 Link Purpose: Some icon-only buttons lack descriptive labels
 * ✅ 2.4.7 Focus Visible: Tailwind provides focus ring styles
 *
 * UNDERSTANDABLE
 * ✅ 3.1.1 Language of Page: html lang attribute set
 * ✅ 3.1.2 Language of Parts: Multilingual content properly sectioned
 * ✅ 3.3.1 Error Identification: Form errors shown with text
 * ✅ 3.3.2 Labels or Instructions: Inputs have labels/placeholders
 *
 * ROBUST
 * ✅ 4.1.1 Parsing: Valid HTML output (Next.js ensures this)
 * ✅ 4.1.2 Name, Role, Value: aria-label on icon buttons
 */

import React from 'react';
