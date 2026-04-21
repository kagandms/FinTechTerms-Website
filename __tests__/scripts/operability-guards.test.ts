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
const releaseGateValidationScriptPath = path.join(process.cwd(), 'scripts/validate-release-gate-env.mjs');
const envValidationUtilsPath = path.join(process.cwd(), 'scripts/env-validation-utils.mjs');
const releaseDbVerificationScriptPath = path.join(process.cwd(), 'scripts/verify-release-db.mjs');
const packageJsonPath = path.join(process.cwd(), 'package.json');

describe('operability guards', () => {
    const ciWorkflow = fs.readFileSync(ciWorkflowPath, 'utf8');
    const previewWorkflow = fs.readFileSync(previewWorkflowPath, 'utf8');
    const botDockerfile = fs.readFileSync(botDockerfilePath, 'utf8');
    const operationsDoc = fs.readFileSync(operationsDocPath, 'utf8');
    const readme = fs.readFileSync(readmePath, 'utf8');
    const runtimeValidationScript = fs.readFileSync(runtimeValidationScriptPath, 'utf8');
    const releaseGateValidationScript = fs.readFileSync(releaseGateValidationScriptPath, 'utf8');
    const envValidationUtils = fs.readFileSync(envValidationUtilsPath, 'utf8');
    const releaseDbVerificationScript = fs.readFileSync(releaseDbVerificationScriptPath, 'utf8');
    const packageJson = fs.readFileSync(packageJsonPath, 'utf8');

    it('requires release-evaluable runtime secrets before runtime validation and build', () => {
        expect(ciWorkflow).toContain('name: Check Release-Evaluable Runtime Secrets');
        expect(ciWorkflow).toContain('- name: Build Secret-Free Contract');
        expect(ciWorkflow).toContain('NEXT_PUBLIC_SITE_URL: https://build.fintechterms.dev');
        expect(ciWorkflow).toContain('NEXT_PUBLIC_SUPABASE_URL: https://project.supabase.co');
        expect(ciWorkflow).toContain('SUPABASE_SERVICE_ROLE_KEY: build-service-role-key-0123456789abcdefghijklmnop');
        expect(ciWorkflow).toContain('OPENROUTER_API_KEY: build-openrouter-key-0123456789abcdefghijklmnop');
        expect(ciWorkflow).toContain('AI_PRIMARY_MODEL: mistralai/mistral-small-2603');
        expect(ciWorkflow).toContain('AI_FALLBACK_MODELS: deepseek/deepseek-chat-v3.1,openai/gpt-oss-20b');
        expect(ciWorkflow).toContain('runtime_ready=true');
        expect(ciWorkflow).toContain('vars.AI_PRIMARY_MODEL || secrets.AI_PRIMARY_MODEL');
        expect(ciWorkflow).toContain('vars.AI_FALLBACK_MODELS || secrets.AI_FALLBACK_MODELS');
        expect(ciWorkflow).toContain("environment: ${{ vars.CI_RUNTIME_ENVIRONMENT_NAME || 'production' }}");
        expect(ciWorkflow).toContain("Checked GitHub environment: ${{ vars.CI_RUNTIME_ENVIRONMENT_NAME || 'production' }}");
        expect(ciWorkflow).toContain('missing_runtime_vars=');
        expect(ciWorkflow).toContain('Missing required release-evaluable runtime secrets on a same-repo pull request:');
        expect(ciWorkflow).toContain('Missing required release-evaluable runtime secrets on a protected branch run:');
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
        expect(previewWorkflow).toContain('NEXT_PUBLIC_SITE_URL');
        expect(previewWorkflow).toContain('OPENROUTER_API_KEY');
        expect(previewWorkflow).toContain('AI_PRIMARY_MODEL');
        expect(previewWorkflow).toContain('AI_FALLBACK_MODELS');
        expect(previewWorkflow).toContain('vars.AI_PRIMARY_MODEL || secrets.AI_PRIMARY_MODEL');
        expect(previewWorkflow).toContain('vars.ADMIN_USER_IDS || secrets.ADMIN_USER_IDS');
        expect(previewWorkflow).toContain("environment: ${{ vars.PREVIEW_GATE_ENVIRONMENT_NAME || 'staging' }}");
        expect(previewWorkflow).toContain("Checked GitHub environment: ${{ vars.PREVIEW_GATE_ENVIRONMENT_NAME || 'staging' }}");
        expect(previewWorkflow).toContain('missing_core_vars=');
    });

    it('checks bot container health against the readiness endpoint', () => {
        expect(botDockerfile).toContain('/health');
        expect(botDockerfile).not.toContain("socket.create_connection(('localhost'");
    });

    it('guards support artifact manifests against leaked server sourcemaps', () => {
        expect(packageJson).toContain('"guard:artifact-sourcemaps": "node scripts/guard-artifact-sourcemaps.mjs"');
        expect(ciWorkflow).toContain('name: Guard Support Artifact Source Maps');
        expect(ciWorkflow).toContain('npm run guard:artifact-sourcemaps -- "$artifact_manifest"');
        expect(operationsDoc).toContain('`npm run guard:artifact-sourcemaps -- path/to/artifact-manifest.txt`');
        expect(operationsDoc).toContain('`.next/server/**/*.map`');
    });

    it('keeps runtime env docs aligned with the runtime validator contract', () => {
        expect(runtimeValidationScript).toContain("'OPENROUTER_API_KEY'");
        expect(runtimeValidationScript).toContain("'AI_PRIMARY_MODEL'");
        expect(runtimeValidationScript).toContain("'AI_FALLBACK_MODELS'");
        expect(releaseGateValidationScript).toContain("'NEXT_PUBLIC_SITE_URL'");
        expect(releaseGateValidationScript).toContain("'OPENROUTER_API_KEY'");
        expect(releaseGateValidationScript).toContain("'AI_PRIMARY_MODEL'");
        expect(releaseGateValidationScript).toContain("'AI_FALLBACK_MODELS'");
        expect(readme).toContain('`NEXT_PUBLIC_SITE_URL`');
        expect(envValidationUtils).toContain("ALLOW_LOCAL_ENV_VALIDATION");
        expect(releaseDbVerificationScript).toContain("import { loadLocalEnv } from './env-validation-utils.mjs';");

        expect(operationsDoc).toContain('`OPENROUTER_API_KEY`');
        expect(operationsDoc).toContain('`AI_PRIMARY_MODEL`');
        expect(operationsDoc).toContain('`AI_FALLBACK_MODELS`');
        expect(operationsDoc).toContain('`NEXT_PUBLIC_SITE_URL`');
        expect(operationsDoc).toContain('Supabase Storage buckets containing user-linked files');
        expect(operationsDoc).toContain('`ALLOW_LOCAL_ENV_VALIDATION=1`');

        expect(readme).toContain('`OPENROUTER_API_KEY`');
        expect(readme).toContain('`AI_PRIMARY_MODEL`');
        expect(readme).toContain('`AI_FALLBACK_MODELS`');
        expect(readme).toContain('`ALLOW_LOCAL_ENV_VALIDATION=1`');
    });
});
