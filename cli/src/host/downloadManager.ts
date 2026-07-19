import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, open, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join } from 'node:path'
import { promisify } from 'node:util'
import type { HostDownloadChunkResponse, HostDownloadDescriptor } from '@hapi/protocol'
import { WorkspaceScope } from './workspaceScope'

const execFileAsync = promisify(execFile)
const CHUNK_BYTES = 256 * 1024
const MAX_DOWNLOAD_BYTES = 256 * 1024 * 1024
const MAX_ARCHIVE_FILES = 20_000
const DOWNLOAD_TTL_MS = 15 * 60 * 1000

type PreparedDownload = HostDownloadDescriptor & {
    path: string
    tempDirectory?: string
    timer: ReturnType<typeof setTimeout>
}

function mimeType(path: string): string {
    if (path.endsWith('.tar.gz')) return 'application/gzip'
    const extension = extname(path).toLowerCase()
    if (extension === '.json') return 'application/json'
    if (extension === '.md' || extension === '.txt') return 'text/plain'
    if (extension === '.png') return 'image/png'
    if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
    return 'application/octet-stream'
}

async function directorySize(path: string): Promise<{ bytes: number; files: number }> {
    let bytes = 0
    let files = 0
    const visit = async (current: string): Promise<void> => {
        const entries = await readdir(current, { withFileTypes: true })
        for (const entry of entries) {
            const child = join(current, entry.name)
            const info = await stat(child)
            if (entry.isDirectory()) {
                await visit(child)
                continue
            }
            if (!entry.isFile()) throw new Error('Directories containing symlinks or special files cannot be downloaded')
            files += 1
            bytes += info.size
            if (files > MAX_ARCHIVE_FILES) throw new Error(`Directory contains more than ${MAX_ARCHIVE_FILES} files`)
            if (bytes > MAX_DOWNLOAD_BYTES) throw new Error(`Download exceeds the ${MAX_DOWNLOAD_BYTES / 1024 / 1024} MiB limit`)
        }
    }
    await visit(path)
    return { bytes, files }
}

export class DownloadManager {
    private readonly downloads = new Map<string, PreparedDownload>()
    private archiving = false

    constructor(private readonly scope: WorkspaceScope) {}

    async prepare(rawPath: string): Promise<HostDownloadDescriptor> {
        const path = await this.scope.resolveReadable(rawPath)
        const info = await stat(path)
        const id = randomUUID()
        if (info.isFile()) {
            if (info.size > MAX_DOWNLOAD_BYTES) throw new Error(`Download exceeds the ${MAX_DOWNLOAD_BYTES / 1024 / 1024} MiB limit`)
            return this.register({ id, name: basename(path), mimeType: mimeType(path), size: info.size, archive: false }, path)
        }
        if (!info.isDirectory()) throw new Error('Only files and directories can be downloaded')
        if (this.archiving) throw new Error('Another directory archive is already being prepared')
        this.archiving = true
        try {
            await directorySize(path)
            const tempDirectory = await mkdtemp(join(tmpdir(), 'hapi-download-'))
            const archivePath = join(tempDirectory, `${basename(path)}.tar.gz`)
            await execFileAsync('tar', ['-czf', archivePath, '-C', dirname(path), basename(path)], {
                timeout: 5 * 60_000,
                maxBuffer: 1024 * 1024
            })
            const archiveInfo = await stat(archivePath)
            if (archiveInfo.size > MAX_DOWNLOAD_BYTES) {
                await rm(tempDirectory, { recursive: true, force: true })
                throw new Error(`Archive exceeds the ${MAX_DOWNLOAD_BYTES / 1024 / 1024} MiB limit`)
            }
            return this.register({
                id,
                name: `${basename(path)}.tar.gz`,
                mimeType: 'application/gzip',
                size: archiveInfo.size,
                archive: true
            }, archivePath, tempDirectory)
        } finally {
            this.archiving = false
        }
    }

    async readChunk(id: string, offset: number): Promise<HostDownloadChunkResponse> {
        const download = this.downloads.get(id)
        if (!download) return { success: false, error: 'Download is no longer available' }
        if (offset > download.size) return { success: false, error: 'Invalid download offset' }
        const remaining = download.size - offset
        if (remaining === 0) return { success: true, base64: '', nextOffset: offset, done: true }
        const handle = await open(download.path, 'r')
        try {
            const bytes = Math.min(CHUNK_BYTES, remaining)
            const buffer = Buffer.allocUnsafe(bytes)
            const { bytesRead } = await handle.read(buffer, 0, bytes, offset)
            const nextOffset = offset + bytesRead
            return {
                success: true,
                base64: buffer.subarray(0, bytesRead).toString('base64'),
                nextOffset,
                done: nextOffset >= download.size
            }
        } finally {
            await handle.close()
        }
    }

    async release(id: string): Promise<void> {
        const download = this.downloads.get(id)
        if (!download) return
        this.downloads.delete(id)
        clearTimeout(download.timer)
        if (download.tempDirectory) await rm(download.tempDirectory, { recursive: true, force: true })
    }

    private register(descriptor: Omit<HostDownloadDescriptor, 'id'> & { id: string }, path: string, tempDirectory?: string): HostDownloadDescriptor {
        const timer = setTimeout(() => { void this.release(descriptor.id) }, DOWNLOAD_TTL_MS)
        timer.unref()
        this.downloads.set(descriptor.id, { ...descriptor, path, tempDirectory, timer })
        return descriptor
    }
}
