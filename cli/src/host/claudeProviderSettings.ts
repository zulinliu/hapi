import { parseProviderModelReference } from '@hapi/protocol'

const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com'

/**
 * Claude Code gives settings files precedence over the process environment.
 * Mirror a managed profile into HAPI's per-session settings file so user-level
 * provider settings cannot redirect the session or replace its credentials.
 */
export function buildManagedClaudeSettingsEnv(
    env: NodeJS.ProcessEnv,
    model?: string | null
): Record<string, string> | undefined {
    if (
        !env.HAPI_PROVIDER_PROFILE_ID?.trim()
        || env.HAPI_PROVIDER_PROFILE_AGENT !== 'claude'
    ) {
        return undefined
    }

    const apiKey = env.ANTHROPIC_API_KEY
    const authToken = env.ANTHROPIC_AUTH_TOKEN
    if (!apiKey && !authToken) {
        throw new Error('Managed Claude provider credentials are missing')
    }
    if (apiKey && authToken) {
        throw new Error('Managed Claude provider has multiple credentials')
    }
    const wireModel = model ? parseProviderModelReference(model).id : ''

    return {
        ANTHROPIC_API_KEY: apiKey ?? '',
        ANTHROPIC_AUTH_TOKEN: authToken ?? '',
        ANTHROPIC_BASE_URL: env.ANTHROPIC_BASE_URL?.trim() || DEFAULT_ANTHROPIC_BASE_URL,
        ANTHROPIC_CUSTOM_HEADERS: '',
        ANTHROPIC_MODEL: wireModel,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: wireModel,
        ANTHROPIC_DEFAULT_OPUS_MODEL: wireModel,
        ANTHROPIC_DEFAULT_SONNET_MODEL: wireModel,
        CLAUDE_CODE_OAUTH_TOKEN: ''
    }
}
