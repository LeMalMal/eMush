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
    daedalus: {
        id: 77,
        timer: { name: 'Cycle', timerCycle: '2026-11-21T23:00:00+00:00' },
        calendar: { day: 2, cycle: 3, dayName: 'Jour', cycleName: 'Cycle' },
    },
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
