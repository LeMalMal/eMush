import { EmushApi } from '../api/EmushApi';
import { Account, GameCounters, NewsSummary, PlayerSummary } from '../api/models';
import { characterFullName } from './characters';
import { formatCountdown, formatDate, formatDayCycle, formatNumber } from './format';
import { load } from './load';
import { orbitView } from './orbit';
import { AccountView, HomeView, Loaded, NewsCard, Tag } from './view';

const NEWS_ON_HOME = 3;

export type HomeInputs = {
    account: Account | null;
    player: PlayerSummary | null;
    news: NewsSummary[];
    counters: GameCounters | null;
    now: Date;
};

export function toNewsCard(item: NewsSummary): NewsCard {
    return { id: item.id, title: item.title, excerpt: item.excerpt, date: formatDate(item.publishedAt), pinned: item.isPinned };
}

/** What the home page shows. Pure: every player situation is unit-tested. */
export function buildHomeView({ account, player, news, counters, now }: HomeInputs): HomeView {
    const common = {
        username: account?.username ?? null,
        news: news.map(toNewsCard),
        counters: counters === null ? [] : [
            { label: 'Daedalus en vol', value: formatNumber(counters.shipsInFlight) },
            { label: 'Mush éliminés', value: formatNumber(counters.mushKilled) },
            { label: 'expéditions lancées', value: formatNumber(counters.expeditionsStarted) },
        ],
    };

    if (account === null) {
        return {
            ...common,
            status: 'signed-out',
            ship: {
                eyebrow: 'Bienvenue à bord',
                title: 'Connecte-toi pour embarquer',
                tags: [],
                text: 'Ton compte Eternaltwin sert pour eMush et tous les jeux de l\'association.',
                characterKey: null,
            },
            primary: { label: 'Se connecter', command: 'login' },
        };
    }

    if (!account.hasAcceptedRules) {
        return {
            ...common,
            status: 'rules',
            ship: {
                eyebrow: 'Avant d\'embarquer',
                title: 'Lis le règlement',
                tags: [{ label: 'Une seule fois', tone: 'neutral' }],
                text: 'Le règlement de bord doit être accepté avant de rejoindre ton premier équipage.',
                characterKey: null,
            },
            primary: { label: 'Lire le règlement', command: 'play' },
        };
    }

    if (player === null) {
        return {
            ...common,
            status: 'no-character',
            ship: {
                eyebrow: 'Ton vaisseau',
                title: 'Aucun équipage',
                tags: [{ label: 'Prêt à embarquer', tone: 'neutral' }],
                text: 'Choisis ton personnage et rejoins un Daedalus : le départ est donné quand les 16 places sont prises.',
                characterKey: null,
            },
            primary: { label: 'Trouver un équipage', command: 'play' },
        };
    }

    const when = formatDayCycle(player.day, player.cycle);
    const name = characterFullName(player.characterKey, player.characterName);

    if (player.status === 'in_game') {
        const nextCycle = formatCountdown(player.nextCycleAt, now);

        return {
            ...common,
            status: 'alive',
            ship: {
                eyebrow: 'Ton vaisseau',
                title: when ?? 'Partie en cours',
                tags: [
                    { label: `${name} · en vie`, tone: 'ok' },
                    ...(nextCycle ? [{ label: `Prochain cycle dans ${nextCycle}`, tone: 'neutral' as const }] : []),
                    ...orbitTags(player),
                ],
                text: 'L\'équipage compte sur toi. Chaque cycle te rend des points d\'action : ne les laisse pas se perdre.',
                characterKey: player.characterKey,
            },
            primary: { label: 'Reprendre la partie', command: 'play' },
        };
    }

    return {
        ...common,
        status: 'dead',
        ship: {
            eyebrow: 'Fin de l\'aventure',
            title: `${name} est tombé${when ? ` · ${when}` : ''}`,
            tags: [{ label: 'Épitaphe à écrire', tone: 'alert' }],
            text: 'Laisse ton épitaphe et salue l\'équipage pour clore l\'aventure, puis repars sur un nouveau Daedalus.',
            characterKey: player.characterKey,
        },
        primary: { label: 'Écrire ton épitaphe', command: 'play' },
    };
}

/** "En orbite" with the planet's picture, or "En déplacement": the Daedalus' position at a glance. */
function orbitTags(player: PlayerSummary): Tag[] {
    const orbit = orbitView(player.ship.position);
    if (orbit === null) {
        return [];
    }

    return [{ label: orbit.title, tone: 'neutral', ...(orbit.image ? { image: orbit.image } : {}) }];
}

/** The signed-in player's name for the navigation bar (null when signed out). */
export class LoadAccount {
    constructor(private readonly api: EmushApi) {}

    execute(): Promise<Loaded<AccountView>> {
        return load(async () => ({ username: (await this.api.me())?.username ?? null }));
    }
}

export class LoadHome {
    constructor(private readonly api: EmushApi, private readonly clock: () => Date = () => new Date()) {}

    execute(): Promise<Loaded<HomeView>> {
        return load(async () => {
            const [account, news, counters] = await Promise.all([
                this.api.me(),
                this.api.news(1, NEWS_ON_HOME).then((page) => page.items).catch(() => []),
                this.api.counters().catch(() => null),
            ]);
            const player = account?.playerId ? await this.api.player(account.playerId) : null;

            return buildHomeView({ account, player, news, counters, now: this.clock() });
        });
    }
}
