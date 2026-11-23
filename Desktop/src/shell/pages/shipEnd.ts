import type { ShipCrewCard, ShipEndView } from '../../main/pages/view';
import { bridge } from '../bridge';
import { h } from '../dom';
import { PageContext, showLoaded } from '../page';
import { renderLine } from '../richText';
import { figure, headUrl, icon, portraitUrl, sectionTitle, tagElement } from '../ui';

export function renderShipEnd(context: PageContext, shipId: number): Promise<void> {
    return showLoaded(context, () => bridge.load('ship', shipId), shipEndPage, 'Ouverture des archives du vaisseau…');
}

function shipEndPage(view: ShipEndView): HTMLElement {
    const fullPage = h('button', { class: 'btn quiet', type: 'button', onclick: () => bridge.navigate({ page: 'ship-web', id: view.shipId }) },
        'Projets et explorations (site)');

    const banner = h('section', { class: 'box end-banner' },
        h('img', { class: 'end-art', src: `img/endings/${view.end.image}.png`, alt: '' }),
        h('div', { class: 'end-titles' },
            h('span', { class: 'label' }, `Daedalus n°${view.shipId}`),
            h('h1', {}, view.end.title),
            h('div', { class: 'tags' }, ...view.tags.map(tagElement))),
        h('div', { class: 'end-actions' },
            h('button', { class: 'btn quiet', type: 'button', onclick: () => bridge.navigate({ page: 'ranking' }) }, '◂ Classement'),
            fullPage));

    const sections: (Node | null)[] = [
        banner,
        view.isCheater ? h('p', { class: 'box pad cheater' }, icon('dead'), 'Ce vaisseau a enfreint le règlement : il a été exclu du classement.') : null,
    ];

    if (view.headliner) {
        sections.push(sectionTitle('Tête d\'affiche'), crewCard(view.headliner, 'star'));
    }
    if (view.mainRoles.length > 0) {
        sections.push(sectionTitle('Dans les rôles principaux'), h('div', { class: 'crew-grid' }, ...view.mainRoles.map((card) => crewCard(card, 'main'))));
    }
    if (view.extras.length > 0) {
        sections.push(sectionTitle('Avec la participation de'), h('div', { class: 'crew-grid extras' }, ...view.extras.map((card) => crewCard(card, 'extra'))));
    }
    if (view.statistics.lines.length > 0) {
        sections.push(sectionTitle(view.statistics.title), h('div', { class: 'stats' },
            ...view.statistics.lines.map((line) => h('div', { class: 'slot stat' }, h('b', {}, line.value), h('span', {}, line.name)))));
    }
    if (view.titles.length > 0 || view.funFacts.length > 0) {
        sections.push(h('div', { class: 'two-cols' },
            h('section', { class: 'frame pad' }, sectionTitle('Titres'),
                view.titles.length > 0
                    ? h('ul', { class: 'honours' }, ...view.titles.map((title) => h('li', {}, h('b', {}, title.title), signatures(title.characters))))
                    : h('p', { class: 'muted' }, 'Aucun titre attribué.')),
            h('section', { class: 'frame pad' }, sectionTitle('Faits marquants'),
                view.funFacts.length > 0
                    ? h('ul', { class: 'honours' }, ...view.funFacts.map((fact) => h('li', { title: fact.description },
                        h('b', {}, fact.title), signatures([fact.character]), fact.description ? h('span', { class: 'muted' }, fact.description) : null)))
                    : h('p', { class: 'muted' }, 'Rien de marquant.'))));
    }

    return h('div', { class: 'container ship-end' }, ...sections);
}

function signatures(characters: { key: string; name: string }[]): HTMLElement {
    return h('span', { class: 'signatures' }, ...characters.map((character) =>
        h('span', { class: 'who' }, h('img', { class: 'head', src: headUrl(character.key), alt: '' }), h('span', {}, character.name))));
}

/** A crew member's card: the headliner gets the portrait, the others the pixel figure only. */
function crewCard(card: ShipCrewCard, size: 'star' | 'main' | 'extra'): HTMLElement {
    const player = card.userId
        ? h('button', { class: 'rich-link', type: 'button', onclick: () => bridge.navigate({ page: 'profile', id: card.userId as string }) }, card.username)
        : h('span', {}, card.username);

    return h('article', { class: `box end-card ${size}` },
        size === 'star' ? h('img', { class: 'end-portrait', src: portraitUrl(card.characterKey), alt: '' }) : null,
        figure(card.characterKey),
        h('div', { class: 'end-who' },
            h('h3', {}, card.name),
            h('span', { class: 'end-player' }, player, h('span', { class: 'likes', title: 'J\'aime reçus' }, String(card.likes), icon('like')))),
        h('div', { class: card.isMush ? 'end-score mush' : 'end-score' },
            h('b', {}, card.score), icon(card.isMush ? 'triumph_mush' : 'triumph', 'x2')),
        h('div', { class: 'end-body' },
            h('p', { class: 'end-cause' }, icon(card.good ? 'alive' : 'dead'), card.endCause, card.death ? h('span', { class: 'muted' }, ` · ${card.death}`) : null),
            h('p', { class: 'end-award' }, h('img', { class: 'nova', src: `img/nova/${card.award.image}.png`, alt: '' }), card.award.label),
            card.epitaph ? h('blockquote', { class: 'epitaph' }, '« ', renderLine(card.epitaph), ' »') : null,
            size !== 'extra' && card.highlights.length > 0
                ? h('ul', { class: 'bullets' }, ...card.highlights.map((line) => h('li', {}, renderLine(line))))
                : null));
}
