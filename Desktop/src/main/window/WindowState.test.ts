import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JsonFileWindowStateStore } from './JsonFileWindowStateStore';
import { fitToDisplays, isValidWindowState, WindowState } from './WindowState';

const mainScreen = { x: 0, y: 0, width: 1920, height: 1040 };
const saved: WindowState = { x: 100, y: 50, width: 1400, height: 900, isMaximized: false, isFullScreen: false };

describe('fitToDisplays', () => {
    it('restores a window that is visible on a screen', () => {
        expect(fitToDisplays(saved, [mainScreen])).toEqual(saved);
    });

    it('drops the position when the window was on a monitor that is gone', () => {
        const onSecondScreen = { ...saved, x: 2500, y: 100 };

        const fitted = fitToDisplays(onSecondScreen, [mainScreen]);

        expect(fitted.x).toBeUndefined();
        expect(fitted.y).toBeUndefined();
        expect(fitted.width).toBe(1400);
    });

    it('keeps the window when its title bar is on a secondary monitor', () => {
        const secondScreen = { x: 1920, y: 0, width: 2560, height: 1400 };
        const onSecondScreen = { ...saved, x: 2500, y: 100 };

        expect(fitToDisplays(onSecondScreen, [mainScreen, secondScreen])).toEqual(onSecondScreen);
    });

    it('enforces the minimum size', () => {
        const tiny = { ...saved, width: 100, height: 50 };

        expect(fitToDisplays(tiny, [mainScreen])).toMatchObject({ width: 800, height: 600 });
    });
});

describe('isValidWindowState', () => {
    it('accepts a complete state, with or without position', () => {
        expect(isValidWindowState(saved)).toBe(true);
        expect(isValidWindowState({ width: 1, height: 1, isMaximized: true, isFullScreen: false })).toBe(true);
    });

    it.each([null, 'text', { width: '1280' }, { ...saved, x: Number.NaN }, { ...saved, isMaximized: 'yes' }])('rejects %j', (value) => {
        expect(isValidWindowState(value)).toBe(false);
    });
});

describe('JsonFileWindowStateStore', () => {
    let directory: string;
    let filePath: string;

    beforeEach(() => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'emush-desktop-'));
        filePath = path.join(directory, 'nested', 'window-state.json');
    });

    afterEach(() => {
        fs.rmSync(directory, { recursive: true, force: true });
    });

    it('returns null when nothing was saved yet', () => {
        expect(new JsonFileWindowStateStore(filePath).load()).toBeNull();
    });

    it('reloads what it saved', () => {
        const store = new JsonFileWindowStateStore(filePath);

        store.save(saved);

        expect(new JsonFileWindowStateStore(filePath).load()).toEqual(saved);
    });

    it('ignores a corrupt file', () => {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, '{ not json');

        expect(new JsonFileWindowStateStore(filePath).load()).toBeNull();
    });
});
