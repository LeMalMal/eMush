import type { ArticleView, NewsListView } from '../../main/pages/view';
import { bridge } from '../bridge';
import { h } from '../dom';
import { PageContext, showLoaded } from '../page';
import { renderRich } from '../richText';
import { emptyState, pageHead, pagerControl } from '../ui';
import { newsCard } from './home';

export function renderNews(context: PageContext): Promise<void> {
    const show = (page: number): Promise<void> => showLoaded(context, () => bridge.load('news', page), (view) => newsPage(view, show));

    return show(1);
}

function newsPage(view: NewsListView, show: (page: number) => void): HTMLElement {
    return h('div', { class: 'container' },
        pageHead('Journal de bord', 'Actualités'),
        h('div', { class: 'box pad' },
            view.items.length > 0
                ? h('div', { class: 'news-list' }, ...view.items.map((item) => newsCard(item)))
                : emptyState('Aucune actualité', 'Les annonces de l\'équipe eMush apparaîtront ici.')),
        pagerControl(view.pager, (page) => void show(page)));
}

export function renderArticle(context: PageContext, id: number): Promise<void> {
    return showLoaded(context, () => bridge.load('article', id), (view) => articlePage(view));
}

function articlePage(view: ArticleView): HTMLElement {
    return h('div', { class: 'container' },
        h('div', {}, h('button', { class: 'link-btn', type: 'button', onclick: () => bridge.navigate({ page: 'news' }) }, '◂ Toutes les actualités')),
        h('article', { class: 'frame article' },
            h('span', { class: 'label' }, view.date ?? 'Actualité'),
            h('h1', {}, view.title),
            renderRich(view.content)));
}
