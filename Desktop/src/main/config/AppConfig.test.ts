import { describe, expect, it } from 'vitest';
import { DEFAULT_SERVER_URL, InvalidConfigError, loadAppConfig } from './AppConfig';

const packaged = { argv: [], env: {}, isPackaged: true };

describe('loadAppConfig', () => {
    it('targets the official eMush server and Eternaltwin by default', () => {
        const config = loadAppConfig(packaged);

        expect(config.serverUrl.toString()).toBe(`${DEFAULT_SERVER_URL}/`);
        expect(config.trustedOrigins).toEqual(['https://emush.eternaltwin.org', 'https://eternaltwin.org']);
        expect(config.inAppOrigins).toEqual([
            'https://emush.eternaltwin.org',
            'https://eternaltwin.org',
            'https://discord.com',
            'https://gitlab.com',
        ]);
        expect(config.steamAppId).toBeNull();
        expect(config.devTools).toBe(false);
    });

    it('lets command line flags override environment variables', () => {
        const config = loadAppConfig({
            argv: ['electron', '.', '--server=http://localhost', '--eternaltwin=http://localhost:50320'],
            env: { EMUSH_SERVER_URL: 'https://staging.example.org' },
            isPackaged: true,
        });

        expect(config.serverUrl.origin).toBe('http://localhost');
        expect(config.trustedOrigins).toEqual(['http://localhost', 'http://localhost:50320']);
    });

    it('reads the server and Steam App ID from environment variables', () => {
        const config = loadAppConfig({
            argv: [],
            env: { EMUSH_SERVER_URL: 'https://staging.example.org/game', EMUSH_STEAM_APP_ID: '480' },
            isPackaged: true,
        });

        expect(config.serverUrl.toString()).toBe('https://staging.example.org/game');
        expect(config.steamAppId).toBe(480);
    });

    it('does not duplicate the origin when game and login share it', () => {
        const config = loadAppConfig({ argv: ['--server=http://localhost', '--eternaltwin=http://localhost/'], env: {}, isPackaged: true });

        expect(config.trustedOrigins).toEqual(['http://localhost']);
    });

    it('enables dev tools in development or with --devtools', () => {
        expect(loadAppConfig({ ...packaged, isPackaged: false }).devTools).toBe(true);
        expect(loadAppConfig({ ...packaged, argv: ['--devtools'] }).devTools).toBe(true);
    });

    it.each([
        ['--server=not a url'],
        ['--server=file:///C:/Windows'],
        ['--eternaltwin=javascript:alert(1)'],
        ['--steam-app-id=abc'],
        ['--steam-app-id=-4'],
    ])('rejects invalid value %s', (flag) => {
        expect(() => loadAppConfig({ ...packaged, argv: [flag] })).toThrow(InvalidConfigError);
    });
});
