import { z } from 'zod'

export const HostEntryTypeSchema = z.enum(['file', 'directory', 'symlink', 'other'])
export type HostEntryType = z.infer<typeof HostEntryTypeSchema>

export const HostFileEntrySchema = z.object({
    name: z.string(),
    path: z.string(),
    type: HostEntryTypeSchema,
    size: z.number().int().nonnegative().optional(),
    modified: z.number().int().nonnegative().optional(),
    hidden: z.boolean(),
    isGitRepo: z.boolean().optional()
})
export type HostFileEntry = z.infer<typeof HostFileEntrySchema>

export const HostListDirectoryRequestSchema = z.object({
    path: z.string().trim().min(1),
    includeHidden: z.boolean().optional().default(false)
})
export type HostListDirectoryRequest = z.infer<typeof HostListDirectoryRequestSchema>

export const HostListDirectoryResponseSchema = z.object({
    success: z.boolean(),
    path: z.string().optional(),
    entries: z.array(HostFileEntrySchema).optional(),
    error: z.string().optional()
})
export type HostListDirectoryResponse = z.infer<typeof HostListDirectoryResponseSchema>

export const HostFilePreviewKindSchema = z.enum(['text', 'image', 'binary'])
export type HostFilePreviewKind = z.infer<typeof HostFilePreviewKindSchema>

export const HostFilePreviewRequestSchema = z.object({
    path: z.string().trim().min(1)
})
export type HostFilePreviewRequest = z.infer<typeof HostFilePreviewRequestSchema>

export const HostFilePreviewResponseSchema = z.object({
    success: z.boolean(),
    path: z.string().optional(),
    name: z.string().optional(),
    kind: HostFilePreviewKindSchema.optional(),
    mimeType: z.string().optional(),
    text: z.string().optional(),
    base64: z.string().optional(),
    size: z.number().int().nonnegative().optional(),
    modified: z.number().int().nonnegative().optional(),
    error: z.string().optional()
})
export type HostFilePreviewResponse = z.infer<typeof HostFilePreviewResponseSchema>

export const HostFileWriteRequestSchema = z.object({
    path: z.string().trim().min(1),
    content: z.string().max(2 * 1024 * 1024),
    expectedModified: z.number().int().nonnegative().optional(),
    expectedSize: z.number().int().nonnegative().optional()
})
export type HostFileWriteRequest = z.infer<typeof HostFileWriteRequestSchema>
export const HostFileWriteResponseSchema = HostFilePreviewResponseSchema
export type HostFileWriteResponse = z.infer<typeof HostFileWriteResponseSchema>

export const HostDownloadPrepareRequestSchema = z.object({
    path: z.string().trim().min(1)
})
export type HostDownloadPrepareRequest = z.infer<typeof HostDownloadPrepareRequestSchema>

export const HostDownloadDescriptorSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    mimeType: z.string(),
    size: z.number().int().nonnegative(),
    archive: z.boolean()
})
export type HostDownloadDescriptor = z.infer<typeof HostDownloadDescriptorSchema>

export const HostDownloadPrepareResponseSchema = z.object({
    success: z.boolean(),
    download: HostDownloadDescriptorSchema.optional(),
    error: z.string().optional()
})
export type HostDownloadPrepareResponse = z.infer<typeof HostDownloadPrepareResponseSchema>

export const HostDownloadChunkRequestSchema = z.object({
    id: z.string().uuid(),
    offset: z.number().int().nonnegative()
})
export type HostDownloadChunkRequest = z.infer<typeof HostDownloadChunkRequestSchema>

export const HostDownloadChunkResponseSchema = z.object({
    success: z.boolean(),
    base64: z.string().optional(),
    nextOffset: z.number().int().nonnegative().optional(),
    done: z.boolean().optional(),
    error: z.string().optional()
})
export type HostDownloadChunkResponse = z.infer<typeof HostDownloadChunkResponseSchema>

const HostPathListSchema = z.array(z.string().trim().min(1)).min(1).max(200)
export const HostConflictPolicySchema = z.enum(['fail', 'replace', 'new-copy', 'skip'])

export const FileOperationSchema = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('create-file'),
        path: z.string().trim().min(1),
        content: z.string().optional()
    }),
    z.object({
        kind: z.literal('create-directory'),
        path: z.string().trim().min(1)
    }),
    z.object({
        kind: z.literal('copy'),
        sources: HostPathListSchema,
        destination: z.string().trim().min(1),
        conflict: HostConflictPolicySchema.default('fail'),
        createDestination: z.boolean().default(false)
    }),
    z.object({
        kind: z.literal('move'),
        sources: HostPathListSchema,
        destination: z.string().trim().min(1),
        conflict: HostConflictPolicySchema.default('fail'),
        createDestination: z.boolean().default(false)
    }),
    z.object({
        kind: z.literal('delete'),
        paths: HostPathListSchema
    })
])
export type FileOperation = z.input<typeof FileOperationSchema>
export type ParsedFileOperation = z.output<typeof FileOperationSchema>

export const GitFileChangeSchema = z.object({
    path: z.string(),
    oldPath: z.string().optional(),
    indexStatus: z.string(),
    worktreeStatus: z.string()
})
export type GitFileChange = z.infer<typeof GitFileChangeSchema>

export const GitRemoteSchema = z.object({
    name: z.string(),
    fetchUrl: z.string().optional(),
    pushUrl: z.string().optional()
})
export type GitRemote = z.infer<typeof GitRemoteSchema>

export const GitCapabilitiesSchema = z.object({
    gitAvailable: z.boolean(),
    ghAvailable: z.boolean(),
    ghAuthenticated: z.boolean()
})
export type GitCapabilities = z.infer<typeof GitCapabilitiesSchema>

export const GitBranchSchema = z.object({
    name: z.string(),
    remote: z.string().optional(),
    current: z.boolean().optional(),
    upstream: z.string().optional(),
    merged: z.boolean().optional()
})
export type GitBranch = z.infer<typeof GitBranchSchema>

export const GitCommitTemplateSchema = z.enum(['conventional', 'custom'])
export type GitCommitTemplate = z.infer<typeof GitCommitTemplateSchema>

export const RepositorySnapshotSchema = z.object({
    repositoryRoot: z.string(),
    branch: z.string().nullable(),
    upstream: z.string().nullable(),
    ahead: z.number().int().nonnegative(),
    behind: z.number().int().nonnegative(),
    changes: z.array(GitFileChangeSchema),
    remotes: z.array(GitRemoteSchema),
    branches: z.array(GitBranchSchema).default([]),
    commitTemplate: GitCommitTemplateSchema.default('conventional'),
    capabilities: GitCapabilitiesSchema
})
export type RepositorySnapshot = z.infer<typeof RepositorySnapshotSchema>

export const GitInspectRequestSchema = z.object({
    path: z.string().trim().min(1)
})
export type GitInspectRequest = z.infer<typeof GitInspectRequestSchema>

export const GitInspectResponseSchema = z.object({
    success: z.boolean(),
    repository: RepositorySnapshotSchema.optional(),
    capabilities: GitCapabilitiesSchema.optional(),
    error: z.string().optional()
})
export type GitInspectResponse = z.infer<typeof GitInspectResponseSchema>

const GitPathListSchema = z.array(z.string().min(1)).max(500)
const GitRemoteNameSchema = z.string().trim().regex(/^[A-Za-z0-9._-]+$/)
const GitBranchNameSchema = z.string().trim().min(1).max(255).refine(
    (value) => !value.startsWith('-') && !/[\s~^:?*\\[\\]/.test(value) && !value.includes('..') && !value.endsWith('.'),
    'Invalid branch name'
)
export const GitOperationSchema = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('clone'),
        source: z.string().trim().min(1).max(2048),
        destination: z.string().trim().min(1)
    }),
    z.object({
        kind: z.literal('stage'),
        repository: z.string().trim().min(1),
        paths: GitPathListSchema
    }),
    z.object({
        kind: z.literal('unstage'),
        repository: z.string().trim().min(1),
        paths: GitPathListSchema
    }),
    z.object({
        kind: z.literal('commit'),
        repository: z.string().trim().min(1),
        message: z.string().trim().min(1).max(20_000),
        template: GitCommitTemplateSchema.default('custom')
    }),
    z.object({
        kind: z.literal('set-commit-template'),
        repository: z.string().trim().min(1),
        template: GitCommitTemplateSchema
    }),
    z.object({
        kind: z.literal('push'),
        repository: z.string().trim().min(1),
        remote: GitRemoteNameSchema.default('origin'),
        setUpstream: z.boolean().default(false)
    }),
    z.object({
        kind: z.literal('set-remote'),
        repository: z.string().trim().min(1),
        remote: GitRemoteNameSchema.default('origin'),
        url: z.string().trim().min(1).max(2048)
    }),
    z.object({
        kind: z.literal('fetch'),
        repository: z.string().trim().min(1),
        remote: GitRemoteNameSchema.optional()
    }),
    z.object({
        kind: z.literal('update-current'),
        repository: z.string().trim().min(1)
    }),
    z.object({
        kind: z.literal('switch-branch'),
        repository: z.string().trim().min(1),
        name: GitBranchNameSchema
    }),
    z.object({
        kind: z.literal('create-branch'),
        repository: z.string().trim().min(1),
        name: GitBranchNameSchema,
        startPoint: z.string().trim().min(1).max(512).optional(),
        switchTo: z.boolean().default(true)
    }),
    z.object({
        kind: z.literal('delete-branch'),
        repository: z.string().trim().min(1),
        name: GitBranchNameSchema,
        force: z.boolean().default(false)
    }),
    z.object({
        kind: z.literal('delete-remote-branch'),
        repository: z.string().trim().min(1),
        remote: GitRemoteNameSchema.default('origin'),
        name: GitBranchNameSchema
    })
])
export type GitOperation = z.input<typeof GitOperationSchema>
export type ParsedGitOperation = z.output<typeof GitOperationSchema>

export const HostOperationRequestSchema = z.discriminatedUnion('domain', [
    z.object({ domain: z.literal('file'), operation: FileOperationSchema }),
    z.object({ domain: z.literal('git'), operation: GitOperationSchema })
])
export type HostOperationRequest = z.input<typeof HostOperationRequestSchema>
export type ParsedHostOperationRequest = z.output<typeof HostOperationRequestSchema>

export const HostOperationStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled'])
export type HostOperationStatus = z.infer<typeof HostOperationStatusSchema>

export const HostOperationSnapshotSchema = z.object({
    id: z.string().uuid(),
    domain: z.enum(['file', 'git']),
    kind: z.string(),
    status: HostOperationStatusSchema,
    progress: z.number().min(0).max(1),
    message: z.string().optional(),
    result: z.record(z.string(), z.unknown()).optional(),
    error: z.string().optional(),
    createdAt: z.number().int(),
    startedAt: z.number().int().optional(),
    finishedAt: z.number().int().optional()
})
export type HostOperationSnapshot = z.infer<typeof HostOperationSnapshotSchema>

export const HostOperationStartResponseSchema = z.object({
    success: z.boolean(),
    operation: HostOperationSnapshotSchema.optional(),
    error: z.string().optional()
})
export type HostOperationStartResponse = z.infer<typeof HostOperationStartResponseSchema>

export const HostOperationGetRequestSchema = z.object({ id: z.string().uuid() })
export type HostOperationGetRequest = z.infer<typeof HostOperationGetRequestSchema>

export const HostOperationGetResponseSchema = HostOperationStartResponseSchema
export type HostOperationGetResponse = z.infer<typeof HostOperationGetResponseSchema>

export const AgentProviderSchema = z.enum(['claude', 'codex', 'cursor', 'grok', 'kimi', 'opencode', 'pi'])
export type AgentProvider = z.infer<typeof AgentProviderSchema>

export const ProviderProtocolSchema = z.enum([
    'anthropic-messages',
    'openai-responses',
    'openai-chat-completions',
    'gemini-generative-ai'
])
export type ProviderProtocol = z.infer<typeof ProviderProtocolSchema>

export type ProviderAgentCapability = {
    managed: boolean
    protocols: readonly ProviderProtocol[]
    credentialTypes: readonly ProviderCredentialType[]
    reason?: string
}

export const ProviderCredentialTypeSchema = z.enum(['api-key', 'auth-token'])
export type ProviderCredentialType = z.infer<typeof ProviderCredentialTypeSchema>

export const AGENT_PROVIDER_CAPABILITIES: Record<AgentProvider, ProviderAgentCapability> = {
    claude: {
        managed: true,
        protocols: ['anthropic-messages'],
        credentialTypes: ['api-key', 'auth-token']
    },
    codex: {
        managed: true,
        protocols: ['openai-responses', 'openai-chat-completions'],
        credentialTypes: ['api-key']
    },
    grok: {
        managed: true,
        protocols: ['openai-chat-completions'],
        credentialTypes: ['api-key']
    },
    cursor: {
        managed: false,
        protocols: [],
        credentialTypes: [],
        reason: 'Cursor uses its native login or API key configuration'
    },
    kimi: {
        managed: false,
        protocols: [],
        credentialTypes: [],
        reason: 'Kimi uses its native configuration file'
    },
    opencode: {
        managed: false,
        protocols: [],
        credentialTypes: [],
        reason: 'OpenCode provider configuration will be enabled by a dedicated adapter'
    },
    pi: {
        managed: false,
        protocols: [],
        credentialTypes: [],
        reason: 'Pi provider configuration will be enabled by a dedicated adapter'
    }
}

export function getProviderAgentCapability(agent: AgentProvider): ProviderAgentCapability {
    return AGENT_PROVIDER_CAPABILITIES[agent]
}

export const CodexWireApiSchema = z.enum(['responses', 'chat'])
export type CodexWireApi = z.infer<typeof CodexWireApiSchema>

export const ProviderModelSourceSchema = z.enum(['provider', 'custom'])
export type ProviderModelSource = z.infer<typeof ProviderModelSourceSchema>

export const ProviderModelSchema = z.object({
    id: z.string().trim().min(1).max(200),
    contextWindow: z.union([z.literal(200_000), z.literal(1_000_000)]),
    source: ProviderModelSourceSchema,
    refreshedAt: z.number().int().nonnegative().optional()
})
export type ProviderModel = z.infer<typeof ProviderModelSchema>

export const ProviderHealthStatusSchema = z.enum(['unverified', 'healthy', 'unhealthy'])
export type ProviderHealthStatus = z.infer<typeof ProviderHealthStatusSchema>

export const ProviderHealthSummarySchema = z.object({
    status: ProviderHealthStatusSchema,
    checkedAt: z.number().int().nonnegative().optional(),
    error: z.string().optional()
})
export type ProviderHealthSummary = z.infer<typeof ProviderHealthSummarySchema>

export function parseProviderModelReference(value: string): Pick<ProviderModel, 'id' | 'contextWindow'> {
    const trimmed = value.trim()
    const match = /^(.*?)(?:\s*\[1m\])?$/i.exec(trimmed)
    const id = match?.[1]?.trim() ?? ''
    if (!id) throw new Error('Model id is required')
    return {
        id,
        contextWindow: /\[1m\]\s*$/i.test(trimmed) ? 1_000_000 : 200_000
    }
}

export function formatProviderModelReference(model: Pick<ProviderModel, 'id' | 'contextWindow'>): string {
    return model.contextWindow === 1_000_000 ? `${model.id}[1M]` : model.id
}

const ProviderModelReferenceInputSchema = z.string().trim().min(1).max(220)

function validateProviderInput(value: {
    agent?: AgentProvider
    protocol?: ProviderProtocol | null
    credentialType?: ProviderCredentialType
    baseUrl?: string | null
    codexWireApi?: CodexWireApi | null
    models?: string[] | null
}, context: z.RefinementCtx): void {
    if (value.agent) {
        const capability = getProviderAgentCapability(value.agent)
        if (!capability.managed) {
            context.addIssue({ code: 'custom', path: ['agent'], message: capability.reason ?? 'This agent only supports its native login' })
        }
        if (value.protocol && !capability.protocols.includes(value.protocol)) {
            context.addIssue({ code: 'custom', path: ['protocol'], message: 'This protocol is not supported by the selected agent' })
        }
        if (value.credentialType && !capability.credentialTypes.includes(value.credentialType)) {
            context.addIssue({ code: 'custom', path: ['credentialType'], message: 'This credential type is not supported by the selected agent' })
        }
        if (value.agent === 'claude' && value.codexWireApi !== undefined && value.codexWireApi !== null) {
            context.addIssue({ code: 'custom', path: ['codexWireApi'], message: 'codexWireApi is only valid for Codex profiles' })
        }
    }
    if (value.baseUrl && !/^https?:\/\//i.test(value.baseUrl)) {
        context.addIssue({ code: 'custom', path: ['baseUrl'], message: 'baseUrl must use HTTP or HTTPS' })
    }
    for (const [index, model] of (value.models ?? []).entries()) {
        try {
            parseProviderModelReference(model)
        } catch {
            context.addIssue({ code: 'custom', path: ['models', index], message: 'Invalid model reference' })
        }
    }
}

export const ProviderProfileInputSchema = z.object({
    name: z.string().trim().min(1).max(100),
    agent: AgentProviderSchema,
    protocol: ProviderProtocolSchema,
    baseUrl: z.string().trim().url().optional(),
    credentialType: ProviderCredentialTypeSchema.default('api-key'),
    apiKey: z.string().trim().min(1).max(20_000),
    defaultModel: z.string().trim().min(1).max(200).optional(),
    models: z.array(ProviderModelReferenceInputSchema).max(500).default([]),
    codexWireApi: CodexWireApiSchema.optional(),
    enabled: z.boolean().default(true)
}).superRefine((value, context) => {
    validateProviderInput(value, context)
})
export type ProviderProfileInput = z.input<typeof ProviderProfileInputSchema>

export const ProviderProfileUpdateSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    agent: AgentProviderSchema.optional(),
    protocol: ProviderProtocolSchema.optional(),
    baseUrl: z.string().trim().url().nullable().optional(),
    credentialType: ProviderCredentialTypeSchema.optional(),
    apiKey: z.string().trim().min(1).max(20_000).optional(),
    defaultModel: z.string().trim().min(1).max(200).nullable().optional(),
    models: z.array(ProviderModelReferenceInputSchema).max(500).nullable().optional(),
    codexWireApi: CodexWireApiSchema.nullable().optional(),
    enabled: z.boolean().optional()
}).superRefine((value, context) => {
    if (Object.keys(value).length === 0) {
        context.addIssue({ code: 'custom', message: 'At least one provider field is required' })
    }
    validateProviderInput(value, context)
})
export type ProviderProfileUpdate = z.input<typeof ProviderProfileUpdateSchema>

export const ProviderProfileViewSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    agent: AgentProviderSchema,
    protocol: ProviderProtocolSchema,
    baseUrl: z.string().optional(),
    credentialType: ProviderCredentialTypeSchema,
    defaultModel: z.string().optional(),
    models: z.array(ProviderModelSchema).default([]),
    health: ProviderHealthSummarySchema.default({ status: 'unverified' }),
    codexWireApi: CodexWireApiSchema.optional(),
    enabled: z.boolean(),
    revision: z.number().int().positive(),
    hasSecret: z.boolean(),
    secretHint: z.string().optional(),
    createdAt: z.number().int(),
    updatedAt: z.number().int()
})
export type ProviderProfileView = z.infer<typeof ProviderProfileViewSchema>

export const ProviderListRequestSchema = z.object({ agent: AgentProviderSchema.optional() })
export type ProviderListRequest = z.infer<typeof ProviderListRequestSchema>

const ProviderDefaultsSchema = z.object({
    claude: z.string().uuid().nullable(),
    codex: z.string().uuid().nullable(),
    cursor: z.string().uuid().nullable(),
    grok: z.string().uuid().nullable(),
    kimi: z.string().uuid().nullable(),
    opencode: z.string().uuid().nullable(),
    pi: z.string().uuid().nullable()
})

export const ProviderListResponseSchema = z.object({
    success: z.boolean(),
    profiles: z.array(ProviderProfileViewSchema).optional(),
    defaults: ProviderDefaultsSchema.optional(),
    error: z.string().optional()
})
export type ProviderListResponse = z.infer<typeof ProviderListResponseSchema>

export const ProviderCreateRequestSchema = ProviderProfileInputSchema
export type ProviderCreateRequest = z.infer<typeof ProviderCreateRequestSchema>

export const ProviderUpdateRequestSchema = z.object({
    id: z.string().uuid(),
    patch: ProviderProfileUpdateSchema
})
export type ProviderUpdateRequest = z.infer<typeof ProviderUpdateRequestSchema>

export const ProviderSetDefaultRequestSchema = z.object({
    agent: AgentProviderSchema,
    id: z.string().uuid().nullable()
})
export type ProviderSetDefaultRequest = z.infer<typeof ProviderSetDefaultRequestSchema>

export const ProviderHealthCheckRequestSchema = z.object({
    id: z.string().uuid(),
    refreshModels: z.boolean().default(true)
})
export type ProviderHealthCheckRequest = z.infer<typeof ProviderHealthCheckRequestSchema>

export const ProviderHealthCheckResponseSchema = z.object({
    success: z.boolean(),
    status: ProviderHealthStatusSchema,
    checkedAt: z.number().int().nonnegative(),
    models: z.array(ProviderModelSchema).optional(),
    error: z.string().optional()
})
export type ProviderHealthCheckResponse = z.infer<typeof ProviderHealthCheckResponseSchema>

export const ProviderMutationResponseSchema = z.object({
    success: z.boolean(),
    profile: ProviderProfileViewSchema.optional(),
    error: z.string().optional()
})
export type ProviderMutationResponse = z.infer<typeof ProviderMutationResponseSchema>
