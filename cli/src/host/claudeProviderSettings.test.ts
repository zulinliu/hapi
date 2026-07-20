import { describe, expect, it } from 'vitest'
import { resolveManagedClaudeSettingsEnv } from './claudeProviderSettings'

describe('resolveManagedClaudeSettingsEnv', () => {
    it('does not override Claude settings for the system provider', () => {
        expect(resolveManagedClaudeSettingsEnv({
            HAPI_PROVIDER_PROFILE_SYSTEM: '1',
            HAPI_PROVIDER_PROFILE_AGENT: 'claude',
            ANTHROPIC_AUTH_TOKEN: 'system-token',
            ANTHROPIC_BASE_URL: 'https://system.example'
        })).toBeUndefined()
    })

    it('makes a managed API key profile authoritative over Claude user settings', () => {
        expect(resolveManagedClaudeSettingsEnv({
            HAPI_PROVIDER_PROFILE_ID: '11111111-1111-4111-8111-111111111111',
            HAPI_PROVIDER_PROFILE_AGENT: 'claude',
            ANTHROPIC_API_KEY: 'managed-key',
            ANTHROPIC_BASE_URL: 'https://managed.example'
        })).toEqual(expect.objectContaining({
            ANTHROPIC_API_KEY: 'managed-key',
            ANTHROPIC_AUTH_TOKEN: '',
            CLAUDE_CODE_OAUTH_TOKEN: '',
            ANTHROPIC_BASE_URL: 'https://managed.example',
            ANTHROPIC_CUSTOM_HEADERS: '',
            ANTHROPIC_MODEL: '',
            CLAUDE_CODE_USE_BEDROCK: '',
            CLAUDE_CODE_USE_VERTEX: '',
            CLAUDE_CODE_USE_FOUNDRY: ''
        }))
    })

    it('makes a managed auth token profile authoritative over Claude user settings', () => {
        expect(resolveManagedClaudeSettingsEnv({
            HAPI_PROVIDER_PROFILE_ID: '11111111-1111-4111-8111-111111111111',
            HAPI_PROVIDER_PROFILE_AGENT: 'claude',
            ANTHROPIC_AUTH_TOKEN: 'managed-token',
            ANTHROPIC_BASE_URL: 'https://managed.example'
        })).toEqual(expect.objectContaining({
            ANTHROPIC_API_KEY: '',
            ANTHROPIC_AUTH_TOKEN: 'managed-token',
            CLAUDE_CODE_OAUTH_TOKEN: '',
            ANTHROPIC_BASE_URL: 'https://managed.example'
        }))
    })

    it('overrides a native custom endpoint when the managed profile uses Anthropic directly', () => {
        expect(resolveManagedClaudeSettingsEnv({
            HAPI_PROVIDER_PROFILE_ID: '11111111-1111-4111-8111-111111111111',
            HAPI_PROVIDER_PROFILE_AGENT: 'claude',
            ANTHROPIC_API_KEY: 'managed-key'
        })?.ANTHROPIC_BASE_URL).toBe('https://api.anthropic.com')
    })

    it('fails fast when managed profile credentials are missing or ambiguous', () => {
        expect(() => resolveManagedClaudeSettingsEnv({
            HAPI_PROVIDER_PROFILE_ID: '11111111-1111-4111-8111-111111111111',
            HAPI_PROVIDER_PROFILE_AGENT: 'claude'
        })).toThrow('Managed Claude provider credential is missing')

        expect(() => resolveManagedClaudeSettingsEnv({
            HAPI_PROVIDER_PROFILE_ID: '11111111-1111-4111-8111-111111111111',
            HAPI_PROVIDER_PROFILE_AGENT: 'claude',
            ANTHROPIC_API_KEY: 'managed-key',
            ANTHROPIC_AUTH_TOKEN: 'managed-token'
        })).toThrow('Managed Claude provider has conflicting credentials')
    })

    it('ignores provider metadata inherited from another managed agent', () => {
        expect(resolveManagedClaudeSettingsEnv({
            HAPI_PROVIDER_PROFILE_ID: '11111111-1111-4111-8111-111111111111',
            HAPI_PROVIDER_PROFILE_AGENT: 'codex'
        })).toBeUndefined()
    })
})
