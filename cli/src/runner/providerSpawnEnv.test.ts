import { describe, expect, it } from 'vitest'
import { buildRunnerSessionEnv } from './providerSpawnEnv'

describe('buildRunnerSessionEnv', () => {
    it('suppresses inherited provider metadata when spawning another agent', () => {
        const env = buildRunnerSessionEnv({
            parentEnv: {
                PATH: '/bin',
                HAPI_PROVIDER_PROFILE_ID: 'codex-profile',
                HAPI_PROVIDER_PROFILE_AGENT: 'codex',
                HAPI_CODEX_PROVIDER_API_KEY: 'codex-secret'
            },
            extraEnv: {},
            managedProvider: false,
            agent: 'claude'
        })

        expect(env.PATH).toBe('/bin')
        expect(env.HAPI_PROVIDER_PROFILE_ID).toBeUndefined()
        expect(env.HAPI_PROVIDER_PROFILE_AGENT).toBeUndefined()
        expect(env.HAPI_CODEX_PROVIDER_API_KEY).toBeUndefined()
    })

    it('replaces native Claude credentials with the selected managed profile', () => {
        const env = buildRunnerSessionEnv({
            parentEnv: {
                ANTHROPIC_AUTH_TOKEN: 'native-token',
                ANTHROPIC_BASE_URL: 'https://native.example'
            },
            extraEnv: {
                HAPI_PROVIDER_PROFILE_ID: 'claude-profile',
                HAPI_PROVIDER_PROFILE_AGENT: 'claude',
                ANTHROPIC_API_KEY: 'managed-key',
                ANTHROPIC_BASE_URL: 'https://managed.example'
            },
            managedProvider: true,
            agent: 'claude'
        })

        expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
        expect(env.ANTHROPIC_API_KEY).toBe('managed-key')
        expect(env.ANTHROPIC_BASE_URL).toBe('https://managed.example')
        expect(env.HAPI_PROVIDER_PROFILE_AGENT).toBe('claude')
    })

    it('preserves native credentials for an explicit system selection', () => {
        const env = buildRunnerSessionEnv({
            parentEnv: {
                ANTHROPIC_AUTH_TOKEN: 'native-token',
                ANTHROPIC_BASE_URL: 'https://native.example',
                HAPI_PROVIDER_PROFILE_ID: 'stale-profile'
            },
            extraEnv: {
                HAPI_PROVIDER_PROFILE_SYSTEM: '1',
                HAPI_PROVIDER_PROFILE_AGENT: 'claude'
            },
            managedProvider: false,
            agent: 'claude'
        })

        expect(env.ANTHROPIC_AUTH_TOKEN).toBe('native-token')
        expect(env.ANTHROPIC_BASE_URL).toBe('https://native.example')
        expect(env.HAPI_PROVIDER_PROFILE_ID).toBeUndefined()
        expect(env.HAPI_PROVIDER_PROFILE_SYSTEM).toBe('1')
        expect(env.HAPI_PROVIDER_PROFILE_AGENT).toBe('claude')
    })
})
