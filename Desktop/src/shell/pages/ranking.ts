import type { Language, RankingSort } from '../../main/api/models';
import type { RankingView } from '../../main/pages/view';
import { bridge } from '../bridge';
import { h } from '../dom';
import { PageContext, showLoaded } from '../page';
import { clickableRow, emptyState, icon, pageHead, pagerControl, segmented } from '../ui';

type Filters = { language: Language | null; sort: RankingSort; page: number };

const LANGUAGE_OPTIONS: { value: Language | null; label: string }[] = [
    { value: null, label: 'Toutes' },
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
];

const SORT_OPTIONS: { value: RankingSort; label: string }[] = [
    { value: 'cycles_survived', label: 'Survie' },
    { value: 'human_triumph_sum', label: 'Triomphe humain' },
    { value: 'mush_triumph_sum', label: 'Triomphe Mush' },
];

export function renderRanking(context: PageContext): Promise<void> {
    const show = (filters: Filters): Promise<void> =>
        showLoaded(context, () => bridge.load('ranking', filters), (view) => rankingPage(view, filters, show));

    return show({ language: null, sort: 'cycles_survived', page: 1 });
}

function rankingPage(view: RankingView, filters: Filters, show: (filters: Filters) => void): HTMLElement {
    const table = h('table', { class: 'data' },
        h('thead', {}, h('tr', {},
            h('th', {}, '#'),
            h('th', {}, 'Fin du voyage'),
            h('th', { class: 'num' }, 'Jours'),
            h('th', { class: 'num' }, 'Cycles'),
            h('th', { class: 'num' }, icon('triumph'), 'Triomphe humain'),
            h('th', { class: 'num' }, icon('triumph'), 'Meilleur triomphe'),
            h('th', { class: 'num' }, icon('triumph_mush'), 'Triomphe Mush'))),
        h('tbody', {}, ...view.rows.map((row) => clickableRow([
            h('td', {}, h('span', { class: row.rank <= 3 ? 'rank top' : 'rank' }, row.rank)),
            h('td', {}, row.endCause),
            h('td', { class: 'num' }, row.days),
            h('td', { class: 'num' }, row.cycles),
            h('td', { class: 'num' }, row.humanTriumph),
            h('td', { class: 'num' }, row.bestHumanTriumph),
            h('td', { class: 'num' }, row.mushTriumph),
        ], () => bridge.navigate({ page: 'ship', id: row.shipId }), `Voir le vaisseau classé ${row.rank}`))));

    return h('div', { class: 'container' },
        pageHead('Hall of fame', 'Classement des vaisseaux',
            segmented(LANGUAGE_OPTIONS, filters.language, (language) => show({ ...filters, language, page: 1 }), 'Langue'),
            segmented(SORT_OPTIONS, filters.sort, (sort) => show({ ...filters, sort, page: 1 }), 'Trier par')),
        view.rows.length > 0
            ? h('div', { class: 'box table-wrap' }, table)
            : h('div', { class: 'box' }, emptyState('Aucun vaisseau', 'Aucun vaisseau terminé pour ce filtre.')),
        h('p', { class: 'label' }, 'Clique sur un vaisseau pour voir son équipage et la fin de son histoire.'),
        pagerControl(view.pager, (page) => show({ ...filters, page })));
}
