import { readFile, stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
    cleanupHookSettingsFile,
    generateHookSettingsFile,
    generateProviderSettingsFile
} from './generateHookSettings'

const created: string[] = []

afterEach(() => {
    for (const path of created.splice(0)) {
        cleanupHookSettingsFile(path, 'generateHookSettings.test')
    }
})

describe('generateHookSettingsFile', () => {
    it('merges managed provider overrides into private Claude settings', async () => {
        const path = generateHookSettingsFile(1234, 'hook-token', {
            filenamePrefix: `provider-test-${randomUUID()}`,
            logLabel: 'generateHookSettings.test',
            settingsEnv: {
                ANTHROPIC_API_KEY: 'managed-key',
                ANTHROPIC_AUTH_TOKEN: '',
                ANTHROPIC_BASE_URL: 'https://managed.example'
            }
        })
        created.push(path)

        const settings = JSON.parse(await readFile(path, 'utf8'))
        expect(settings.env).toEqual({
            ANTHROPIC_API_KEY: 'managed-key',
            ANTHROPIC_AUTH_TOKEN: '',
            ANTHROPIC_BASE_URL: 'https://managed.example'
        })
        expect(settings.hooks.SessionStart).toHaveLength(1)
        if (process.platform !== 'win32') {
            expect((await stat(path)).mode & 0o777).toBe(0o600)
            expect((await stat(dirname(path))).mode & 0o777).toBe(0o700)
        }
    })

    it('creates provider-only settings for metadata extraction without session hooks', async () => {
        const path = generateProviderSettingsFile({ ANTHROPIC_API_KEY: 'managed-key' }, {
            filenamePrefix: `provider-metadata-test-${randomUUID()}`,
            logLabel: 'generateHookSettings.test'
        })
        created.push(path)

        const settings = JSON.parse(await readFile(path, 'utf8'))
        expect(settings).toEqual({ env: { ANTHROPIC_API_KEY: 'managed-key' } })
        if (process.platform !== 'win32') {
            expect((await stat(path)).mode & 0o777).toBe(0o600)
        }
    })
})
