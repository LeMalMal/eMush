import type { Navigation, ShellPage } from '../main/shell/routes';
import { bridge } from './bridge';
import { h } from './dom';
import { PageContext } from './page';
import { renderCrew } from './pages/crew';
import { renderHome } from './pages/home';
import { renderArticle, renderNews } from './pages/news';
import { renderProfile } from './pages/profile';
import { renderRanking } from './pages/ranking';
import { loadingState } from './ui';

// The shell page: navigation bar (always visible) + native pages. Which page to draw is always
// decided by the main process (`onPage`), so the bar and the content can't disagree.

const root = document.getElementById('page') as HTMLElement;
const userPill = document.getElementById('user-pill') as HTMLButtonElement;
const loginPill = document.getElementById('login-pill') as HTMLButtonElement;

/** Which navigation entry is lit for each page. */
const SECTION: Record<ShellPage, string | null> = {
    home: 'home', crew: 'play', game: 'play', news: 'news', article: 'news', forum: 'forum',
    ranking: 'ranking', ship: 'ranking', profile: 'profile', rules: 'rules', login: null, web: null,
};

let current: Navigation = { page: 'home' };
let pageToken = 0;

const context: PageContext = {
    root,
    track() {
        const token = ++pageToken;
        return () => token === pageToken;
    },
    setUser(username) {
        userPill.hidden = username === null;
        loginPill.hidden = username !== null;
        userPill.textContent = username ?? '';
    },
    rerender() {
        render(current);
    },
};

function highlight(navigation: Navigation): void {
    const section = SECTION[navigation.page];
    for (const entry of document.querySelectorAll<HTMLElement>('[data-section]')) {
        if (entry.dataset.section === section) {
            entry.setAttribute('aria-current', 'page');
        } else {
            entry.removeAttribute('aria-current');
        }
    }
}

function render(navigation: Navigation): void {
    current = navigation;
    highlight(navigation);
    document.querySelector('dialog[open]')?.remove();

    switch (navigation.page) {
        case 'home': void renderHome(context); break;
        case 'crew': void renderCrew(context); break;
        case 'news': void renderNews(context); break;
        case 'article': void renderArticle(context, Number(navigation.id)); break;
        case 'ranking': void renderRanking(context); break;
        case 'profile': void renderProfile(context, typeof navigation.id === 'string' ? navigation.id : null); break;
        default:
            // Web page: the web view is drawn over this area; this only shows while it loads.
            context.track();
            root.replaceChildren(h('div', { class: 'web-placeholder' }, loadingState('Ouverture de la page…')));
    }
}

document.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-nav], [data-command]');
    if (!target) {
        return;
    }
    if (target.dataset.nav) {
        bridge.navigate({ page: target.dataset.nav as ShellPage });
    } else if (target.dataset.command) {
        bridge.command(target.dataset.command as 'play' | 'login' | 'wiki');
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.target !== document.body && event.target !== root) {
        return;
    }
    document.getElementById('primary-action')?.click();
});

/** The bar shows who is signed in on every page (the home page also refreshes it after login/logout). */
function refreshUser(): void {
    void bridge.load('account').then((result) => {
        if (result.ok) {
            context.setUser(result.view.username);
        }
    });
}

bridge.onPage((navigation) => render(navigation));
bridge.onReload(() => render(current));
bridge.ready();
refreshUser();
