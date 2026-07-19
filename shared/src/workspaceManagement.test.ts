import { describe, expect, it } from 'vitest'
import { FileOperationSchema, GitOperationSchema } from './workspaceManagement'

describe('workspace management schemas', () => {
    it('accepts copy conflict policies and Git branch lifecycle operations', () => {
        expect(FileOperationSchema.safeParse({
            kind: 'copy',
            sources: ['/workspace/a.txt'],
            destination: '/workspace/destination',
            conflict: 'new-copy',
            createDestination: true
        }).success).toBe(true)
        expect(GitOperationSchema.safeParse({
            kind: 'create-branch',
            repository: '/workspace/repository',
            name: 'feature/workspace-controls',
            startPoint: 'origin/main',
            switchTo: true
        }).success).toBe(true)
        expect(GitOperationSchema.safeParse({
            kind: 'delete-remote-branch',
            repository: '/workspace/repository',
            remote: 'origin',
            name: 'feature/workspace-controls'
        }).success).toBe(true)
    })
})
