import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { resolveProviderMock } = vi.hoisted(() => ({
    resolveProviderMock: vi.fn()
}))

vi.mock('./providerRegistry', () => ({
    ProviderRegistry: class {
        resolve = resolveProviderMock
    }
}))

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
    beforeEach(() => {
        resolveProviderMock.mockReset()
        resolveProviderMock.mockResolvedValue(null)
        vi.stubEnv('HAPI_PROVIDER_PROFILE_SYSTEM', '')
    })

    for (const { agent, credential } of systemAgents) {
        it(`preserves native ${agent} credentials for an explicit system selection`, async () => {
            vi.stubEnv(credential, 'native-credential')
            vi.stubEnv('HAPI_PROVIDER_PROFILE_ID', '11111111-1111-4111-8111-111111111111')
            vi.stubEnv('HAPI_PROVIDER_PROFILE_AGENT', agent)
            vi.stubEnv('HAPI_PROVIDER_PROFILE_NAME', 'Managed profile')
            vi.stubEnv('HAPI_PROVIDER_PROFILE_REVISION', '1')

            const launch = await applyProviderSelection(agent, null)

            expect(launch).toBeNull()
            expect(process.env[credential]).toBe('native-credential')
            expect(process.env.HAPI_PROVIDER_PROFILE_SYSTEM).toBe('1')
            expect(process.env.HAPI_PROVIDER_PROFILE_ID).toBeUndefined()
            expect(process.env.HAPI_PROVIDER_PROFILE_AGENT).toBeUndefined()
            expect(process.env.HAPI_PROVIDER_PROFILE_NAME).toBeUndefined()
            expect(process.env.HAPI_PROVIDER_PROFILE_REVISION).toBeUndefined()
        })
    }

    it('does not reuse provider metadata inherited from another agent', async () => {
        vi.stubEnv('HAPI_PROVIDER_PROFILE_ID', '11111111-1111-4111-8111-111111111111')
        vi.stubEnv('HAPI_PROVIDER_PROFILE_AGENT', 'codex')
        vi.stubEnv('HAPI_PROVIDER_PROFILE_NAME', 'Codex profile')

        const launch = await applyProviderSelection('claude')

        expect(launch).toBeNull()
        expect(resolveProviderMock).toHaveBeenCalledWith('claude', undefined)
        expect(process.env.HAPI_PROVIDER_PROFILE_ID).toBeUndefined()
        expect(process.env.HAPI_PROVIDER_PROFILE_AGENT).toBeUndefined()
        expect(process.env.HAPI_PROVIDER_PROFILE_NAME).toBeUndefined()
    })
})
