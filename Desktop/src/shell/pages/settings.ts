import type { AppSettings, ChatTextSize, GameLanguage, GameLanguageSetting } from '../../main/background/settingsModel';
import type { SettingsView } from '../../main/pages/view';
import { bridge } from '../bridge';
import { h } from '../dom';
import { PageContext, showLoaded } from '../page';
import { pageHead, sectionTitle, segmented } from '../ui';

type BooleanKey = { [K in keyof AppSettings]: AppSettings[K] extends boolean ? K : never }[keyof AppSettings];

const TEXT_SIZE_CHOICES: { value: ChatTextSize; label: string }[] = [
    { value: 'small', label: 'Petit' },
    { value: 'normal', label: 'Normal' },
    { value: 'large', label: 'Grand' },
    { value: 'larger', label: 'Très grand' },
];

const LANGUAGE_NAMES: Record<GameLanguage, string> = { fr: 'Français', en: 'English', es: 'Español' };
const LANGUAGE_CHOICES: { value: GameLanguageSetting; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    ...(['fr', 'en', 'es'] as const).map((language) => ({ value: language, label: LANGUAGE_NAMES[language] })),
];

export function renderSettings(context: PageContext): Promise<void> {
    return showLoaded(context, () => bridge.load('settings'), (view) => settingsPage(view, context));
}

function settingsPage(initial: SettingsView, context: PageContext): HTMLElement {
    let view = initial;
    const container = h('div', { class: 'container' });

    const save = async (change: Partial<AppSettings>): Promise<void> => {
        const next = await bridge.updateSettings(change as Record<string, boolean | number | string>);
        if (next !== null && context.root.contains(container)) {
            view = next;
            draw();
        }
    };

    const toggle = (key: BooleanKey, label: string, help: string, disabled = false): HTMLElement => {
        const id = `setting-${key}`;
        return h('label', { class: disabled ? 'setting disabled' : 'setting', for: id },
            h('input', {
                id,
                type: 'checkbox',
                class: 'pixel-check',
                checked: view.settings[key],
                disabled,
                onchange: (event: Event) => void save({ [key]: (event.target as HTMLInputElement).checked }),
            }),
            h('span', { class: 'setting-text' }, h('b', {}, label), h('span', {}, help)));
    };

    const draw = (): void => {
        const { settings, client } = view;
        const zoomLabel = settings.gameZoomOffset === 0
            ? (settings.gameAutoZoom ? 'Ajusté à la fenêtre' : 'Taille réelle')
            : `${settings.gameZoomOffset > 0 ? '+' : ''}${Math.round(settings.gameZoomOffset * 100)} %`;

        container.replaceChildren(
            pageHead('Configuration', 'Réglages'),
            h('div', { class: 'two-cols' },
                h('section', { class: 'frame pad' },
                    sectionTitle('Notifications'),
                    h('p', { class: 'muted' }, 'Envoyées par Windows quand la fenêtre d’eMush n’est pas au premier plan.'),
                    toggle('newCycles', 'Nouveaux cycles', 'Toutes les 3 heures, quand tes points d’action sont rechargés.'),
                    toggle('newDays', 'Nouveaux jours', 'Au début de chaque jour à bord.'),
                    toggle('messages', 'Messages du chat', 'Avec le nom de l’auteur et le début du message.'),
                    h('div', { class: 'setting-children' },
                        toggle('messagesPublic', 'Canal public', 'La discussion de tout l’équipage.', !settings.messages),
                        toggle('messagesPrivate', 'Canaux privés', 'Tes conversations privées.', !settings.messages),
                        toggle('messagesMush', 'Canal Mush', 'Si tu es Mush.', !settings.messages)),
                    toggle('mentions', 'Quand on parle de toi', 'Un message qui cite le nom de ton personnage, même dans un canal coupé.'),
                    toggle('alerts', 'Alertes du vaisseau', 'Incendie, hunters, oxygène, coque… dès qu’une alerte apparaît.'),
                    h('div', { class: 'toolbar' }, h('button', { class: 'btn', type: 'button', onclick: () => bridge.command('test-notification') }, 'Tester une notification'))),
                h('section', { class: 'frame pad' },
                    sectionTitle('Arrière-plan'),
                    toggle('closeToTray', 'Fermer garde eMush en arrière-plan', 'La croix réduit eMush près de l’horloge au lieu de le quitter.'),
                    toggle('minimizeToTray', 'Réduire près de l’horloge', 'Le bouton « réduire » cache la fenêtre au lieu de la mettre dans la barre des tâches.'),
                    toggle('launchAtStartup', 'Lancer avec Windows', client.canLaunchAtStartup ? 'eMush démarre à l’ouverture de ta session.' : 'Disponible dans la version installée de l’application.', !client.canLaunchAtStartup),
                    toggle('startMinimized', 'Démarrer en arrière-plan', 'Au lancement avec Windows, rester près de l’horloge sans ouvrir la fenêtre.', !settings.launchAtStartup))),
            h('div', { class: 'two-cols' },
                h('section', { class: 'frame pad' },
                    sectionTitle('Affichage du jeu'),
                    h('div', { class: 'zoom-row' },
                        h('span', { class: 'setting-text' },
                            h('b', {}, 'Langue du jeu'),
                            h('span', {}, `Menus, boutons et chat du jeu. Auto : la langue de Windows (${LANGUAGE_NAMES[client.systemGameLanguage]}).`)),
                        segmented(LANGUAGE_CHOICES, settings.gameLanguage, (gameLanguage) => void save({ gameLanguage }), 'Langue du jeu')),
                    toggle('spellcheck', 'Correcteur orthographique', 'Souligne les fautes dans le chat, dans la langue du jeu. Corrections au clic droit.'),
                    toggle('gameAutoZoom', 'Agrandir le jeu automatiquement', 'Le jeu remplit la fenêtre par paliers de 25 %, pixel art net.'),
                    toggle('darkChat', 'Chat sombre', 'Le chat du jeu aux couleurs du client, plus lisible : messages, actions, gains et logs secrets bien distincts.'),
                    toggle('largeChat', 'Chat agrandi', 'Le chat occupe toute la hauteur du jeu, et la largeur libre sur un écran large.'),
                    h('div', { class: 'zoom-row' },
                        h('span', { class: 'setting-text' }, h('b', {}, 'Taille du texte du chat'), h('span', {}, 'Messages, logs et zone de saisie ; les portraits et icônes gardent leur taille.')),
                        segmented(TEXT_SIZE_CHOICES, settings.chatTextSize, (chatTextSize) => void save({ chatTextSize }), 'Taille du texte du chat')),
                    toggle('markMessages', 'Repérer tes messages et les mentions', 'Tes messages ont un liseré vert, ceux qui citent ton personnage un halo rose.'),
                    h('div', { class: 'zoom-row' },
                        h('span', { class: 'setting-text' }, h('b', {}, 'Ajustement du zoom'), h('span', {}, 'Aussi avec Ctrl + / Ctrl − dans le jeu, Ctrl + 0 pour revenir.')),
                        h('div', { class: 'stepper' },
                            h('button', { class: 'btn quiet', type: 'button', 'aria-label': 'Réduire le zoom', disabled: settings.gameZoomOffset <= -2, onclick: () => void save({ gameZoomOffset: settings.gameZoomOffset - 0.25 }) }, '−'),
                            h('span', { class: 'label' }, zoomLabel),
                            h('button', { class: 'btn quiet', type: 'button', 'aria-label': 'Augmenter le zoom', disabled: settings.gameZoomOffset >= 2, onclick: () => void save({ gameZoomOffset: settings.gameZoomOffset + 0.25 }) }, '+')))),
                h('section', { class: 'frame pad' },
                    sectionTitle('À propos'),
                    h('p', {}, h('b', {}, `eMush Desktop ${client.version}`), ' · client non officiel pour jouer à eMush.'),
                    h('p', { class: 'muted' }, 'Code sous licence AGPL-3.0. Images, sons et polices du jeu : Motion Twin et l’équipe eMush, sous licence CC-BY-NC-SA-4.0. Non affilié à Eternaltwin ni à Motion Twin.'),
                    h('div', { class: 'toolbar' }, h('button', { class: 'btn quiet', type: 'button', onclick: () => bridge.openLink(client.sourceCodeUrl) }, 'Code source ›')))));
    };

    draw();

    return container;
}
