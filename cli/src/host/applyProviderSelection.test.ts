import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyProviderSelection } from './applyProviderSelection'

const systemAgents = [
    { agent: 'claude' as const, credential: 'ANTHROPIC_API_KEY' },
    { agent: 'codex' as const, credential: 'OPENAI_API_KEY' },
    { agent: 'grok' as const, credential: 'XAI_API_KEY' }
]

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('applyProviderSelection', () => {
    for (const { agent, credential } of systemAgents) {
        it(`preserves native ${agent} credentials for an explicit system selection`, async () => {
            vi.stubEnv(credential, 'native-credential')
            vi.stubEnv('HAPI_PROVIDER_PROFILE_ID', '11111111-1111-4111-8111-111111111111')
            vi.stubEnv('HAPI_PROVIDER_PROFILE_NAME', 'Managed profile')
            vi.stubEnv('HAPI_PROVIDER_PROFILE_REVISION', '1')
            vi.stubEnv('HAPI_PROVIDER_PROFILE_AGENT', agent)

            const launch = await applyProviderSelection(agent, null)

            expect(launch).toBeNull()
            expect(process.env[credential]).toBe('native-credential')
            expect(process.env.HAPI_PROVIDER_PROFILE_SYSTEM).toBe('1')
            expect(process.env.HAPI_PROVIDER_PROFILE_AGENT).toBe(agent)
            expect(process.env.HAPI_PROVIDER_PROFILE_ID).toBeUndefined()
            expect(process.env.HAPI_PROVIDER_PROFILE_NAME).toBeUndefined()
            expect(process.env.HAPI_PROVIDER_PROFILE_REVISION).toBeUndefined()
        })
    }

    it('does not reuse managed provider metadata inherited from another agent', async () => {
        vi.stubEnv('HAPI_PROVIDER_PROFILE_ID', '11111111-1111-4111-8111-111111111111')
        vi.stubEnv('HAPI_PROVIDER_PROFILE_NAME', 'Codex profile')
        vi.stubEnv('HAPI_PROVIDER_PROFILE_REVISION', '1')
        vi.stubEnv('HAPI_PROVIDER_PROFILE_AGENT', 'codex')

        const launch = await applyProviderSelection('claude')

        expect(launch).toBeNull()
        expect(process.env.HAPI_PROVIDER_PROFILE_ID).toBeUndefined()
        expect(process.env.HAPI_PROVIDER_PROFILE_AGENT).toBeUndefined()
    })
})
