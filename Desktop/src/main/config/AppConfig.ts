export const DEFAULT_SERVER_URL = 'https://emush.eternaltwin.org';
export const DEFAULT_ETERNALTWIN_URL = 'https://eternaltwin.org';

/** Third-party accounts Eternaltwin offers on its login page ("Se connecter avec Discord / GitLab"). */
export const LOGIN_PROVIDER_ORIGINS = ['https://discord.com', 'https://gitlab.com'];

export type AppConfig = {
    /** Page loaded at startup: the eMush web client. */
    serverUrl: URL;
    /** Game and Eternaltwin: the only origins granted browser permissions (notifications...). */
    trustedOrigins: string[];
    /** Origins the window may navigate to: trusted origins + login providers. Everything else opens in the browser. */
    inAppOrigins: string[];
    /** Steam App ID, or null to run without Steam. */
    steamAppId: number | null;
    devTools: boolean;
};

export type ConfigSources = {
    argv: string[];
    env: Record<string, string | undefined>;
    isPackaged: boolean;
};

export class InvalidConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidConfigError';
    }
}

/**
 * Reads the configuration from command line flags (`--server=`, `--eternaltwin=`, `--steam-app-id=`)
 * then environment variables (`EMUSH_SERVER_URL`, `EMUSH_ETERNALTWIN_URL`, `EMUSH_STEAM_APP_ID`).
 */
export function loadAppConfig({ argv, env, isPackaged }: ConfigSources): AppConfig {
    const serverUrl = parseHttpUrl(readFlag(argv, 'server') ?? env.EMUSH_SERVER_URL ?? DEFAULT_SERVER_URL, 'server');
    const eternaltwinUrl = parseHttpUrl(readFlag(argv, 'eternaltwin') ?? env.EMUSH_ETERNALTWIN_URL ?? DEFAULT_ETERNALTWIN_URL, 'eternaltwin');

    const trustedOrigins = unique([serverUrl.origin, eternaltwinUrl.origin]);

    return {
        serverUrl,
        trustedOrigins,
        inAppOrigins: unique([...trustedOrigins, ...LOGIN_PROVIDER_ORIGINS]),
        steamAppId: parseSteamAppId(readFlag(argv, 'steam-app-id') ?? env.EMUSH_STEAM_APP_ID),
        devTools: !isPackaged || argv.includes('--devtools'),
    };
}

function readFlag(argv: string[], name: string): string | undefined {
    const prefix = `--${name}=`;
    const flag = argv.find((arg) => arg.startsWith(prefix));

    return flag?.slice(prefix.length);
}

function parseHttpUrl(raw: string, label: string): URL {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new InvalidConfigError(`Invalid ${label} URL: "${raw}"`);
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new InvalidConfigError(`The ${label} URL must use http or https: "${raw}"`);
    }

    return url;
}

function parseSteamAppId(raw: string | undefined): number | null {
    if (raw === undefined || raw.trim() === '') {
        return null;
    }

    const appId = Number(raw);
    if (!Number.isInteger(appId) || appId <= 0) {
        throw new InvalidConfigError(`Invalid Steam App ID: "${raw}"`);
    }

    return appId;
}

function unique(values: string[]): string[] {
    return [...new Set(values)];
}
