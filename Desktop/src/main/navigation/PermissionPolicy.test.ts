import { describe, expect, it } from 'vitest';
import { PermissionPolicy } from './PermissionPolicy';

const policy = new PermissionPolicy(['https://emush.eternaltwin.org']);

describe('PermissionPolicy', () => {
    it.each(['notifications', 'fullscreen', 'clipboard-sanitized-write'])('grants %s to the game', (permission) => {
        expect(policy.execute(permission, 'https://emush.eternaltwin.org/game')).toBe(true);
    });

    it.each(['media', 'geolocation', 'openExternal', 'hid'])('refuses %s even to the game', (permission) => {
        expect(policy.execute(permission, 'https://emush.eternaltwin.org/game')).toBe(false);
    });

    it('refuses permissions to untrusted origins', () => {
        expect(policy.execute('notifications', 'https://ads.example.org')).toBe(false);
        expect(policy.execute('notifications', '')).toBe(false);
    });
});
