import { describe, expect, it } from 'vitest';
import { connectToSteam, SteamworksModule } from './connectToSteam';
import { SteamworksClient } from './SteamworksGateway';

/** Handwritten in-memory stand-in for the steamworks.js native module. */
class FakeSteamworks implements SteamworksModule {
    initialisedWith: number | null = null;
    overlayEnabled = false;
    readonly unlocked: string[] = [];
    readonly presence = new Map<string, string | undefined>();

    constructor(private readonly options: { steamRunning?: boolean; launchedOutsideSteam?: boolean } = {}) {}

    init(appId: number): SteamworksClient {
        if (this.options.steamRunning === false) {
            throw new Error('Steam is not running');
        }
        this.initialisedWith = appId;

        return {
            localplayer: {
                getName: () => 'Jin Su',
                setRichPresence: (key, value) => this.presence.set(key, value),
            },
            achievement: {
                activate: (achievement) => {
                    this.unlocked.push(achievement);
                    return true;
                },
            },
        };
    }

    restartAppIfNecessary(): boolean {
        return this.options.launchedOutsideSteam === true;
    }

    electronEnableSteamOverlay(): void {
        this.overlayEnabled = true;
    }
}

describe('connectToSteam', () => {
    it('stays offline when no Steam App ID is configured, without loading the native module', () => {
        const connection = connectToSteam(null, { relaunchThroughSteam: true }, () => {
            throw new Error('should not be loaded');
        });

        expect(connection.status).toBe('disabled');
        expect(connection.gateway.isConnected).toBe(false);
    });

    it('connects, enables the overlay and forwards calls to Steam', () => {
        const steamworks = new FakeSteamworks();

        const connection = connectToSteam(480, { relaunchThroughSteam: false }, () => steamworks);
        connection.gateway.setRichPresence('status', 'En jeu');

        expect(connection.status).toBe('connected');
        expect(steamworks.initialisedWith).toBe(480);
        expect(steamworks.overlayEnabled).toBe(true);
        expect(connection.gateway.playerName()).toBe('Jin Su');
        expect(connection.gateway.unlockAchievement('FIRST_SHIP')).toBe(true);
        expect(steamworks.unlocked).toEqual(['FIRST_SHIP']);
        expect(steamworks.presence.get('status')).toBe('En jeu');
    });

    it('falls back to offline mode when Steam is not running', () => {
        const connection = connectToSteam(480, { relaunchThroughSteam: false }, () => new FakeSteamworks({ steamRunning: false }));

        expect(connection).toMatchObject({ status: 'unavailable', reason: 'Steam is not running' });
        expect(connection.gateway.unlockAchievement('FIRST_SHIP')).toBe(false);
    });

    it('falls back to offline mode when the native module is missing', () => {
        const connection = connectToSteam(480, { relaunchThroughSteam: false }, () => {
            throw new Error("Cannot find module 'steamworks.js'");
        });

        expect(connection.status).toBe('unavailable');
    });

    it('asks to relaunch through Steam when a packaged build is started directly', () => {
        const steamworks = new FakeSteamworks({ launchedOutsideSteam: true });

        const connection = connectToSteam(480, { relaunchThroughSteam: true }, () => steamworks);

        expect(connection.status).toBe('restart-through-steam');
        expect(steamworks.initialisedWith).toBeNull();
    });
});
