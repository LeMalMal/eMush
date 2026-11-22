import fs from 'node:fs';
import path from 'node:path';
import { isValidWindowState, WindowState, WindowStateStore } from './WindowState';

/** Persists the window state as JSON in the user data folder. A corrupt or missing file is ignored. */
export class JsonFileWindowStateStore implements WindowStateStore {
    constructor(private readonly filePath: string) {}

    load(): WindowState | null {
        try {
            const content: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));

            return isValidWindowState(content) ? content : null;
        } catch {
            return null;
        }
    }

    save(state: WindowState): void {
        try {
            fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
            fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf8');
        } catch (error) {
            console.warn('[window] Could not save window state:', error);
        }
    }
}
