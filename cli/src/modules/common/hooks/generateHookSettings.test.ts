import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const testState = vi.hoisted(() => ({
    happyHomeDir: `/tmp/hapi-hook-settings-${process.pid}`,
    alivePids: new Set<number>()
}))

vi.mock('@/configuration', () => ({
    configuration: { happyHomeDir: testState.happyHomeDir }
}))

vi.mock('@/ui/logger', () => ({
    logger: { debug: vi.fn() }
}))

vi.mock('@/utils/spawnHappyCLI', () => ({
    getHappyCliCommand: (args: string[]) => ({ command: '/opt/hapi/hapi', args })
}))

vi.mock('@/utils/process', () => ({
    isProcessAlive: (pid: number) => testState.alivePids.has(pid)
}))

import {
    cleanupHookSettingsFile,
    generateHookSettingsFile,
    generateProviderSettingsFile
} from './generateHookSettings'

describe('generateHookSettingsFile', () => {
    beforeEach(() => {
        rmSync(testState.happyHomeDir, { recursive: true, force: true })
        testState.alivePids.clear()
    })

    afterEach(() => {
        rmSync(testState.happyHomeDir, { recursive: true, force: true })
    })

    it('writes isolated provider env into a private session settings file', () => {
        const filepath = generateHookSettingsFile(1234, 'hook-token', {
            filenamePrefix: 'session-hook',
            logLabel: 'test',
            settingsEnv: {
                ANTHROPIC_API_KEY: 'selected-key',
                ANTHROPIC_AUTH_TOKEN: '',
                ANTHROPIC_BASE_URL: 'https://selected.example'
            }
        })
        const settings = JSON.parse(readFileSync(filepath, 'utf8'))

        expect(settings.env).toEqual({
            ANTHROPIC_API_KEY: 'selected-key',
            ANTHROPIC_AUTH_TOKEN: '',
            ANTHROPIC_BASE_URL: 'https://selected.example'
        })
        expect(settings.hooks.SessionStart).toHaveLength(1)
        if (process.platform !== 'win32') {
            expect(statSync(filepath).mode & 0o777).toBe(0o600)
            expect(statSync(dirname(filepath)).mode & 0o777).toBe(0o700)
        }

        cleanupHookSettingsFile(filepath, 'test')
        expect(() => statSync(filepath)).toThrow()
    })

    it('uses a unique file for concurrent sessions in the same process', () => {
        const first = generateHookSettingsFile(1234, 'first-token', {
            filenamePrefix: 'session-hook',
            logLabel: 'test'
        })
        const second = generateHookSettingsFile(5678, 'second-token', {
            filenamePrefix: 'session-hook',
            logLabel: 'test'
        })

        expect(second).not.toBe(first)
        expect(readFileSync(first, 'utf8')).toContain('first-token')
        expect(readFileSync(second, 'utf8')).toContain('second-token')
    })

    it('creates provider-only settings without session hooks', () => {
        const filepath = generateProviderSettingsFile({ ANTHROPIC_API_KEY: 'selected-key' }, {
            filenamePrefix: 'provider-metadata',
            logLabel: 'test'
        })

        expect(JSON.parse(readFileSync(filepath, 'utf8'))).toEqual({
            env: { ANTHROPIC_API_KEY: 'selected-key' }
        })
    })

    it('removes only settings files owned by dead sessions', () => {
        const hooksDir = join(testState.happyHomeDir, 'tmp', 'hooks')
        mkdirSync(hooksDir, { recursive: true })
        const stale = join(hooksDir, 'session-hook-410001.json')
        const active = join(hooksDir, 'session-hook-410002-deadbeef.json')
        const unrelated = join(hooksDir, 'other-hook-410001.json')
        writeFileSync(stale, '{}')
        writeFileSync(active, '{}')
        writeFileSync(unrelated, '{}')
        testState.alivePids.add(410002)

        generateHookSettingsFile(1234, 'new-token', {
            filenamePrefix: 'session-hook',
            logLabel: 'test'
        })

        expect(existsSync(stale)).toBe(false)
        expect(existsSync(active)).toBe(true)
        expect(existsSync(unrelated)).toBe(true)
    })
})
