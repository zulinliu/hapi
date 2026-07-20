import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, unlinkSync, existsSync, chmodSync, readdirSync } from 'node:fs';
import { configuration } from '@/configuration';
import { logger } from '@/ui/logger';
import { getHappyCliCommand } from '@/utils/spawnHappyCLI';
import { isProcessAlive } from '@/utils/process';

type HookCommandConfig = {
    matcher: string;
    hooks: Array<{
        type: 'command';
        command: string;
    }>;
};

type ClaudeSettings = {
    env?: Record<string, string>;
    hooksConfig?: {
        enabled?: boolean;
    };
    hooks?: {
        SessionStart: HookCommandConfig[];
    };
};

export type SettingsFileOptions = {
    filenamePrefix: string;
    logLabel: string;
};

export type HookSettingsOptions = SettingsFileOptions & {
    hooksEnabled?: boolean;
    settingsEnv?: Record<string, string>;
};

function shellQuote(value: string): string {
    if (value.length === 0) {
        return '""';
    }

    if (/^[A-Za-z0-9_\/:=-]+$/.test(value)) {
        return value;
    }

    return '"' + value.replace(/(["\\$`])/g, '\\$1') + '"';
}

function shellJoin(parts: string[]): string {
    return parts.map(shellQuote).join(' ');
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanupStaleSettingsFiles(hooksDir: string, filenamePrefix: string): void {
    const pattern = new RegExp(`^${escapeRegExp(filenamePrefix)}-(\\d+)(?:-[0-9a-f-]+)?\\.json$`);
    try {
        for (const entry of readdirSync(hooksDir, { withFileTypes: true })) {
            if (!entry.isFile()) continue;
            const match = pattern.exec(entry.name);
            if (!match) continue;
            const ownerPid = Number(match[1]);
            if (ownerPid === process.pid || isProcessAlive(ownerPid)) continue;
            unlinkSync(join(hooksDir, entry.name));
            logger.debug(`[generateHookSettings] Cleaned stale settings file: ${entry.name}`);
        }
    } catch (error) {
        logger.debug(`[generateHookSettings] Failed to clean stale settings files: ${error}`);
    }
}

function buildHookSettings(
    command: string,
    hooksEnabled?: boolean,
    settingsEnv?: Record<string, string>
): ClaudeSettings {
    const hooks: NonNullable<ClaudeSettings['hooks']> = {
        SessionStart: [
            {
                matcher: '*',
                hooks: [
                    {
                        type: 'command',
                        command
                    }
                ]
            }
        ]
    };

    const settings: ClaudeSettings = { hooks };
    if (settingsEnv && Object.keys(settingsEnv).length > 0) {
        settings.env = { ...settingsEnv };
    }
    if (hooksEnabled !== undefined) {
        settings.hooksConfig = {
            enabled: hooksEnabled
        };
    }

    return settings;
}

function writePrivateSettingsFile(settings: ClaudeSettings, options: SettingsFileOptions): string {
    const hooksDir = join(configuration.happyHomeDir, 'tmp', 'hooks');
    mkdirSync(hooksDir, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') {
        chmodSync(hooksDir, 0o700);
    }
    cleanupStaleSettingsFiles(hooksDir, options.filenamePrefix);

    const filename = `${options.filenamePrefix}-${process.pid}-${randomUUID()}.json`;
    const filepath = join(hooksDir, filename);
    writeFileSync(filepath, JSON.stringify(settings, null, 4), { mode: 0o600, flag: 'wx' });
    if (process.platform !== 'win32') {
        chmodSync(filepath, 0o600);
    }
    logger.debug(`[${options.logLabel}] Created Claude settings file: ${filepath}`);
    return filepath;
}

export function generateProviderSettingsFile(
    settingsEnv: Record<string, string>,
    options: SettingsFileOptions
): string {
    return writePrivateSettingsFile({ env: { ...settingsEnv } }, options);
}

export function generateHookSettingsFile(
    port: number,
    token: string,
    options: HookSettingsOptions
): string {
    const { command, args } = getHappyCliCommand([
        'hook-forwarder',
        '--port',
        String(port),
        '--token',
        token
    ]);
    const hookCommand = shellJoin([command, ...args]);

    const settings = buildHookSettings(hookCommand, options.hooksEnabled, options.settingsEnv);
    return writePrivateSettingsFile(settings, options);
}

export function cleanupHookSettingsFile(filepath: string, logLabel: string): void {
    try {
        if (existsSync(filepath)) {
            unlinkSync(filepath);
            logger.debug(`[${logLabel}] Cleaned up hook settings file: ${filepath}`);
        }
    } catch (error) {
        logger.debug(`[${logLabel}] Failed to cleanup hook settings file: ${error}`);
    }
}
