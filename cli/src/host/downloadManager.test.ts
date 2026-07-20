import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, symlink, truncate, writeFile } from 'node:fs/promises'
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
        await manager.release(download.id)
    })

    it('fails when a prepared file shrinks before its next chunk', async () => {
        const root = await mkdtemp(join(tmpdir(), 'hapi-download-shrink-'))
        created.push(root)
        const file = join(root, 'notes.txt')
        await writeFile(file, 'download content')
        const manager = new DownloadManager(await WorkspaceScope.create([root]))

        const download = await manager.prepare(file)
        await truncate(file, 0)

        await expect(manager.readChunk(download.id, 0)).resolves.toEqual({
            success: false,
            error: 'Download changed while being read'
        })
        await manager.release(download.id)
    })

    it.skipIf(process.platform === 'win32')('keeps prepared downloads bound to the validated file', async () => {
        const root = await mkdtemp(join(tmpdir(), 'hapi-download-retarget-'))
        const outside = await mkdtemp(join(tmpdir(), 'hapi-download-retarget-outside-'))
        created.push(root, outside)
        const file = join(root, 'notes.txt')
        const secret = join(outside, 'secret.txt')
        await writeFile(file, 'workspace content')
        await writeFile(secret, 'outside secret')
        const manager = new DownloadManager(await WorkspaceScope.create([root]))

        const download = await manager.prepare(file)
        await rm(file)
        await symlink(secret, file)
        const chunk = await manager.readChunk(download.id, 0)

        expect(Buffer.from(chunk.base64!, 'base64').toString('utf8')).toBe('workspace content')
        await manager.release(download.id)
    })

    it('archives a directory before serving it', async () => {
        const root = await mkdtemp(join(tmpdir(), 'hapi-download-dir-'))
        created.push(root)
        const folder = join(root, 'project')
        await mkdir(folder)
        await writeFile(join(folder, 'README.md'), 'archive me')
        const gitDirectory = join(folder, '.git')
        await mkdir(gitDirectory)
        await writeFile(join(gitDirectory, 'config'), '[remote "origin"]')
        const manager = new DownloadManager(await WorkspaceScope.create([root]))

        const download = await manager.prepare(folder)
        const chunk = await manager.readChunk(download.id, 0)
        const archive = Buffer.from(chunk.base64!, 'base64')

        expect(download).toMatchObject({ name: 'project.zip', mimeType: 'application/zip', archive: true })
        expect(archive.subarray(0, 4).toString('hex')).toBe('504b0304')
        expect(archive.includes(Buffer.from('project/README.md'))).toBe(true)
        expect(archive.includes(Buffer.from('project/.git/config'))).toBe(false)
        await expect(manager.prepare(gitDirectory)).rejects.toThrow(/Git metadata/)
        await manager.release(download.id)
    })
})
