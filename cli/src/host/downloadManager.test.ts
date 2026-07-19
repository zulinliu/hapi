import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DownloadManager } from './downloadManager'
import { WorkspaceScope } from './workspaceScope'

const created: string[] = []

afterEach(async () => {
    await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('DownloadManager', () => {
    it('serves a workspace file through bounded chunks', async () => {
        const root = await mkdtemp(join(tmpdir(), 'hapi-download-'))
        created.push(root)
        const file = join(root, 'notes.txt')
        await writeFile(file, 'chunked file content')
        const manager = new DownloadManager(await WorkspaceScope.create([root]))

        const download = await manager.prepare(file)
        const first = await manager.readChunk(download.id, 0)

        expect(download).toMatchObject({ name: 'notes.txt', archive: false })
        expect(Buffer.from(first.base64!, 'base64').toString('utf8')).toBe('chunked file content')
        expect(first.done).toBe(true)
    })

    it('archives a directory before serving it', async () => {
        const root = await mkdtemp(join(tmpdir(), 'hapi-download-dir-'))
        created.push(root)
        const folder = join(root, 'project')
        await mkdir(folder)
        await writeFile(join(folder, 'README.md'), 'archive me')
        const manager = new DownloadManager(await WorkspaceScope.create([root]))

        const download = await manager.prepare(folder)
        const chunk = await manager.readChunk(download.id, 0)

        expect(download).toMatchObject({ name: 'project.tar.gz', archive: true })
        expect(Buffer.from(chunk.base64!, 'base64').subarray(0, 2).toString('hex')).toBe('1f8b')
    })
})
