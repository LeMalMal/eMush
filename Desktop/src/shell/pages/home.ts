import type { HomeView, NewsCard } from '../../main/pages/view';
import { bridge } from '../bridge';
import { h } from '../dom';
import { PageContext, showLoaded } from '../page';
import { figure, icon, IconName, sectionTitle, tagElement } from '../ui';

const COUNTER_ICONS: IconName[] = ['sol', 'dead', 'planet'];

export function renderHome(context: PageContext): Promise<void> {
    return showLoaded(context, () => bridge.load('home'), (view) => {
        context.setUser(view.username);
        return homePage(view);
    }, 'Connexion au Daedalus…');
}

function homePage(view: HomeView): HTMLElement {
    const visual = view.ship.characterKey
        ? figure(view.ship.characterKey)
        : h('img', { class: 'ship-art', src: 'img/daedalus.png', alt: '' });

    const primary = h('button', {
        class: 'btn red big block',
        type: 'button',
        id: 'primary-action',
        onclick: () => bridge.command(view.primary.command),
    }, view.primary.label);

    return h('div', { class: 'container home' },
        h('section', { class: 'box ship', 'aria-labelledby': 'ship-title' },
            h('div', { class: 'visual' }, visual),
            h('div', { class: 'info' },
                h('span', { class: 'label' }, view.ship.eyebrow),
                h('h2', { id: 'ship-title' }, view.ship.title),
                view.ship.tags.length > 0 ? h('div', { class: 'tags' }, ...view.ship.tags.map(tagElement)) : null,
                h('p', { class: 'muted' }, view.ship.text)),
            h('div', { class: 'cta' }, primary, h('small', {}, 'Entrée : action principale · Ctrl+H : accueil')),
            view.counters.length > 0
                ? h('dl', { class: 'counters' }, ...view.counters.map((counter, index) => h('div', { class: 'slot counter' },
                    icon(COUNTER_ICONS[index] ?? 'planet', 'x2'), h('dd', {}, counter.value), h('dt', {}, counter.label))))
                : null),

        h('section', { class: 'frame pad', 'aria-labelledby': 'home-news' },
            sectionTitle('Actualités', 'home-news',
                h('button', { class: 'link-btn', type: 'button', onclick: () => bridge.navigate({ page: 'news' }) }, 'Tout voir ▸')),
            view.news.length > 0
                ? h('div', { class: 'news-list' }, ...view.news.map((item) => newsCard(item, true)))
                : h('p', { class: 'muted' }, 'Les actualités ne sont pas disponibles pour le moment.')),

        h('section', { class: 'frame pad', 'aria-labelledby': 'home-community' },
            sectionTitle('Communauté', 'home-community'),
            h('p', { class: 'muted' }, 'Débriefs de parties, guides, recrutement d\'équipages : le forum eMush d\'Eternaltwin s\'ouvre ici, avec ton compte.'),
            h('div', { class: 'toolbar' },
                h('button', { class: 'btn', type: 'button', onclick: () => bridge.navigate({ page: 'forum' }) }, 'Ouvrir le forum'),
                h('button', { class: 'btn', type: 'button', onclick: () => bridge.navigate({ page: 'ranking' }) }, 'Classements'))));
}

export function newsCard(item: NewsCard, compact = false): HTMLElement {
    return h('button', {
        class: compact ? 'news-card compact' : 'news-card',
        type: 'button',
        onclick: () => bridge.navigate({ page: 'article', id: item.id }),
    },
    h('span', { class: 'meta' }, item.date ? h('time', {}, item.date) : null, item.pinned ? h('span', { class: 'tag rare' }, 'Épinglée') : null),
    h('b', {}, item.title),
    item.excerpt ? h('span', { class: 'excerpt' }, item.excerpt) : null);
}
