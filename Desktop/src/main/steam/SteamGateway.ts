/**
 * What the desktop client needs from Steam. The rest of the app depends on this
 * abstraction only, so it runs the same with or without Steam.
 */
export interface SteamGateway {
    readonly isConnected: boolean;
    playerName(): string | null;
    setRichPresence(key: string, value: string): void;
    unlockAchievement(achievementId: string): boolean;
}

/** Used when Steam is disabled or unreachable: every call is a harmless no-op. */
export class OfflineSteamGateway implements SteamGateway {
    readonly isConnected = false;

    playerName(): string | null {
        return null;
    }

    setRichPresence(): void {}

    unlockAchievement(): boolean {
        return false;
    }
}
