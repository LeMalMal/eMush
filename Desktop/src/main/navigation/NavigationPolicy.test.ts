import { describe, expect, it } from 'vitest';
import { NavigationPolicy } from './NavigationPolicy';

const policy = new NavigationPolicy(['https://emush.eternaltwin.org', 'https://eternaltwin.org', 'https://discord.com']);

describe('NavigationPolicy', () => {
    it.each([
        'https://emush.eternaltwin.org/game',
        'https://emush.eternaltwin.org/token?code=abc&state=xyz',
        'https://eternaltwin.org/oauth/authorize?client_id=emush',
        'https://discord.com/oauth2/authorize?response_type=code&redirect_uri=https%3A%2F%2Feternaltwin.org%2Foauth%2Fcallback%2Fdiscord',
    ])('keeps in-app page %s inside the app', (url) => {
        expect(policy.execute(url)).toBe('allow');
    });

    it.each([
        'https://fr.emushpedia.com/wiki/Daedalus',
        'https://discord.gg/abc', // Invite links are not the login provider.
        'http://example.org',
        'mailto:contact@example.org',
    ])('opens %s in the default browser or mail client', (url) => {
        expect(policy.execute(url)).toBe('open-external');
    });

    it.each([
        'http://emush.eternaltwin.org/game', // Downgrade to http: different origin.
        'https://emush.eternaltwin.org.evil.com/',
        'https://evil.com/?https://emush.eternaltwin.org',
    ])('does not trust look-alike URL %s', (url) => {
        expect(policy.execute(url)).not.toBe('allow');
    });

    it.each([
        'file:///C:/Windows/System32/calc.exe',
        'javascript:alert(1)',
        'steam://run/480',
        'ms-settings:privacy',
        'not a url',
    ])('blocks %s', (url) => {
        expect(policy.execute(url)).toBe('block');
    });
});
