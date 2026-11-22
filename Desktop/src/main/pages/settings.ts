import { SettingsService } from '../background/settings';
import { ClientInfo, Loaded, SettingsView } from './view';

export type { ClientInfo, SettingsView };

export class LoadSettings {
    constructor(private readonly settings: SettingsService, private readonly client: ClientInfo) {}

    async execute(): Promise<Loaded<SettingsView>> {
        return { ok: true, view: { settings: this.settings.get(), client: this.client } };
    }
}

/** Applies a change sent by the settings page (validated by the service) and returns the new view. */
export class UpdateSettings {
    constructor(private readonly settings: SettingsService, private readonly client: ClientInfo) {}

    execute(change: unknown): SettingsView {
        const safeChange = typeof change === 'object' && change !== null ? { ...change as Record<string, unknown> } : {};
        delete safeChange.trayHintShown; // Internal flag, not a player choice.
        if (!this.client.canLaunchAtStartup) {
            delete safeChange.launchAtStartup;
        }

        return { settings: this.settings.update(safeChange), client: this.client };
    }
}
