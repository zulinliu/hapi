import { beforeEach, describe, expect, it, vi } from 'vitest'

const queryMock = vi.fn()

vi.mock('./query', () => ({ query: queryMock }))

describe('extractSDKMetadata', () => {
    beforeEach(() => {
        queryMock.mockReset()
    })

    it('uses the same high-priority settings as the managed Claude session', async () => {
        queryMock.mockReturnValue((async function* () {
            yield {
                type: 'system',
                subtype: 'init',
                tools: ['Read'],
                slash_commands: ['/compact']
            }
        })())
        const { extractSDKMetadata } = await import('./metadataExtractor')

        await extractSDKMetadata({ settingsPath: '/tmp/managed-provider-settings.json' })

        expect(queryMock).toHaveBeenCalledWith(expect.objectContaining({
            options: expect.objectContaining({
                settingsPath: '/tmp/managed-provider-settings.json'
            })
        }))
    })
})
