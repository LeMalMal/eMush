/** Browser permissions the game actually needs. Camera, microphone, geolocation... are refused. */
const GRANTED_PERMISSIONS = new Set([
    'notifications',
    'fullscreen',
    'clipboard-sanitized-write',
]);

export class PermissionPolicy {
    private readonly trustedOrigins: Set<string>;

    constructor(trustedOrigins: string[]) {
        this.trustedOrigins = new Set(trustedOrigins);
    }

    execute(permission: string, requestingUrl: string): boolean {
        return GRANTED_PERMISSIONS.has(permission) && this.isTrusted(requestingUrl);
    }

    private isTrusted(requestingUrl: string): boolean {
        try {
            return this.trustedOrigins.has(new URL(requestingUrl).origin);
        } catch {
            return false;
        }
    }
}
