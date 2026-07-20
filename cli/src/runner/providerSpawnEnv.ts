type RunnerSessionEnvOptions = {
    parentEnv: NodeJS.ProcessEnv
    extraEnv: Record<string, string>
    managedProvider: boolean
    agent: string
}

function suppress(env: NodeJS.ProcessEnv, ...keys: string[]): void {
    // spawnHappyCLI merges its env with process.env. An explicit undefined
    // value is therefore required to suppress an inherited key in the child;
    // deleting it here would allow the merge to reintroduce the parent value.
    for (const key of keys) env[key] = undefined
}

export function buildRunnerSessionEnv(options: RunnerSessionEnvOptions): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...options.parentEnv }
    suppress(
        env,
        'HAPI_PROVIDER_PROFILE_ID',
        'HAPI_PROVIDER_PROFILE_NAME',
        'HAPI_PROVIDER_PROFILE_REVISION',
        'HAPI_PROVIDER_PROFILE_SYSTEM',
        'HAPI_PROVIDER_PROFILE_AGENT',
        'HAPI_CODEX_PROVIDER_API_KEY',
        'HAPI_CODEX_PROVIDER_ARGS'
    )

    if (options.managedProvider && options.agent === 'claude') {
        suppress(
            env,
            'CLAUDE_CODE_OAUTH_TOKEN',
            'ANTHROPIC_API_KEY',
            'ANTHROPIC_AUTH_TOKEN',
            'ANTHROPIC_BASE_URL'
        )
    } else if (options.managedProvider && options.agent === 'codex') {
        suppress(env, 'OPENAI_API_KEY')
    } else if (options.managedProvider && options.agent === 'grok') {
        suppress(env, 'XAI_API_KEY', 'XAI_BASE_URL')
    }

    return { ...env, ...options.extraEnv }
}
