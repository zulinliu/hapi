import { afterEach, describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RepositoryManager } from './repositoryManager'
import { WorkspaceScope } from './workspaceScope'

const exec = promisify(execFile)
const created: string[] = []
const context = { signal: new AbortController().signal, report: () => {} }

afterEach(async () => {
    await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('RepositoryManager', () => {
    it('inspects, stages, commits, and changes remotes through structured operations', async () => {
        const root = await mkdtemp(join(tmpdir(), 'hapi-git-'))
        created.push(root)
        await exec('git', ['init'], { cwd: root })
        await exec('git', ['config', 'user.name', 'HAPI Test'], { cwd: root })
        await exec('git', ['config', 'user.email', 'hapi@example.com'], { cwd: root })
        await writeFile(join(root, 'a.txt'), 'hello')
        const manager = new RepositoryManager(await WorkspaceScope.create([root]), { preferencePath: join(root, '.hapi-git-preferences.json') })

        expect((await manager.inspect(root)).changes).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'a.txt' })]))
        await manager.execute({ kind: 'stage', repository: root, paths: ['a.txt'] }, context)
        await manager.execute({ kind: 'commit', repository: root, message: 'test commit' }, context)
        expect((await manager.inspect(root)).changes).toEqual([])

        await manager.execute({ kind: 'set-remote', repository: root, remote: 'origin', url: 'https://github.com/example/repo.git' }, context)
        expect((await manager.inspect(root)).remotes[0]).toMatchObject({ name: 'origin', fetchUrl: 'https://github.com/example/repo.git' })
        await manager.execute({ kind: 'set-commit-template', repository: root, template: 'custom' }, context)
        expect((await manager.inspect(root)).commitTemplate).toBe('custom')
    }, 20_000)

    it('rejects inline credentials in remote URLs', async () => {
        const root = await mkdtemp(join(tmpdir(), 'hapi-git-secret-'))
        created.push(root)
        await exec('git', ['init'], { cwd: root })
        const manager = new RepositoryManager(await WorkspaceScope.create([root]))
        await expect(manager.execute({ kind: 'set-remote', repository: root, remote: 'origin', url: 'https://user:secret@example.com/repo.git' }, context)).rejects.toThrow(/inline credentials/)
        await expect(manager.execute({ kind: 'set-remote', repository: root, remote: 'origin', url: 'https://secret@example.com/repo.git' }, context)).rejects.toThrow(/inline credentials/)
        await expect(manager.execute({ kind: 'set-remote', repository: root, remote: 'origin', url: 'https://example.com/repo.git?access_token=secret' }, context)).rejects.toThrow(/inline credentials/)
    })

    it('unstages files before the repository has its first commit', async () => {
        const root = await mkdtemp(join(tmpdir(), 'hapi-git-unborn-'))
        created.push(root)
        await exec('git', ['init'], { cwd: root })
        await writeFile(join(root, 'first.txt'), 'first')
        const manager = new RepositoryManager(await WorkspaceScope.create([root]))

        await manager.execute({ kind: 'stage', repository: root, paths: ['first.txt'] }, context)
        expect((await manager.inspect(root)).changes[0]).toMatchObject({ path: 'first.txt', indexStatus: 'A' })
        await manager.execute({ kind: 'unstage', repository: root, paths: ['first.txt'] }, context)
        expect((await manager.inspect(root)).changes[0]).toMatchObject({ path: 'first.txt', indexStatus: '?' })
    })

    it('clones non-GitHub sources through the Git fallback', async () => {
        const root = await mkdtemp(join(tmpdir(), 'hapi-git-clone-'))
        created.push(root)
        const source = join(root, 'source.git')
        const destination = join(root, 'clone')
        await exec('git', ['init', '--bare', source])
        const manager = new RepositoryManager(await WorkspaceScope.create([root]))

        const result = await manager.execute({ kind: 'clone', source, destination }, context)

        expect(result).toMatchObject({ repository: destination, tool: 'git' })
        expect((await manager.inspect(destination)).repositoryRoot).toBe(destination)
    }, 20_000)

    it.skipIf(process.platform === 'win32')('prefers an authenticated gh command for GitHub clones', async () => {
        const root = await mkdtemp(join(tmpdir(), 'hapi-gh-clone-'))
        created.push(root)
        const bin = join(root, 'bin')
        const log = join(root, 'gh.log')
        const destination = join(root, 'clone')
        await mkdir(bin)
        const gh = join(bin, 'gh')
        await writeFile(gh, `#!/bin/sh\nif [ "$1" = "--version" ] || [ "$1" = "auth" ]; then exit 0; fi\nprintf '%s\\n' "$@" > "${log}"\nmkdir -p "$4"\n`)
        await chmod(gh, 0o755)
        const originalPath = process.env.PATH
        process.env.PATH = `${bin}:${originalPath ?? ''}`
        try {
            const manager = new RepositoryManager(await WorkspaceScope.create([root]))
            const result = await manager.execute({ kind: 'clone', source: 'owner/repository', destination }, context)
            expect(result).toMatchObject({ repository: destination, tool: 'gh' })
            expect(await readFile(log, 'utf8')).toContain('owner/repository')
        } finally {
            process.env.PATH = originalPath
        }
    })

    it('refreshes and safely manages local and remote branches', async () => {
        const root = await mkdtemp(join(tmpdir(), 'hapi-git-branches-'))
        created.push(root)
        const remoteParent = await mkdtemp(join(tmpdir(), 'hapi-git-branches-remote-'))
        created.push(remoteParent)
        const remote = join(remoteParent, 'remote.git')
        await exec('git', ['init', '-b', 'main'], { cwd: root })
        await exec('git', ['config', 'user.name', 'HAPI Test'], { cwd: root })
        await exec('git', ['config', 'user.email', 'hapi@example.com'], { cwd: root })
        await writeFile(join(root, 'README.md'), 'seed')
        await exec('git', ['add', 'README.md'], { cwd: root })
        await exec('git', ['commit', '-m', 'seed'], { cwd: root })
        await exec('git', ['init', '--bare', remote])
        await exec('git', ['remote', 'add', 'origin', remote], { cwd: root })
        await exec('git', ['push', '-u', 'origin', 'main'], { cwd: root })
        const manager = new RepositoryManager(await WorkspaceScope.create([root]))

        await manager.execute({ kind: 'fetch', repository: root, remote: 'origin' }, context)
        await manager.execute({ kind: 'create-branch', repository: root, name: 'feature/provider', switchTo: true }, context)
        expect((await manager.inspect(root)).branch).toBe('feature/provider')
        expect((await manager.inspect(root)).branches).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'feature/provider', current: true })
        ]))

        await writeFile(join(root, 'dirty.txt'), 'dirty')
        await expect(manager.execute({ kind: 'switch-branch', repository: root, name: 'main' }, context)).rejects.toThrow(/uncommitted changes/i)
        await rm(join(root, 'dirty.txt'))
        await manager.execute({ kind: 'switch-branch', repository: root, name: 'main' }, context)
        await manager.execute({ kind: 'delete-branch', repository: root, name: 'feature/provider', force: false }, context)

        await manager.execute({ kind: 'create-branch', repository: root, name: 'feature/remote', switchTo: false }, context)
        await exec('git', ['push', 'origin', 'feature/remote'], { cwd: root })
        await manager.execute({ kind: 'delete-remote-branch', repository: root, remote: 'origin', name: 'feature/remote' }, context)
        const remoteBranches = await exec('git', ['ls-remote', '--heads', 'origin', 'feature/remote'], { cwd: root })
        expect(remoteBranches.stdout).toBe('')
    }, 30_000)
})
