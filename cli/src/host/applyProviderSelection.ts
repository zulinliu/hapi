import type { AgentProvider } from '@hapi/protocol'
import { ProviderRegistry } from './providerRegistry'
import { resolveProviderLaunch, type AgentLaunchConfiguration } from './providerAdapters'

function clearConflictingCredentials(agent: AgentProvider): void {
    if (agent === 'claude') {
        delete process.env.CLAUDE_CODE_OAUTH_TOKEN
        delete process.env.ANTHROPIC_API_KEY
        delete process.env.ANTHROPIC_AUTH_TOKEN
        delete process.env.ANTHROPIC_BASE_URL
    } else if (agent === 'codex') {
        delete process.env.OPENAI_API_KEY
        delete process.env.HAPI_CODEX_PROVIDER_API_KEY
        delete process.env.HAPI_CODEX_PROVIDER_ARGS
    } else if (agent === 'grok') {
        delete process.env.XAI_API_KEY
        delete process.env.XAI_BASE_URL
    }
}

function clearProviderMetadata(): void {
    delete process.env.HAPI_PROVIDER_PROFILE_ID
    delete process.env.HAPI_PROVIDER_PROFILE_NAME
    delete process.env.HAPI_PROVIDER_PROFILE_REVISION
    delete process.env.HAPI_PROVIDER_PROFILE_SYSTEM
    delete process.env.HAPI_PROVIDER_PROFILE_AGENT
    delete process.env.HAPI_CODEX_PROVIDER_ARGS
    delete process.env.HAPI_CODEX_PROVIDER_API_KEY
}

export async function applyProviderSelection(
    agent: AgentProvider,
    requestedId?: string | null
): Promise<AgentLaunchConfiguration | null> {
    if (requestedId !== undefined) {
        clearProviderMetadata()
        if (requestedId === null) {
            process.env.HAPI_PROVIDER_PROFILE_SYSTEM = '1'
            process.env.HAPI_PROVIDER_PROFILE_AGENT = agent
            return null
        }
    } else if (
        process.env.HAPI_PROVIDER_PROFILE_AGENT === agent
        && process.env.HAPI_PROVIDER_PROFILE_SYSTEM === '1'
    ) {
        clearProviderMetadata()
        process.env.HAPI_PROVIDER_PROFILE_SYSTEM = '1'
        process.env.HAPI_PROVIDER_PROFILE_AGENT = agent
        return null
    } else if (
        process.env.HAPI_PROVIDER_PROFILE_AGENT === agent
        && process.env.HAPI_PROVIDER_PROFILE_ID
    ) {
        return null
    } else if (
        process.env.HAPI_PROVIDER_PROFILE_ID
        || process.env.HAPI_PROVIDER_PROFILE_SYSTEM === '1'
        || process.env.HAPI_PROVIDER_PROFILE_AGENT
    ) {
        clearProviderMetadata()
    }

    const profile = await new ProviderRegistry().resolve(agent, requestedId)
    if (!profile) {
        return null
    }

    const launch = resolveProviderLaunch(agent, profile)
    clearProviderMetadata()
    clearConflictingCredentials(agent)
    Object.assign(process.env, launch.env, {
        HAPI_PROVIDER_PROFILE_ID: launch.profile.id,
        HAPI_PROVIDER_PROFILE_NAME: launch.profile.name,
        HAPI_PROVIDER_PROFILE_REVISION: String(launch.profile.revision),
        HAPI_PROVIDER_PROFILE_AGENT: agent
    })
    if (agent === 'codex' && launch.args.length > 0) {
        process.env.HAPI_CODEX_PROVIDER_ARGS = JSON.stringify(launch.args)
    }
    return launch
}
