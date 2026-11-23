import type { DeathChoice, DeathView, RichLine } from '../../main/pages/view';
import { bridge } from '../bridge';
import { h } from '../dom';
import { PageContext, showLoaded } from '../page';
import { renderLine } from '../richText';
import { emptyState, figure, headUrl, icon, portraitUrl, sectionTitle, segmented } from '../ui';

const LINES_SHOWN = 8;

export function renderDeath(context: PageContext): Promise<void> {
    return showLoaded(context, () => bridge.load('death'), deathPage);
}

function deathPage(view: DeathView): HTMLElement {
    if (view.status === 'signed-out') {
        return notice('Connecte-toi', 'Ton épitaphe t\'attend après la connexion.',
            h('button', { class: 'btn red', type: 'button', onclick: () => bridge.command('login') }, 'Se connecter'));
    }
    if (view.status === 'no-character') {
        return notice('Aucune aventure à clore', 'Tu n\'as pas de personnage en cours.',
            h('button', { class: 'btn red', type: 'button', onclick: () => bridge.navigate({ page: 'crew' }) }, 'Trouver un équipage'));
    }
    if (view.status === 'alive') {
        return notice('Ton personnage est en vie', 'L\'épitaphe s\'écrit à la fin de l\'aventure. En attendant, l\'équipage compte sur toi.',
            h('button', { class: 'btn red', type: 'button', onclick: () => bridge.navigate({ page: 'game' }) }, 'Reprendre la partie'));
    }

    const liked = new Set<number>();
    const epitaph = h('textarea', {
        class: 'epitaph-input',
        maxlength: view.maxLength,
        rows: 4,
        placeholder: 'Laisse tes impressions sur la partie ici !',
        'aria-label': 'Ton épitaphe',
    });
    const counter = h('span', { class: 'epitaph-count' }, `${view.maxLength}`);
    epitaph.addEventListener('input', () => {
        counter.textContent = String(view.maxLength - epitaph.value.length);
    });

    const sheet = h('section', { class: 'box death-sheet' },
        h('img', { class: 'death-portrait', src: portraitUrl(view.character.key), alt: '' }),
        figure(view.character.key),
        h('div', { class: 'death-titles' },
            h('span', { class: 'label' }, view.endCause.good ? 'Fin de l\'aventure' : 'Tu es mort'),
            h('h1', {}, view.character.name),
            h('p', { class: 'death-cause' }, icon(view.endCause.good ? 'alive' : 'dead'), view.endCause.title),
            view.endCause.description ? h('p', { class: 'muted' }, view.endCause.description) : null),
        h('div', { class: view.isMush ? 'slot kpi mush' : 'slot kpi' },
            icon(view.isMush ? 'triumph_mush' : 'triumph', 'x2'), h('b', {}, view.triumph), h('span', {}, 'triomphe')));

    const epitaphBox = h('section', { class: 'frame pad' },
        sectionTitle('Ton épitaphe', undefined, counter),
        epitaph,
        h('p', { class: 'muted' }, 'Elle sera affichée sur la page de fin du vaisseau, avec le classement de l\'équipage.'));

    const crew = h('section', { class: 'box table-wrap' }, h('table', { class: 'data' },
        h('thead', {}, h('tr', {},
            h('th', {}, 'Équipier'),
            h('th', {}, 'Mort'),
            h('th', {}, 'Cause'),
            h('th', { class: 'num' }, 'J\'aime'))),
        h('tbody', {}, ...view.crew.map((mate) => {
            const button = h('button', { class: 'like', type: 'button', 'aria-pressed': 'false', title: `J'aime ${mate.name}` },
                h('b', {}, mate.likes), icon('like'));
            button.addEventListener('click', () => {
                const on = !liked.has(mate.playerId);
                if (on) {
                    liked.add(mate.playerId);
                } else {
                    liked.delete(mate.playerId);
                }
                button.setAttribute('aria-pressed', String(on));
                (button.firstChild as HTMLElement).textContent = String(mate.likes + (on ? 1 : 0));
            });

            return h('tr', {},
                h('td', {}, h('span', { class: 'who' }, h('img', { class: 'head', src: headUrl(mate.characterKey), alt: '' }), h('span', {}, mate.name))),
                h('td', {}, mate.death),
                h('td', {}, mate.cause),
                h('td', { class: 'num' }, button));
        }))));

    const close = h('button', { class: 'btn red big block', type: 'button', onclick: () => confirmEnd(view, epitaph.value, [...liked]) }, 'Valider et continuer');

    return h('div', { class: 'container death' },
        sheet,
        h('div', { class: 'two-cols' },
            h('div', { class: 'stack' }, epitaphBox, history(view)),
            h('div', { class: 'stack' },
                sectionTitle('L\'équipage'),
                view.crew.length > 0 ? crew : h('p', { class: 'muted' }, 'Personne d\'autre à bord.'),
                h('p', { class: 'muted' }, 'Tu seras prévenu quand le classement de fin de partie sera publié.'),
                close)));
}

/** "Grands moments" and "Historique de triomphe", as tabs. */
function history(view: DeathChoice): HTMLElement {
    const body = h('div', { class: 'history-lines' });
    const tabs: { value: 'highlights' | 'triumph'; label: string }[] = [
        { value: 'highlights', label: 'Grands moments' },
        { value: 'triumph', label: 'Historique de triomphe' },
    ];
    const box = h('section', { class: 'frame pad' });
    const show = (tab: 'highlights' | 'triumph'): void => {
        const lines = tab === 'highlights' ? view.highlights : view.triumphGains;
        body.replaceChildren(lineList(lines));
        box.replaceChildren(segmented(tabs, tab, show, 'Historique'), body);
    };
    show('highlights');

    return box;
}

function lineList(lines: RichLine[]): HTMLElement {
    if (lines.length === 0) {
        return h('p', { class: 'muted' }, 'Rien de marquant.');
    }
    const list = h('ul', { class: 'bullets' }, ...lines.slice(0, LINES_SHOWN).map((line) => h('li', {}, renderLine(line))));
    if (lines.length > LINES_SHOWN) {
        const more = h('button', { class: 'btn quiet', type: 'button' }, `Voir les ${lines.length - LINES_SHOWN} autres`);
        more.addEventListener('click', () => {
            list.replaceChildren(...lines.map((line) => h('li', {}, renderLine(line))));
            more.remove();
        });
        return h('div', {}, list, more);
    }

    return list;
}

function notice(title: string, text: string, action: HTMLElement): HTMLElement {
    return h('div', { class: 'container' }, h('div', { class: 'box' }, emptyState(title, text, action)));
}

/** Closing the adventure can't be undone: always confirmed first. */
function confirmEnd(view: DeathChoice, message: string, likedPlayers: number[]): void {
    const error = h('p', { class: 'error-text', role: 'alert' });
    const cancel = h('button', { class: 'btn quiet', type: 'button' }, 'Annuler');
    const confirm = h('button', { class: 'btn red', type: 'button' }, 'Clore l\'aventure');
    const summary = message.trim() === ''
        ? 'Tu n\'as pas écrit d\'épitaphe.'
        : `Ton épitaphe : « ${message.trim().slice(0, 140)}${message.trim().length > 140 ? '…' : ''} »`;
    const dialog = h('dialog', { 'aria-labelledby': 'end-title' },
        h('h2', { class: 'title', id: 'end-title' }, `Clore l'aventure de ${view.character.name} ?`),
        h('p', {}, summary),
        h('p', { class: 'muted' }, likedPlayers.length > 0 ? `${likedPlayers.length} équipier(s) aimé(s).` : 'Tu n\'as aimé aucun équipier.'),
        h('p', {}, 'Ni l\'épitaphe ni les « J\'aime » ne pourront être modifiés ensuite.'),
        error,
        h('div', { class: 'actions' }, cancel, confirm));

    cancel.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove());
    confirm.addEventListener('click', async () => {
        confirm.disabled = true;
        cancel.disabled = true;
        confirm.textContent = 'Envoi…';
        const result = await bridge.endAdventure({ playerId: view.playerId, message, likedPlayers });
        if (result.ok) {
            dialog.close(); // The main process now shows the home page.
            return;
        }
        error.textContent = result.message;
        confirm.textContent = 'Réessayer';
        confirm.disabled = false;
        cancel.disabled = false;
    });

    document.body.append(dialog);
    dialog.showModal();
}
