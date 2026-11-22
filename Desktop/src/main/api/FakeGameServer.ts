import { Http } from './EmushApi';

type Route = { status: number; body: unknown };

/**
 * Handwritten in-memory stand-in for the eMush API, for tests. Sample payloads mirror real
 * responses captured from emush.eternaltwin.org, trimmed to the fields the client reads.
 */
export class FakeGameServer implements Http {
    readonly requests: string[] = [];
    readonly posts: { path: string; body: unknown }[] = [];
    private readonly routes = new Map<string, Route>();
    private readonly postRoutes = new Map<string, Route>();
    private down = false;

    respond(pathAndQuery: string, status: number, body: unknown = null): this {
        this.routes.set(pathAndQuery, { status, body });
        return this;
    }

    respondToPost(path: string, status: number, body: unknown = null): this {
        this.postRoutes.set(path, { status, body });
        return this;
    }

    goOffline(): this {
        this.down = true;
        return this;
    }

    async get(url: string): Promise<{ status: number; json(): Promise<unknown> }> {
        const key = this.key(url);
        this.requests.push(key);

        return this.answer(this.routes.get(key));
    }

    async post(url: string, body: unknown): Promise<{ status: number; json(): Promise<unknown> }> {
        const key = this.key(url);
        this.posts.push({ path: key, body });

        return this.answer(this.postRoutes.get(key));
    }

    private key(url: string): string {
        const { pathname, search } = new URL(url);

        return decodeURIComponent(pathname.replace(/^\/api\/v1\//, '') + search);
    }

    private answer(route: Route | undefined): { status: number; json(): Promise<unknown> } {
        if (this.down) {
            throw new Error('net::ERR_INTERNET_DISCONNECTED');
        }
        const { status, body } = route ?? { status: 404, body: { detail: 'Not Found' } };

        return { status, json: async () => body };
    }
}

export const ACCOUNT_UUID = 'd60eaddd-1fe0-490b-8fe9-da9ae6edca3e';

export const SAMPLE_ACCOUNT = {
    id: 4602,
    userId: ACCOUNT_UUID,
    username: 'lemal',
    roles: ['ROLE_USER'],
    createdAt: '2026-11-21 21:24:29',
    playerInfo: null,
    isBanned: false,
    hasAcceptedRules: true,
};

export const SAMPLE_PLAYER_IN_GAME = {
    id: 812,
    character: { key: 'jin_su', value: 'Jin-Su', description: 'Commandant suprême du Daedalus.' },
    gameStatus: 'in_game',
    triumph: { name: 'Triomphe', quantity: 12 },
    actionPoint: { quantity: 4, max: 12 },
    movementPoint: { quantity: 10, max: 12 },
    room: { key: 'bridge', name: 'Pont' },
    isMush: false,
    titles: [{ id: 'commander', name: 'Commandant', description: 'Le commandant dirige le Daedalus.' }],
    diseases: [{ key: 'flu', name: 'Grippe', type: 'disease', description: 'Fièvre.' }],
    daedalus: {
        id: 77,
        oxygen: { quantity: 24, name: 'Oxygène', description: '' },
        fuel: { quantity: 9, name: 'Fuel', description: '' },
        hull: { quantity: 87, name: 'Coque', description: '' },
        shield: { quantity: 0, name: 'Bouclier plasma', description: '' },
        humanPlayerAlive: 12,
        mushPlayerAlive: 2,
        timer: { name: 'Cycle', timerCycle: '2026-11-21T23:00:00+00:00' },
        calendar: { day: 2, cycle: 3, dayName: 'Jour', cycleName: 'Cycle' },
    },
};

/** `GET player/:id` once the character is dead (DeadPlayerNormalizer), trimmed. */
export const SAMPLE_DEAD_PLAYER = {
    id: 812,
    character: { key: 'jin_su', value: 'Jin-Su' },
    triumph: { name: 'Triomphe', quantity: 47 },
    daedalus: { key: 77, calendar: { day: 9, cycle: 1 } },
    gameStatus: 'finished',
    endCause: { key: 'assassinated', shortName: 'Assassiné', name: 'Assassiné par un équipier', description: 'Un équipier vous a tué.' },
    isMush: false,
    triumphGains: ['8 x Cycle humain ( +8 :triumph: )', '1 x Recherche ( +3 :triumph: )'],
    playerHighlights: ['Vous avez réparé la **Porte** du Pont.'],
    players: [
        { id: 813, character: { key: 'hua', value: 'Hua' }, deathDay: 7, deathCycle: 4, likes: 2, endCause: { key: 'depression', shortName: 'Dépression', name: 'Dépression fatale' } },
        { id: 814, character: { key: 'chun', value: 'Chun' }, deathDay: null, deathCycle: null, likes: 0, endCause: { key: 'still_living', shortName: 'Encore en vie', name: 'Encore en vie' } },
    ],
};

/** `GET closed_daedaluses/:id` (ClosedDaedalusNormalizer), trimmed. */
export const SAMPLE_CLOSED_SHIP = {
    id: 225,
    endCause: 'sol_return',
    endDay: 21,
    endCycle: 4,
    daysSurvived: 21,
    cyclesSurvived: 172,
    humanTriumphSum: 5626,
    mushTriumphSum: 0,
    isCheater: false,
    statistics: { title: 'Statistiques', lines: [{ name: 'Hunters abattus', value: 1203 }, { name: 'Explorations', value: 14 }] },
    titleHolders: {
        commander: { title: 'Commandant', characterKeys: ['jin_su'] },
        neron_manager: { title: 'Responsable NERON', characterKeys: [] },
    },
    funFacts: [{ title: 'Le plus gourmand', description: 'A mangé le plus de rations.', characterKey: 'chun' }],
};

/** `GET closed_daedaluses/:id/players` (ClosedPlayerNormalizer), trimmed. */
export const SAMPLE_CLOSED_CREW = {
    'hydra:member': [
        { id: 4, characterKey: 'chun', userId: ACCOUNT_UUID, username: 'lemal', message: '**Mission\naccomplie** Quel voyage !', endCause: 'sol_return', dayDeath: 21, cycleDeath: 4, likes: 3, isMush: false, score: 120, playerHighlights: ['A réparé **3** équipements.'] },
        { id: 5, characterKey: 'ian', userId: 'not-a-uuid', username: 'ianfan', message: null, endCause: 'assassinated', dayDeath: 6, cycleDeath: 2, likes: 0, isMush: true, score: 210, playerHighlights: [] },
        { id: 6, characterKey: '../etc', username: 'bad', endCause: 'eden', score: 999 },
    ],
};

export const SAMPLE_NEWS = [
    { id: 38, frenchTitle: 'eMush 0.40.0', englishTitle: 'eMush 0.40.0', frenchContent: '**Nouvelles fonctionnalités**//- Nouvelle statistique', publicationDate: '2026-11-21T00:00:00+00:00', isPublished: true, isPinned: false },
    { id: 37, frenchTitle: 'eMush 0.39.0', englishTitle: 'eMush 0.39.0', frenchContent: 'Corrections', publicationDate: '2026-11-04T00:00:00+00:00', isPublished: true, isPinned: true },
];

export const SAMPLE_NEWS_PAGE = { 'hydra:totalItems': 38, 'hydra:member': SAMPLE_NEWS };

export const SAMPLE_COUNTERS = { daedalusesInGame: 15, mushKilled: 2046, messagesSent: 2513725, expeditionsStarted: 5231 };

export const SAMPLE_RANKING = {
    data: [
        { id: 225, endCause: 'Daedalus rentré sur Sol', daysSurvived: 21, cyclesSurvived: 172, humanTriumphSum: '5626 :triumph:', mushTriumphSum: '0 :triumph_mush:', highestHumanTriumph: '483 :triumph:', highestMushTriumph: '0 :triumph_mush:' },
        { id: 7, endCause: "Daedalus s'est installé sur Eden", daysSurvived: 20, cyclesSurvived: 161, humanTriumphSum: '6945 :triumph:', mushTriumphSum: '0 :triumph_mush:', highestHumanTriumph: '585 :triumph:', highestMushTriumph: '0 :triumph_mush:' },
    ],
    totalItems: 645,
};

export const SAMPLE_SHIP_HISTORY = {
    data: [
        { character: 'gioele', dayDeath: 8, cycleDeath: 7, triumph: '113 :triumph:', endCause: 'Daedalus détruit', endCauseKey: 'daedalus_destroyed', isMush: false, daedalusId: 1227 },
        { character: 'terrence', dayDeath: 7, cycleDeath: 1, triumph: '63 :triumph:', endCause: 'Dépression fatale', endCauseKey: 'depression', isMush: true, daedalusId: 1076 },
    ],
    totalItems: 72,
};

export const SAMPLE_STATISTICS = [
    { key: 'back_to_root', name: 'Sol', description: 'Nombre de trajets de retour vers Sol effectués.', isRare: true, count: 27, formattedCount: 'x27' },
];

export const SAMPLE_ACHIEVEMENTS = [
    { key: 'andie_50', name: 'Dans la Fédération je crois !', statisticName: 'Nombre de cycles passés à vénérer la Fédération x50', points: 5, isRare: false },
    { key: 'artefact_coll_1', name: 'Archéologue Inconnu', statisticName: 'Artefacts', points: 10, isRare: true },
];

export const SAMPLE_CREW_OFFER = {
    daedalus: 1244,
    characters: [
        { key: 'andie', name: 'Andie', abstract: 'Andie Graham, sous-lieutenant·e de la FDS.', level: 5, available: true, skills: [{ key: 'confident', name: 'Confident', description: 'Une fois par jour, **1** :pa:.' }] },
        { key: 'jin_su', name: 'Jin-Su', abstract: 'Commandant suprême.', level: 3, available: false, skills: [] },
    ],
};

export const NEWS_ON_HOME = 'news?isPublished=true&order[publicationDate]=DESC&itemsPerPage=3&page=1';
