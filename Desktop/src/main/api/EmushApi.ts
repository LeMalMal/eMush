import {
    Account, Achievement, ChannelSummary, ChatMessage, CrewOffer, GameCounters, Language, NewsArticle, NewsSummary, Page, PlayerSummary,
    RankedShip, RankingSort, ShipAlert, ShipHistoryEntry, Statistic,
} from './models';
import {
    parseAccount, parseAchievements, parseAlerts, parseApiError, parseArticle, parseChannels, parseCounters, parseCrewOffer, parseNewsPage,
    parseMessages, parsePlayer, parseRanking, parseShipHistory, parseStatistics,
} from './parsers';

export type HttpResponse = { status: number; json(): Promise<unknown> };

/** HTTP with the player's session cookies. Injected so tests run against an in-memory server. */
export interface Http {
    /** `accept` defaults to application/json; JSON-LD is used where the total count is needed. */
    get(url: string, accept?: string): Promise<HttpResponse>;
    post(url: string, body: unknown): Promise<HttpResponse>;
}

export class ApiUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ApiUnavailableError';
    }
}

export type JoinResult = { ok: true } | { ok: false; message: string };

const UNAUTHENTICATED = new Set([401, 403]);

/** Access to the parts of the eMush API the client uses. Every response is parsed defensively. */
export class EmushApi {
    private readonly apiBase: URL;

    constructor(serverUrl: URL, private readonly http: Http) {
        this.apiBase = new URL('/api/v1/', serverUrl);
    }

    /** The signed-in account, or null when the player is not logged in. */
    async me(): Promise<Account | null> {
        const response = await this.get('users/me');
        if (UNAUTHENTICATED.has(response.status)) {
            return null;
        }

        return parseAccount(await this.json(response, 'users/me'));
    }

    async user(uuid: string): Promise<Account | null> {
        const response = await this.get(`users/${encodeURIComponent(uuid)}`);

        return response.status === 200 ? parseAccount(await response.json()) : null;
    }

    async player(playerId: number): Promise<PlayerSummary | null> {
        const response = await this.get(`player/${playerId}`);

        return response.status === 200 ? parsePlayer(await response.json()) : null;
    }

    async news(page: number, perPage: number): Promise<Page<NewsSummary>> {
        const query = new URLSearchParams({ isPublished: 'true', 'order[publicationDate]': 'DESC', itemsPerPage: String(perPage), page: String(page) });
        const response = await this.get(`news?${query}`, 'application/ld+json');

        return parseNewsPage(await this.json(response, 'news'));
    }

    async article(id: number): Promise<NewsArticle | null> {
        const response = await this.get(`news/${id}`);

        return response.status === 200 ? parseArticle(await response.json()) : null;
    }

    async counters(): Promise<GameCounters | null> {
        const response = await this.get('game-counters?v=2');

        return response.status === 200 ? parseCounters(await response.json()) : null;
    }

    async ranking(options: { language: Language | null; sort: RankingSort; page: number; perPage: number }): Promise<Page<RankedShip>> {
        const query = new URLSearchParams({
            language: options.language ?? '',
            page: String(options.page),
            itemsPerPage: String(options.perPage),
            sort: options.sort,
        });
        const response = await this.get(`daedaluses/ranking?${query}`);

        return parseRanking(await this.json(response, 'ranking'));
    }

    async shipHistory(uuid: string, page: number, perPage: number): Promise<Page<ShipHistoryEntry>> {
        const query = new URLSearchParams({ userId: uuid, page: String(page), itemsPerPage: String(perPage), language: 'fr' });
        const response = await this.get(`players/ships-history?${query}`);

        return parseShipHistory(await this.json(response, 'ships-history'));
    }

    async statistics(uuid: string): Promise<Statistic[]> {
        const response = await this.get(`statistics?${new URLSearchParams({ userId: uuid, language: 'fr', gender: 'male' })}`);

        return response.status === 200 ? parseStatistics(await response.json()) : [];
    }

    async achievements(uuid: string): Promise<Achievement[]> {
        const response = await this.get(`achievements?${new URLSearchParams({ userId: uuid, language: 'fr', gender: 'male' })}`);

        return response.status === 200 ? parseAchievements(await response.json()) : [];
    }

    /** Chat channels of the active player, with unread counts (empty when not in a game). */
    async channels(): Promise<ChannelSummary[]> {
        const response = await this.get('channel');

        return response.status === 200 ? parseChannels(await response.json()) : [];
    }

    /** Current alerts of a Daedalus. */
    async alerts(shipId: number): Promise<ShipAlert[]> {
        const response = await this.get(`alert/${shipId}/alerts`);

        return response.status === 200 ? parseAlerts(await response.json()) : [];
    }

    /** Recent messages of a channel (newest first), with replies. */
    async channelMessages(channelId: number): Promise<ChatMessage[]> {
        const response = await this.get(`channel/${channelId}/message?timeLimit=24`);

        return response.status === 200 ? parseMessages(await response.json()) : [];
    }

    /** The ship currently boarding for this language, created by the server if needed (as the web client does). */
    async crewOffer(language: Language): Promise<CrewOffer | null> {
        const response = await this.get(`daedaluses/available-characters?${new URLSearchParams({ language })}`);

        return response.status === 200 ? parseCrewOffer(await response.json()) : null;
    }

    /** Joins a ship with a character: the same request as the web client's character selection. */
    async joinShip(accountUuid: string, shipId: number, characterKey: string): Promise<JoinResult> {
        let response: HttpResponse;
        try {
            response = await this.http.post(this.url('player'), { user: accountUuid, daedalus: shipId, character: characterKey });
        } catch (error) {
            return { ok: false, message: `Serveur injoignable : ${error instanceof Error ? error.message : String(error)}` };
        }
        if (response.status === 200 || response.status === 201) {
            return { ok: true };
        }
        const detail = parseApiError(await response.json().catch(() => null));

        return { ok: false, message: detail ?? `Le serveur a refusé l'embarquement (erreur ${response.status}).` };
    }

    private url(path: string): string {
        return new URL(path, this.apiBase).toString();
    }

    private async get(path: string, accept?: string): Promise<HttpResponse> {
        try {
            return await this.http.get(this.url(path), accept);
        } catch (error) {
            throw new ApiUnavailableError(`eMush API unreachable (${path}): ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async json(response: HttpResponse, path: string): Promise<unknown> {
        if (response.status !== 200) {
            throw new ApiUnavailableError(`eMush API answered ${response.status} for ${path}`);
        }

        return response.json();
    }
}
