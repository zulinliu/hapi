const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com'

const CLEARED_NATIVE_PROVIDER_ENV: Record<string, string> = {
    ANTHROPIC_API_KEY: '',
    ANTHROPIC_AUTH_TOKEN: '',
    CLAUDE_CODE_OAUTH_TOKEN: '',
    ANTHROPIC_CUSTOM_HEADERS: '',
    ANTHROPIC_MODEL: '',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: '',
    ANTHROPIC_DEFAULT_OPUS_MODEL: '',
    ANTHROPIC_DEFAULT_SONNET_MODEL: '',
    CLAUDE_CODE_USE_BEDROCK: '',
    CLAUDE_CODE_USE_VERTEX: '',
    CLAUDE_CODE_USE_FOUNDRY: ''
}

/**
 * Claude Code applies `env` from its settings files after inheriting the
 * parent process environment. A managed provider therefore needs an explicit
 * `--settings` override as well as the process env injected by HAPI.
 */
export function resolveManagedClaudeSettingsEnv(
    env: NodeJS.ProcessEnv = process.env
): Record<string, string> | undefined {
    if (
        !env.HAPI_PROVIDER_PROFILE_ID?.trim()
        || env.HAPI_PROVIDER_PROFILE_AGENT !== 'claude'
    ) return undefined

    const apiKey = env.ANTHROPIC_API_KEY
    const authToken = env.ANTHROPIC_AUTH_TOKEN
    const hasApiKey = typeof apiKey === 'string' && apiKey.length > 0
    const hasAuthToken = typeof authToken === 'string' && authToken.length > 0

    if (!hasApiKey && !hasAuthToken) {
        throw new Error('Managed Claude provider credential is missing')
    }
    if (hasApiKey && hasAuthToken) {
        throw new Error('Managed Claude provider has conflicting credentials')
    }

    return {
        ...CLEARED_NATIVE_PROVIDER_ENV,
        ANTHROPIC_BASE_URL: env.ANTHROPIC_BASE_URL?.trim() || DEFAULT_ANTHROPIC_BASE_URL,
        ...(hasApiKey
            ? { ANTHROPIC_API_KEY: apiKey }
            : { ANTHROPIC_AUTH_TOKEN: authToken! })
    }
}
