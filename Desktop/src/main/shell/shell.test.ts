import { describe, expect, it } from 'vitest';
import { SAMPLE_ACCOUNT } from '../api/FakeGameServer';
import { parseAccount } from '../api/parsers';
import { LoginReturnWatcher } from './LoginReturnWatcher';
import { classifyWebUrl, EMUSH_FORUM_URL, nativeNavigationFor, Navigation, parseNavigation, resolvePlay, webUrlFor } from './routes';
import { ShellNavigator, ShellPagePort, WebViewPort } from './ShellNavigator';

const server = new URL('https://emush.eternaltwin.org');
const UUID = 'd60eaddd-1fe0-490b-8fe9-da9ae6edca3e';

/** Handwritten fake of the web view: records what it was asked to show. */
class FakeWebView implements WebViewPort {
    visibleUrl: string | null = null;
    opened: string[] = [];
    loginButtonPresent = true;

    open(url: string): void {
        this.visibleUrl = url;
        this.opened.push(url);
    }

    hide(): void {
        this.visibleUrl = null;
    }

    async clickLogin(): Promise<boolean> {
        return this.loginButtonPresent;
    }
}

class FakeShellPage implements ShellPagePort {
    shown: Navigation[] = [];

    showPage(navigation: Navigation): void {
        this.shown.push(navigation);
    }

    get last(): Navigation | undefined {
        return this.shown[this.shown.length - 1];
    }
}

function setup() {
    const webView = new FakeWebView();
    const shellPage = new FakeShellPage();

    return { webView, shellPage, navigator: new ShellNavigator(server, webView, shellPage) };
}

describe('parseNavigation', () => {
    it.each([
        [{ page: 'home' }, { page: 'home' }],
        [{ page: 'article', id: 38 }, { page: 'article', id: 38 }],
        [{ page: 'profile' }, { page: 'profile' }],
        [{ page: 'profile', id: UUID }, { page: 'profile', id: UUID }],
        [{ page: 'ship', id: 225 }, { page: 'ship', id: 225 }],
    ])('accepts %j', (input, expected) => {
        expect(parseNavigation(input)).toEqual(expected);
    });

    it.each([
        null, 'home', { page: 'admin' }, { page: 'login' }, { page: 'web' }, { page: 'article' }, { page: 'article', id: '38' },
        { page: 'ship', id: -1 }, { page: 'profile', id: '../../etc' }, { page: 'home', id: 1 },
    ])('rejects %j', (input) => {
        expect(parseNavigation(input)).toBeNull();
    });
});

describe('web pages', () => {
    it('maps web pages to their URL', () => {
        expect(webUrlFor({ page: 'game' }, server)).toBe('https://emush.eternaltwin.org/game');
        expect(webUrlFor({ page: 'ship', id: 225 }, server)).toBe('https://emush.eternaltwin.org/the-end/225');
        expect(webUrlFor({ page: 'forum' }, server)).toBe(EMUSH_FORUM_URL);
    });

    it('sends the web pages that were redone natively back to the shell', () => {
        expect(nativeNavigationFor('https://emush.eternaltwin.org/', server)).toEqual({ page: 'home' });
        expect(nativeNavigationFor('https://emush.eternaltwin.org/news', server)).toEqual({ page: 'news' });
        expect(nativeNavigationFor('https://emush.eternaltwin.org/ranking/', server)).toEqual({ page: 'ranking' });
        expect(nativeNavigationFor('https://emush.eternaltwin.org/me', server)).toEqual({ page: 'profile' });
        expect(nativeNavigationFor(`https://emush.eternaltwin.org/user/${UUID}`, server)).toEqual({ page: 'profile', id: UUID });
    });

    it('keeps the game, rules, ship pages and other sites on the web', () => {
        for (const url of ['https://emush.eternaltwin.org/game', 'https://emush.eternaltwin.org/rules', 'https://emush.eternaltwin.org/the-end/225', 'https://eternaltwin.org/news']) {
            expect(nativeNavigationFor(url, server)).toBeNull();
        }
    });

    it('names the web page the view is on', () => {
        expect(classifyWebUrl('https://emush.eternaltwin.org/game', server)).toEqual({ page: 'game' });
        expect(classifyWebUrl('https://emush.eternaltwin.org/the-end/225', server)).toEqual({ page: 'ship', id: 225 });
        expect(classifyWebUrl(`${EMUSH_FORUM_URL}/threads/1`, server)).toEqual({ page: 'forum' });
        expect(classifyWebUrl('https://eternaltwin.org/forum/threads/abc', server)).toEqual({ page: 'forum' });
        expect(classifyWebUrl('https://discord.com/login', server)).toEqual({ page: 'web' });
    });
});

describe('resolvePlay', () => {
    const account = parseAccount(SAMPLE_ACCOUNT);

    it('leads to login, rules, crew selection or the game', () => {
        expect(resolvePlay(null)).toBe('login');
        expect(resolvePlay(account && { ...account, hasAcceptedRules: false })).toEqual({ page: 'rules' });
        expect(resolvePlay(account)).toEqual({ page: 'crew' });
        expect(resolvePlay(account && { ...account, playerId: 812 })).toEqual({ page: 'game' });
    });
});

describe('ShellNavigator', () => {
    it('hides the web view for native pages and shows it for web pages', () => {
        const { navigator, webView, shellPage } = setup();

        navigator.go({ page: 'game' });
        expect(webView.visibleUrl).toBe('https://emush.eternaltwin.org/game');

        navigator.go({ page: 'ranking' });
        expect(webView.visibleUrl).toBeNull();
        expect(shellPage.shown).toEqual([{ page: 'game' }, { page: 'ranking' }]);
    });

    it('turns a web link to a redone page into the native page', () => {
        const { navigator, webView, shellPage } = setup();
        navigator.go({ page: 'game' });

        navigator.onWebNavigation('https://emush.eternaltwin.org/news');

        expect(webView.visibleUrl).toBeNull();
        expect(shellPage.last).toEqual({ page: 'news' });
    });

    it('keeps the bar in sync when the web game moves between web pages', () => {
        const { navigator, shellPage } = setup();
        navigator.go({ page: 'rules' });

        navigator.onWebNavigation('https://emush.eternaltwin.org/game');

        expect(shellPage.last).toEqual({ page: 'game' });
        expect(navigator.currentPage).toEqual({ page: 'game' });
    });

    it('ignores the hidden web view while a native page is shown', () => {
        const { navigator, shellPage } = setup();
        navigator.go({ page: 'game' });
        navigator.go({ page: 'profile' });

        navigator.onWebNavigation('https://emush.eternaltwin.org/news');

        expect(shellPage.last).toEqual({ page: 'profile' });
    });

    it('logs in through the web client, then returns to the home page', async () => {
        const { navigator, webView, shellPage } = setup();

        await navigator.startLogin();
        expect(webView.visibleUrl).toBe('https://emush.eternaltwin.org/');

        navigator.onWebNavigation('https://emush.eternaltwin.org/'); // Must not jump to the native home mid-login.
        navigator.onWebNavigation('https://eternaltwin.org/login');
        expect(shellPage.last).toEqual({ page: 'login' });

        navigator.onWebNavigation('https://emush.eternaltwin.org/token?code=abc&state=xyz');
        navigator.onWebNavigation('https://emush.eternaltwin.org/game');

        expect(shellPage.last).toEqual({ page: 'home' });
        expect(webView.visibleUrl).toBeNull();
    });

    it('goes back home when there is no login button (already logged in on the web)', async () => {
        const { navigator, webView, shellPage } = setup();
        webView.loginButtonPresent = false;

        await navigator.startLogin();

        expect(shellPage.last).toEqual({ page: 'home' });
    });

    it('opens any trusted page, preferring native pages', () => {
        const { navigator, webView, shellPage } = setup();

        navigator.openWeb('https://eternaltwin.org/users/abc');
        expect(webView.visibleUrl).toBe('https://eternaltwin.org/users/abc');
        expect(shellPage.last).toEqual({ page: 'web' });

        navigator.openWeb('https://emush.eternaltwin.org/news');
        expect(shellPage.last).toEqual({ page: 'news' });
    });
});

describe('LoginReturnWatcher', () => {
    it('fires once, on the first game page after the OAuth token page', () => {
        const watcher = new LoginReturnWatcher('https://emush.eternaltwin.org');

        expect(watcher.execute('https://emush.eternaltwin.org/token?code=abc')).toBe(false);
        expect(watcher.execute('https://emush.eternaltwin.org/game')).toBe(true);
        expect(watcher.execute('https://emush.eternaltwin.org/game')).toBe(false);
        expect(watcher.execute('https://eternaltwin.org/token')).toBe(false);
    });
});
