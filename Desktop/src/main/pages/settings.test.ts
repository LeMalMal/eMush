import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SettingsService, SettingsStore } from '../background/settings';
import { LoadSettings, UpdateSettings } from './settings';

class MemoryStore implements SettingsStore {
    constructor(private value = { ...DEFAULT_SETTINGS }) {}
    load() { return { ...this.value }; }
    save(settings: typeof DEFAULT_SETTINGS) { this.value = settings; }
}

const devClient = { version: '0.1.0', canLaunchAtStartup: false, sourceCodeUrl: 'https://example.org/code', systemGameLanguage: 'fr' as const };

describe('settings page', () => {
    it('shows the current settings and client information', async () => {
        const result = await new LoadSettings(new SettingsService(new MemoryStore()), devClient).execute();

        expect(result).toEqual({ ok: true, view: { settings: DEFAULT_SETTINGS, client: devClient } });
    });

    it('applies player choices but not internal flags, nor startup launch in a dev build', () => {
        const service = new SettingsService(new MemoryStore());

        const view = new UpdateSettings(service, devClient).execute({ messages: false, trayHintShown: true, launchAtStartup: true, gameLanguage: 'en' });

        expect(view.settings).toMatchObject({ messages: false, trayHintShown: false, launchAtStartup: false, gameLanguage: 'en' });
    });

    it('allows startup launch in the installed app', () => {
        const service = new SettingsService(new MemoryStore());

        expect(new UpdateSettings(service, { ...devClient, canLaunchAtStartup: true }).execute({ launchAtStartup: true }).settings.launchAtStartup).toBe(true);
    });
});
