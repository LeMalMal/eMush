import type { ProfileView } from '../../main/pages/view';
import { bridge } from '../bridge';
import { h } from '../dom';
import { PageContext, showLoaded } from '../page';
import { clickableRow, emptyState, headUrl, icon, pagerControl, sectionTitle } from '../ui';

export function renderProfile(context: PageContext, userId: string | null): Promise<void> {
    const show = (page: number): Promise<void> =>
        showLoaded(context, () => bridge.load('profile', { userId, page }), (view) => profilePage(view, show));

    return show(1);
}

function profilePage(view: ProfileView, show: (page: number) => void): HTMLElement {
    const head = h('section', { class: 'box profile-head' },
        h('div', { class: 'slot avatar', 'aria-hidden': 'true' }, view.username.slice(0, 1).toUpperCase()),
        h('div', { class: 'titles' },
            h('span', { class: 'label' }, view.isMe ? 'Ton profil' : 'Profil'),
            h('h1', {}, view.username),
            view.memberSince ? h('span', { class: 'muted' }, `À bord depuis le ${view.memberSince}`) : null),
        h('div', { class: 'kpis' },
            h('div', { class: 'slot kpi' }, icon('xp', 'x2'), h('b', {}, view.points), h('span', {}, 'points de succès')),
            h('div', { class: 'slot kpi' }, icon('sol', 'x2'), h('b', {}, view.shipsPlayed), h('span', {}, 'vaisseaux terminés'))),
        view.isMe ? h('button', { class: 'btn quiet', type: 'button', onclick: () => bridge.command('logout') }, 'Se déconnecter') : null);

    const statistics = h('section', { class: 'frame pad' },
        sectionTitle('Statistiques'),
        view.statistics.length > 0
            ? h('div', { class: 'chips' }, ...view.statistics.map((stat) => h('div', { class: stat.isRare ? 'chip rare' : 'chip', title: stat.description },
                h('b', {}, `${stat.name} ${stat.count}`), h('span', {}, stat.description))))
            : h('p', { class: 'muted' }, 'Elles apparaîtront après ta première partie.'));

    const achievements = h('section', { class: 'frame pad' },
        sectionTitle('Succès'),
        view.achievements.length > 0
            ? h('div', { class: 'chips' }, ...view.achievements.map((achievement) => h('div', { class: achievement.isRare ? 'chip rare' : 'chip', title: achievement.description },
                h('b', {}, achievement.name), h('span', {}, `+${achievement.points} · ${achievement.description}`))))
            : h('p', { class: 'muted' }, 'Aucun succès débloqué pour l\'instant.'));

    const history = view.history.length > 0
        ? h('div', { class: 'box table-wrap' }, h('table', { class: 'data' },
            h('thead', {}, h('tr', {},
                h('th', {}, 'Personnage'),
                h('th', {}, 'Fin'),
                h('th', {}, 'Mort'),
                h('th', { class: 'num' }, icon('triumph'), 'Triomphe'))),
            h('tbody', {}, ...view.history.map((row) => clickableRow([
                h('td', {}, h('span', { class: 'who' },
                    h('img', { class: 'head', src: headUrl(row.characterKey), alt: '' }),
                    h('span', {}, row.characterName),
                    row.wasMush ? h('span', { class: 'tag alert' }, 'Mush') : null)),
                h('td', {}, row.endCause),
                h('td', {}, row.death),
                h('td', { class: 'num' }, row.triumph),
            ], () => bridge.navigate({ page: 'ship', id: row.shipId }), `Voir la partie de ${row.characterName}`)))))
        : h('div', { class: 'box' }, emptyState('Aucune partie terminée',
            view.isMe ? 'Ton historique apparaîtra ici après ton premier voyage.' : 'Ce joueur n\'a pas encore terminé de partie.',
            view.isMe ? h('button', { class: 'btn red', type: 'button', onclick: () => bridge.command('play') }, 'Trouver un équipage') : undefined));

    return h('div', { class: 'container' },
        head,
        h('div', { class: 'two-cols' }, statistics, achievements),
        sectionTitle('Historique des parties'),
        history,
        pagerControl(view.pager, (page) => show(page)));
}
