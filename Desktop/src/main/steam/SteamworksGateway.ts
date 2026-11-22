import { SteamGateway } from './SteamGateway';

/** Subset of the steamworks.js client we use, so it can be stubbed in tests. */
export type SteamworksClient = {
    localplayer: {
        getName(): string;
        setRichPresence(key: string, value?: string): void;
    };
    achievement: {
        activate(achievement: string): boolean;
    };
};

export class SteamworksGateway implements SteamGateway {
    readonly isConnected = true;

    constructor(private readonly client: SteamworksClient) {}

    playerName(): string | null {
        return this.client.localplayer.getName();
    }

    setRichPresence(key: string, value: string): void {
        this.client.localplayer.setRichPresence(key, value);
    }

    unlockAchievement(achievementId: string): boolean {
        return this.client.achievement.activate(achievementId);
    }
}
