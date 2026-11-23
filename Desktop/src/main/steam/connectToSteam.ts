import { OfflineSteamGateway, SteamGateway } from './SteamGateway';
import { SteamworksClient, SteamworksGateway } from './SteamworksGateway';

/** Subset of the steamworks.js module we use. */
export type SteamworksModule = {
    init(appId: number): SteamworksClient;
    restartAppIfNecessary(appId: number): boolean;
    electronEnableSteamOverlay(disableEachFrameInvalidation?: boolean): void;
};

export type SteamworksLoader = () => SteamworksModule;

export const loadSteamworks: SteamworksLoader = () => require('steamworks.js') as SteamworksModule;

export type SteamConnection =
    | { status: 'disabled'; gateway: SteamGateway }
    | { status: 'connected'; gateway: SteamGateway }
    | { status: 'restart-through-steam'; gateway: SteamGateway }
    | { status: 'unavailable'; gateway: SteamGateway; reason: string };

/**
 * Connects to the local Steam client. Never throws: if Steam is not installed, not running,
 * or the native module is missing, the game still works through an offline gateway.
 *
 * Must run before Electron's `ready` event so the Steam overlay switches are applied.
 */
export function connectToSteam(
    appId: number | null,
    options: { relaunchThroughSteam: boolean },
    load: SteamworksLoader = loadSteamworks,
): SteamConnection {
    const offline = new OfflineSteamGateway();
    if (appId === null) {
        return { status: 'disabled', gateway: offline };
    }

    try {
        const steamworks = load();

        if (options.relaunchThroughSteam && steamworks.restartAppIfNecessary(appId)) {
            return { status: 'restart-through-steam', gateway: offline };
        }

        const client = steamworks.init(appId);
        steamworks.electronEnableSteamOverlay();

        return { status: 'connected', gateway: new SteamworksGateway(client) };
    } catch (error) {
        return { status: 'unavailable', gateway: offline, reason: errorMessage(error) };
    }
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
