import fs from 'node:fs';
import path from 'node:path';
import { AppSettings, DEFAULT_SETTINGS, parseSettings } from './settingsModel';

export * from './settingsModel';

export interface SettingsStore {
    load(): AppSettings;
    save(settings: AppSettings): void;
}

/** Settings as JSON in the user data folder; missing or corrupt files give the defaults. */
export class JsonFileSettingsStore implements SettingsStore {
    constructor(private readonly filePath: string) {}

    load(): AppSettings {
        try {
            return parseSettings(JSON.parse(fs.readFileSync(this.filePath, 'utf8')));
        } catch {
            return { ...DEFAULT_SETTINGS };
        }
    }

    save(settings: AppSettings): void {
        try {
            fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
            fs.writeFileSync(this.filePath, JSON.stringify(settings, null, 2), 'utf8');
        } catch (error) {
            console.warn('[settings] Could not save settings:', error);
        }
    }
}

export type SettingsListener = (settings: AppSettings, previous: AppSettings) => void;

/** Single source of truth for settings: every change is saved, then announced to listeners. */
export class SettingsService {
    private current: AppSettings;
    private readonly listeners: SettingsListener[] = [];

    constructor(private readonly store: SettingsStore) {
        this.current = store.load();
    }

    get(): AppSettings {
        return { ...this.current };
    }

    /** Applies a partial, untrusted change (validated) and returns the new settings. */
    update(change: unknown): AppSettings {
        const previous = this.current;
        const next = parseSettings(change, previous);
        if (JSON.stringify(next) === JSON.stringify(previous)) {
            return this.get();
        }
        this.current = next;
        this.store.save(next);
        for (const listener of this.listeners) {
            listener(this.get(), previous);
        }

        return this.get();
    }

    onChange(listener: SettingsListener): void {
        this.listeners.push(listener);
    }
}
