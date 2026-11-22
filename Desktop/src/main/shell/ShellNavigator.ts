import { LoginReturnWatcher } from './LoginReturnWatcher';
import { classifyWebUrl, isWebPage, nativeNavigationFor, Navigation, webUrlFor } from './routes';

/** The web view under the navigation bar (implemented with an Electron WebContentsView). */
export interface WebViewPort {
    /** Shows the view on this URL; does not reload when it is already there. */
    open(url: string): void;
    hide(): void;
    /** Clicks the web client's own login button. Resolves false when there is none (already logged in...). */
    clickLogin(): Promise<boolean>;
}

/** The shell page, told which page to draw. */
export interface ShellPagePort {
    showPage(navigation: Navigation): void;
}

/**
 * Single place deciding what the window shows. Every navigation (shell buttons, menu shortcuts,
 * links inside the web game, end of login) goes through `go`, so the navigation bar and the
 * content always agree, and the player can always get back to the hub.
 */
export class ShellNavigator {
    private current: Navigation = { page: 'home' };
    private loginInProgress = false;
    private readonly loginWatcher: LoginReturnWatcher;

    constructor(private readonly serverUrl: URL, private readonly webView: WebViewPort, private readonly shellPage: ShellPagePort) {
        this.loginWatcher = new LoginReturnWatcher(serverUrl.origin);
    }

    get currentPage(): Navigation {
        return this.current;
    }

    go(navigation: Navigation): void {
        this.loginInProgress = navigation.page === 'login';
        this.current = navigation;

        if (isWebPage(navigation.page) && navigation.page !== 'web') {
            this.webView.open(webUrlFor(navigation, this.serverUrl));
        } else if (!isWebPage(navigation.page)) {
            this.webView.hide();
        }
        this.shellPage.showPage(navigation);
    }

    /** Opens any trusted page that has no dedicated entry (an Eternaltwin page, a ship's end page...). */
    openWeb(url: string): void {
        const native = nativeNavigationFor(url, this.serverUrl);
        if (native) {
            this.go(native);
            return;
        }
        this.loginInProgress = false;
        this.current = { page: 'web' };
        this.webView.open(url);
        this.shellPage.showPage(this.current);
    }

    async startLogin(): Promise<void> {
        this.go({ page: 'login' });
        const clicked = await this.webView.clickLogin();
        if (!clicked && this.loginInProgress) {
            this.go({ page: 'home' });
        }
    }

    /** Called for every navigation of the web view (full loads and in-page route changes). */
    onWebNavigation(url: string): void {
        if (this.loginWatcher.execute(url)) {
            this.go({ page: 'home' });
            return;
        }
        if (this.loginInProgress || !isWebPage(this.current.page)) {
            return;
        }
        const native = nativeNavigationFor(url, this.serverUrl);
        if (native) {
            this.go(native);
            return;
        }
        const page = classifyWebUrl(url, this.serverUrl);
        if (page.page !== this.current.page || page.id !== this.current.id) {
            this.current = page;
            this.shellPage.showPage(page);
        }
    }
}
