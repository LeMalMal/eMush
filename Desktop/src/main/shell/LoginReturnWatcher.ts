/**
 * The web client ends its login flow on `/token`, then routes to `/game`.
 * Seeing `/token` then the next page on the game server means the login just succeeded:
 * that is when the desktop client brings the player back to the hub.
 */
export class LoginReturnWatcher {
    private loginInProgress = false;

    constructor(private readonly serverOrigin: string) {}

    /** Returns true when the window should go back to the hub. */
    execute(rawUrl: string): boolean {
        const url = parse(rawUrl);
        if (url === null || url.origin !== this.serverOrigin) {
            return false;
        }

        if (url.pathname === '/token') {
            this.loginInProgress = true;
            return false;
        }

        if (this.loginInProgress) {
            this.loginInProgress = false;
            return true;
        }

        return false;
    }
}

function parse(rawUrl: string): URL | null {
    try {
        return new URL(rawUrl);
    } catch {
        return null;
    }
}
