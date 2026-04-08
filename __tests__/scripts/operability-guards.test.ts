/**
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';

const ciWorkflowPath = path.join(process.cwd(), '.github/workflows/ci.yml');
const previewWorkflowPath = path.join(process.cwd(), '.github/workflows/e2e.yml');
const botDockerfilePath = path.join(process.cwd(), 'telegram-bot/Dockerfile');
const operationsDocPath = path.join(process.cwd(), 'docs/OPERATIONS.md');
const readmePath = path.join(process.cwd(), 'README.md');
const runtimeValidationScriptPath = path.join(process.cwd(), 'scripts/validate-runtime-env.mjs');

describe('operability guards', () => {
    const ciWorkflow = fs.readFileSync(ciWorkflowPath, 'utf8');
    const previewWorkflow = fs.readFileSync(previewWorkflowPath, 'utf8');
    const botDockerfile = fs.readFileSync(botDockerfilePath, 'utf8');
    const operationsDoc = fs.readFileSync(operationsDocPath, 'utf8');
    const readme = fs.readFileSync(readmePath, 'utf8');
    const runtimeValidationScript = fs.readFileSync(runtimeValidationScriptPath, 'utf8');

    it('requires release-evaluable runtime secrets before runtime validation and build', () => {
        expect(ciWorkflow).toContain('name: Check Release-Evaluable Runtime Secrets');
        expect(ciWorkflow).toContain('- name: Build Secret-Free Contract');
        expect(ciWorkflow).toContain('NEXT_PUBLIC_SITE_URL: https://build.fintechterms.dev');
        expect(ciWorkflow).toContain('NEXT_PUBLIC_SUPABASE_URL: https://project.supabase.co');
        expect(ciWorkflow).toContain('SUPABASE_SERVICE_ROLE_KEY: build-service-role-key-0123456789abcdefghijklmnop');
        expect(ciWorkflow).toContain('OPENROUTER_API_KEY: build-openrouter-key-0123456789abcdefghijklmnop');
        expect(ciWorkflow).toContain('runtime_ready=true');
        expect(ciWorkflow).toContain('runtime_reason=not_configured');
        expect(ciWorkflow).toContain('Runtime env validation and production build are skipped because release-evaluable runtime secrets are not configured in this GitHub environment.');
        expect(ciWorkflow).toContain("if: ${{ steps.runtime_preflight.outputs.runtime_ready == 'true' }}");
        expect(ciWorkflow).not.toContain('validation-service-role-key-0123456789abcdefghijklmnop');
        expect(ciWorkflow).not.toContain('validation-study-session-secret-0123456789abcdefghijklmnop');
        expect(ciWorkflow).not.toContain('validation-openrouter-key-0123456789abcdefghijklmnop');
        expect(ciWorkflow).not.toContain('validation-upstash-token-0123456789abcdefghijklmnop');
        expect(ciWorkflow).not.toContain('https://redis-validation.fintechterms.dev');
    });

    it('validates preview release-gate env on same-repo pull requests too', () => {
        expect(previewWorkflow).toContain('- name: Validate release-gate environment');
        expect(previewWorkflow).not.toContain("if: ${{ github.event_name != 'pull_request' }}");
    });

    it('checks bot container health against the readiness endpoint', () => {
        expect(botDockerfile).toContain('/health');
        expect(botDockerfile).not.toContain("socket.create_connection(('localhost'");
    });

    it('keeps runtime env docs aligned with the runtime validator contract', () => {
        expect(runtimeValidationScript).toContain("'OPENROUTER_API_KEY'");
        expect(runtimeValidationScript).toContain("'AI_PRIMARY_MODEL'");
        expect(runtimeValidationScript).toContain("'AI_FALLBACK_MODELS'");

        expect(operationsDoc).toContain('`OPENROUTER_API_KEY`');
        expect(operationsDoc).toContain('`AI_PRIMARY_MODEL`');
        expect(operationsDoc).toContain('`AI_FALLBACK_MODELS`');

        expect(readme).toContain('`OPENROUTER_API_KEY`');
        expect(readme).toContain('`AI_PRIMARY_MODEL`');
        expect(readme).toContain('`AI_FALLBACK_MODELS`');
    });
});
