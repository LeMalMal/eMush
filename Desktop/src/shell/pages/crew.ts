import type { Language } from '../../main/api/models';
import type { CrewCharacterView, CrewChoice, CrewView } from '../../main/pages/view';
import { bridge } from '../bridge';
import { h } from '../dom';
import { PageContext, showLoaded } from '../page';
import { renderRich } from '../richText';
import { emptyState, figure, pageHead, portraitUrl, segmented } from '../ui';

const CREW_SIZE = 16;

const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
];

const LANGUAGE_NAMES: Record<Language, string> = { fr: 'francophone', en: 'anglophone', es: 'hispanophone' };

export function renderCrew(context: PageContext): Promise<void> {
    const show = (language: Language): Promise<void> =>
        showLoaded(context, () => bridge.load('crew', language), (view) => crewPage(view, show), 'Recherche d\'un vaisseau…');

    return show('fr');
}

function crewPage(view: CrewView, show: (language: Language) => void): HTMLElement {
    if (view.status === 'signed-out') {
        return notice('Connecte-toi pour embarquer', 'Ton compte Eternaltwin sert pour eMush et tous les jeux de l\'association.',
            h('button', { class: 'btn red', type: 'button', onclick: () => bridge.command('login') }, 'Se connecter'));
    }
    if (view.status === 'rules') {
        return notice('Lis le règlement avant d\'embarquer', 'Il doit être accepté une fois avant ton premier équipage.',
            h('button', { class: 'btn red', type: 'button', onclick: () => bridge.navigate({ page: 'rules' }) }, 'Lire le règlement'));
    }
    if (view.status === 'aboard') {
        return notice('Tu es déjà à bord', 'Un seul personnage à la fois : termine ton aventure en cours avant d\'en commencer une autre.',
            h('button', { class: 'btn red', type: 'button', onclick: () => bridge.navigate({ page: 'game' }) }, 'Reprendre la partie'));
    }

    const available = view.characters.filter((character) => character.available);
    let selected: CrewCharacterView | undefined = available[0];

    const roster = h('div', { class: 'roster', role: 'group', 'aria-label': 'Personnages' });
    const detail = h('aside', { class: 'frame detail', 'aria-live': 'polite' });

    const select = (character: CrewCharacterView): void => {
        selected = character;
        for (const card of roster.querySelectorAll<HTMLButtonElement>('.card-char')) {
            card.setAttribute('aria-pressed', String(card.dataset.key === character.key));
        }
        detail.replaceChildren(...characterDetail(character, view));
    };

    roster.append(...view.characters.map((character) => characterCard(character, character.key === selected?.key, () => select(character))));

    if (selected) {
        detail.replaceChildren(...characterDetail(selected, view));
    } else {
        detail.replaceChildren(h('h2', { class: 'title' }, 'Vaisseau complet'),
            h('p', { class: 'muted' }, 'Tous les personnages sont pris : essaie une autre langue ou reviens dans quelques minutes.'));
    }

    return h('div', { class: 'container crew' },
        pageHead('Trouver un équipage', `Daedalus ${LANGUAGE_NAMES[view.language]}`,
            segmented(LANGUAGE_OPTIONS, view.language, (language) => show(language), 'Langue de l\'équipage')),
        h('div', { class: 'box pad' },
            h('div', { class: 'ship-status' },
                h('b', {}, `${view.aboard} / ${CREW_SIZE} à bord`),
                crewMeter(view.aboard),
                h('span', { class: 'muted' }, 'Le départ est donné quand l\'équipage est complet : deux membres seront alors désignés Mush en secret.')),
            roster),
        detail);
}

function notice(title: string, text: string, action: HTMLElement): HTMLElement {
    return h('div', { class: 'container' }, h('div', { class: 'box' }, emptyState(title, text, action)));
}

/** One square per seat, lit when taken. */
function crewMeter(aboard: number): HTMLElement {
    const seats = Array.from({ length: CREW_SIZE }, (_, index) => h('i', { class: index < aboard ? 'on' : undefined }));

    return h('div', { class: 'meter', role: 'img', 'aria-label': `${aboard} places prises sur ${CREW_SIZE}` }, ...seats);
}

/** Card in the style of the game's character selection: bevelled header with level, portrait. */
function characterCard(character: CrewCharacterView, pressed: boolean, onSelect: () => void): HTMLButtonElement {
    return h('button', {
        class: 'card-char',
        type: 'button',
        'data-key': character.key,
        'aria-pressed': String(pressed),
        disabled: !character.available,
        title: character.available ? character.fullName : `${character.fullName} est déjà à bord`,
        onclick: onSelect,
    },
    h('span', { class: 'head-row' },
        h('span', { class: 'level' }, character.level ?? '?'),
        h('span', { class: 'name' }, character.name)),
    h('span', { class: 'portrait' }, h('img', { src: portraitUrl(character.key), alt: '' })));
}

function characterDetail(character: CrewCharacterView, view: CrewChoice): Node[] {
    return [
        h('div', { class: 'detail-scroll' },
            h('div', { class: 'who-sheet' },
                h('img', { class: 'portrait', src: portraitUrl(character.key), alt: `Portrait de ${character.fullName}` }),
                figure(character.key)),
            h('div', {},
                h('span', { class: 'label' }, character.level !== null ? `Niveau ${character.level}` : 'Personnage'),
                h('h2', {}, character.fullName)),
            character.abstract ? h('p', { class: 'muted' }, character.abstract) : null,
            character.skills.length > 0
                ? h('div', { class: 'skills' }, ...character.skills.map((skill) => h('div', { class: 'skill' }, h('b', {}, skill.name), renderRich(skill.description))))
                : null),
        h('button', { class: 'btn red big block', type: 'button', onclick: () => confirmJoin(character, view) }, `Embarquer avec ${character.name}`),
    ];
}

/** Joining a ship commits the player to a game of several days: always confirmed first. */
function confirmJoin(character: CrewCharacterView, view: CrewChoice): void {
    const message = h('p', {}, `Tu rejoins le Daedalus ${LANGUAGE_NAMES[view.language]} dans la peau de ${character.fullName}. Une partie dure plusieurs jours, à raison d'un cycle toutes les 3 heures.`);
    const error = h('p', { class: 'error-text', role: 'alert' });
    const cancel = h('button', { class: 'btn quiet', type: 'button' }, 'Annuler');
    const confirm = h('button', { class: 'btn red', type: 'button' }, 'Embarquer');
    const fallback = h('button', { class: 'btn', type: 'button', hidden: true }, 'Choisir sur la page web');
    const dialog = h('dialog', { 'aria-labelledby': 'join-title' },
        h('h2', { class: 'title', id: 'join-title' }, `Embarquer avec ${character.name} ?`),
        message, error,
        h('div', { class: 'actions' }, fallback, cancel, confirm));

    cancel.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    fallback.addEventListener('click', () => {
        dialog.close();
        bridge.navigate({ page: 'game' });
    });
    confirm.addEventListener('click', async () => {
        confirm.disabled = true;
        cancel.disabled = true;
        confirm.textContent = 'Embarquement…';
        const result = await bridge.join({ shipId: view.shipId, characterKey: character.key });
        if (result.ok) {
            dialog.close();
            return;
        }
        error.textContent = result.message;
        confirm.textContent = 'Réessayer';
        confirm.disabled = false;
        cancel.disabled = false;
        fallback.hidden = false;
    });

    document.body.append(dialog);
    dialog.showModal();
}
