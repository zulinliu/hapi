import { describe, expect, it } from 'vitest'
import { buildManagedClaudeSettingsEnv } from './claudeProviderSettings'

describe('buildManagedClaudeSettingsEnv', () => {
    it('does not override Claude settings for the system provider', () => {
        expect(buildManagedClaudeSettingsEnv({
            HAPI_PROVIDER_PROFILE_SYSTEM: '1',
            ANTHROPIC_API_KEY: 'system-key',
            ANTHROPIC_BASE_URL: 'https://system.example'
        })).toBeUndefined()
    })

    it('isolates an API-key profile from user-level Claude credentials', () => {
        expect(buildManagedClaudeSettingsEnv({
            HAPI_PROVIDER_PROFILE_ID: '11111111-1111-4111-8111-111111111111',
            HAPI_PROVIDER_PROFILE_AGENT: 'claude',
            ANTHROPIC_API_KEY: 'selected-key',
            ANTHROPIC_BASE_URL: 'https://selected.example'
        }, 'glm-5.2[1M]')).toEqual({
            ANTHROPIC_API_KEY: 'selected-key',
            ANTHROPIC_AUTH_TOKEN: '',
            ANTHROPIC_BASE_URL: 'https://selected.example',
            ANTHROPIC_CUSTOM_HEADERS: '',
            ANTHROPIC_MODEL: 'glm-5.2',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-5.2',
            ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5.2',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-5.2',
            CLAUDE_CODE_OAUTH_TOKEN: ''
        })
    })

    it('isolates an auth-token profile and clears a user-level base URL', () => {
        expect(buildManagedClaudeSettingsEnv({
            HAPI_PROVIDER_PROFILE_ID: '22222222-2222-4222-8222-222222222222',
            HAPI_PROVIDER_PROFILE_AGENT: 'claude',
            ANTHROPIC_AUTH_TOKEN: 'selected-token'
        })).toEqual({
            ANTHROPIC_API_KEY: '',
            ANTHROPIC_AUTH_TOKEN: 'selected-token',
            ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
            ANTHROPIC_CUSTOM_HEADERS: '',
            ANTHROPIC_MODEL: '',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: '',
            ANTHROPIC_DEFAULT_OPUS_MODEL: '',
            ANTHROPIC_DEFAULT_SONNET_MODEL: '',
            CLAUDE_CODE_OAUTH_TOKEN: ''
        })
    })

    it('rejects incomplete or ambiguous managed credentials', () => {
        expect(() => buildManagedClaudeSettingsEnv({
            HAPI_PROVIDER_PROFILE_ID: '33333333-3333-4333-8333-333333333333',
            HAPI_PROVIDER_PROFILE_AGENT: 'claude'
        })).toThrow('credentials are missing')

        expect(() => buildManagedClaudeSettingsEnv({
            HAPI_PROVIDER_PROFILE_ID: '44444444-4444-4444-8444-444444444444',
            HAPI_PROVIDER_PROFILE_AGENT: 'claude',
            ANTHROPIC_API_KEY: 'api-key',
            ANTHROPIC_AUTH_TOKEN: 'auth-token'
        })).toThrow('multiple credentials')
    })

    it('ignores provider metadata belonging to another agent', () => {
        expect(buildManagedClaudeSettingsEnv({
            HAPI_PROVIDER_PROFILE_ID: '55555555-5555-4555-8555-555555555555',
            HAPI_PROVIDER_PROFILE_AGENT: 'codex',
            HAPI_CODEX_PROVIDER_API_KEY: 'codex-key'
        })).toBeUndefined()
    })
})
