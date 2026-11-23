export type NavigationDecision = 'allow' | 'open-external' | 'block';

const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

/**
 * Decides where a URL may be opened:
 * - in-app origins (game, Eternaltwin and its login providers) stay inside the app window;
 * - other web links and e-mail links go to the user's default browser / mail client;
 * - anything else (file:, javascript:, custom protocols...) is blocked.
 */
export class NavigationPolicy {
    private readonly inAppOrigins: Set<string>;

    constructor(inAppOrigins: string[]) {
        this.inAppOrigins = new Set(inAppOrigins);
    }

    execute(rawUrl: string): NavigationDecision {
        const url = parseUrl(rawUrl);
        if (url === null) {
            return 'block';
        }

        if (this.inAppOrigins.has(url.origin)) {
            return 'allow';
        }

        if (EXTERNAL_PROTOCOLS.has(url.protocol)) {
            return 'open-external';
        }

        return 'block';
    }
}

function parseUrl(rawUrl: string): URL | null {
    try {
        return new URL(rawUrl);
    } catch {
        return null;
    }
}
