import { Account } from '../api/models';
import { UUID } from '../api/parsers';

/** Pages drawn by the client itself, in the shell window. */
export const NATIVE_PAGES = ['home', 'crew', 'news', 'article', 'ranking', 'profile'] as const;
/** Pages of the web game (or Eternaltwin), shown in the web view under the shell's navigation bar. */
export const WEB_PAGES = ['game', 'forum', 'rules', 'ship', 'login', 'web'] as const;

export type NativePage = typeof NATIVE_PAGES[number];
export type WebPage = typeof WEB_PAGES[number];
export type ShellPage = NativePage | WebPage;
export type Navigation = { page: ShellPage; id?: number | string };

/** The eMush section of the Eternaltwin forum. */
export const EMUSH_FORUM_URL = 'https://eternaltwin.org/forum/sections/b5ddc792-0738-4289-9818-c2f1f029c8b1';
export const EMUSH_WIKI_URL = 'https://fr.emushpedia.com/';

/** Pages the shell UI may ask for. `login` and `web` are only reached through commands and links. */
const REQUESTABLE: readonly string[] = ['home', 'crew', 'news', 'article', 'ranking', 'profile', 'game', 'forum', 'rules', 'ship'];

export function isWebPage(page: ShellPage): page is WebPage {
    return (WEB_PAGES as readonly string[]).includes(page);
}

/** Validates a navigation request coming from the shell page. */
export function parseNavigation(value: unknown): Navigation | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const { page, id } = value as Record<string, unknown>;
    if (typeof page !== 'string' || !REQUESTABLE.includes(page)) {
        return null;
    }

    if (page === 'article' || page === 'ship') {
        return typeof id === 'number' && Number.isInteger(id) && id > 0 ? { page, id } : null;
    }
    if (page === 'profile') {
        if (id === undefined || id === null) {
            return { page };
        }
        return typeof id === 'string' && UUID.test(id) ? { page, id } : null;
    }

    return id === undefined ? { page: page as ShellPage } : null;
}

export function webUrlFor(navigation: Navigation, serverUrl: URL): string {
    const onServer = (path: string): string => new URL(path, serverUrl).toString();

    switch (navigation.page) {
        case 'game': return onServer('/game');
        case 'rules': return onServer('/rules');
        case 'ship': return onServer(`/the-end/${navigation.id}`);
        case 'forum': return EMUSH_FORUM_URL;
        case 'login': return onServer('/');
        default: throw new Error(`No web page for ${navigation.page}`);
    }
}

/**
 * When the web game navigates to a page the client has redone natively (its own links, redirects),
 * the client shows the native page instead. Returns null for pages that stay on the web.
 */
export function nativeNavigationFor(rawUrl: string, serverUrl: URL): Navigation | null {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return null;
    }
    if (url.origin !== serverUrl.origin) {
        return null;
    }

    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/') {
        return { page: 'home' };
    }
    if (path === '/news') {
        return { page: 'news' };
    }
    if (path === '/ranking') {
        return { page: 'ranking' };
    }
    if (path === '/me') {
        return { page: 'profile' };
    }
    const user = /^\/user\/([0-9a-f-]{36})$/i.exec(path);
    if (user && UUID.test(user[1])) {
        return { page: 'profile', id: user[1] };
    }

    return null;
}

/** Names the web page the view is on, so the navigation bar highlights the right entry. */
export function classifyWebUrl(rawUrl: string, serverUrl: URL): Navigation {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return { page: 'web' };
    }
    if (rawUrl.startsWith(EMUSH_FORUM_URL) || (url.origin === new URL(EMUSH_FORUM_URL).origin && url.pathname.startsWith('/forum'))) {
        return { page: 'forum' };
    }
    if (url.origin !== serverUrl.origin) {
        return { page: 'web' };
    }
    if (url.pathname === '/game') {
        return { page: 'game' };
    }
    if (url.pathname === '/rules') {
        return { page: 'rules' };
    }
    const ship = /^\/the-end\/(\d{1,9})$/.exec(url.pathname);

    return ship ? { page: 'ship', id: Number(ship[1]) } : { page: 'web' };
}

/** Where "Play" leads, depending on the account. */
export function resolvePlay(account: Account | null): Navigation | 'login' {
    if (account === null) {
        return 'login';
    }
    if (!account.hasAcceptedRules) {
        return { page: 'rules' };
    }

    return account.playerId === null ? { page: 'crew' } : { page: 'game' };
}
