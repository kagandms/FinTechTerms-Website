/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const globalStyles = fs.readFileSync(
    path.resolve(process.cwd(), 'app/globals.css'),
    'utf8'
);

const DATE_INPUT_BASE_RULE = /\.auth-date-input,\s*\.app-date-input\s*\{([^}]+)\}/;
const DATE_INPUT_VALUE_RULE = /\.auth-date-input::-webkit-date-and-time-value,\s*\.app-date-input::-webkit-date-and-time-value\s*\{([^}]+)\}/;

function getRuleBody(rulePattern: RegExp): string {
    const match = globalStyles.match(rulePattern);

    if (!match?.[1]) {
        throw new Error('Expected date input CSS rule to exist');
    }

    return match[1];
}

describe('date input mobile style contract', () => {
    it('keeps native mobile date controls constrained to their form column', () => {
        // Arrange
        const baseRuleBody = getRuleBody(DATE_INPUT_BASE_RULE);
        const expectedDeclarations = [
            '-webkit-appearance: none;',
            'appearance: none;',
            'box-sizing: border-box;',
            'inline-size: 100%;',
            'max-width: 100%;',
            'min-width: 0;',
            'width: 100%;',
        ];

        // Act / Assert
        for (const declaration of expectedDeclarations) {
            expect(baseRuleBody).toContain(declaration);
        }
    });

    it('prevents the WebKit date value pseudo-element from forcing overflow', () => {
        // Arrange
        const valueRuleBody = getRuleBody(DATE_INPUT_VALUE_RULE);
        const expectedDeclarations = [
            'display: block;',
            'max-width: 100%;',
            'min-width: 0;',
            'overflow: hidden;',
        ];

        // Act / Assert
        for (const declaration of expectedDeclarations) {
            expect(valueRuleBody).toContain(declaration);
        }
    });
});
