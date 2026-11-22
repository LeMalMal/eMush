import { describe, expect, it } from 'vitest';
import { EmushApi } from '../api/EmushApi';
import {
    ACCOUNT_UUID, FakeGameServer, NEWS_ON_HOME, SAMPLE_ACCOUNT, SAMPLE_ACHIEVEMENTS, SAMPLE_COUNTERS, SAMPLE_CREW_OFFER,
    SAMPLE_NEWS, SAMPLE_NEWS_PAGE, SAMPLE_PLAYER_IN_GAME, SAMPLE_RANKING, SAMPLE_SHIP_HISTORY, SAMPLE_STATISTICS,
} from '../api/FakeGameServer';
import { JoinCrew, LoadCrew } from './crew';
import { formatCountdown } from './format';
import { LoadHome } from './home';
import { LoadArticle, LoadNews } from './news';
import { LoadProfile } from './profile';
import { LoadRanking, parseRankingRequest } from './ranking';
import { SERVER_UNREACHABLE } from './load';

const server = new URL('https://emush.eternaltwin.org');
const now = () => new Date('2026-11-21T21:18:00Z');
const api = (fake: FakeGameServer) => new EmushApi(server, fake);

function onlineServer(): FakeGameServer {
    return new FakeGameServer()
        .respond(NEWS_ON_HOME, 200, SAMPLE_NEWS_PAGE)
        .respond('game-counters?v=2', 200, SAMPLE_COUNTERS);
}

function viewOf<T>(loaded: { ok: true; view: T } | { ok: false; message: string }): T {
    if (!loaded.ok) {
        throw new Error(`Expected a view, got: ${loaded.message}`);
    }
    return loaded.view;
}

describe('LoadHome', () => {
    it('asks a signed-out player to log in, and still shows the news', async () => {
        const home = viewOf(await new LoadHome(api(onlineServer().respond('users/me', 401)), now).execute());

        expect(home.status).toBe('signed-out');
        expect(home.primary).toEqual({ label: 'Se connecter', command: 'login' });
        expect(home.news.map((n) => n.title)).toEqual(['eMush 0.40.0', 'eMush 0.39.0']);
    });

    it('sends a new player to the rules first', async () => {
        const home = viewOf(await new LoadHome(api(onlineServer().respond('users/me', 200, { ...SAMPLE_ACCOUNT, hasAcceptedRules: false })), now).execute());

        expect(home.status).toBe('rules');
        expect(home.primary.label).toBe('Lire le règlement');
    });

    it('sends a player without character to find a crew, with formatted counters', async () => {
        const home = viewOf(await new LoadHome(api(onlineServer().respond('users/me', 200, SAMPLE_ACCOUNT)), now).execute());

        expect(home.status).toBe('no-character');
        expect(home.username).toBe('lemal');
        expect(home.primary).toEqual({ label: 'Trouver un équipage', command: 'play' });
        expect(home.counters[0]).toEqual({ label: 'Daedalus en vol', value: '15' });
    });

    it('offers to resume a game in progress, with day, cycle and countdown', async () => {
        const fake = onlineServer()
            .respond('users/me', 200, { ...SAMPLE_ACCOUNT, playerInfo: 812 })
            .respond('player/812', 200, SAMPLE_PLAYER_IN_GAME);

        const home = viewOf(await new LoadHome(api(fake), now).execute());

        expect(home.status).toBe('alive');
        expect(home.primary.label).toBe('Reprendre la partie');
        expect(home.ship.title).toBe('Jour 2 · Cycle 3');
        expect(home.ship.tags.map((t) => t.label)).toEqual(['Kim Jin-Su · en vie', 'Prochain cycle dans 1 h 42']);
    });

    it('asks a dead player to write the epitaph', async () => {
        const fake = onlineServer()
            .respond('users/me', 200, { ...SAMPLE_ACCOUNT, playerInfo: 812 })
            .respond('player/812', 200, { ...SAMPLE_PLAYER_IN_GAME, gameStatus: 'finished' });

        const home = viewOf(await new LoadHome(api(fake), now).execute());

        expect(home.status).toBe('dead');
        expect(home.ship.title).toBe('Kim Jin-Su est tombé · Jour 2 · Cycle 3');
    });

    it('explains when the server is unreachable', async () => {
        expect(await new LoadHome(api(new FakeGameServer().goOffline()), now).execute()).toEqual({ ok: false, message: SERVER_UNREACHABLE });
    });
});

describe('formatCountdown', () => {
    const start = new Date('2026-11-21T12:00:00Z');

    it.each([
        ['2026-11-21T12:00:30Z', '1 min'],
        ['2026-11-21T12:45:00Z', '45 min'],
        ['2026-11-21T14:05:00Z', '2 h 05'],
    ])('formats %s', (target, expected) => {
        expect(formatCountdown(new Date(target), start)).toBe(expected);
    });

    it('hides a countdown that is over', () => {
        expect(formatCountdown(new Date('2026-11-21T11:00:00Z'), start)).toBeNull();
    });
});

describe('LoadNews and LoadArticle', () => {
    it('pages the news with the total from the API', async () => {
        const fake = new FakeGameServer().respond('news?isPublished=true&order[publicationDate]=DESC&itemsPerPage=8&page=2', 200, SAMPLE_NEWS_PAGE);

        const news = viewOf(await new LoadNews(api(fake)).execute(2));

        expect(news.pager).toEqual({ page: 2, pageCount: 5 });
        expect(news.items[0]).toMatchObject({ id: 38, title: 'eMush 0.40.0', date: '21 novembre 2026' });
    });

    it('ignores an invalid page number', async () => {
        const fake = new FakeGameServer().respond('news?isPublished=true&order[publicationDate]=DESC&itemsPerPage=8&page=1', 200, SAMPLE_NEWS_PAGE);

        expect((await new LoadNews(api(fake)).execute('../../admin')).ok).toBe(true);
    });

    it('loads an article, and explains a missing one', async () => {
        const fake = new FakeGameServer().respond('news/38', 200, SAMPLE_NEWS[0]);

        expect(viewOf(await new LoadArticle(api(fake)).execute(38)).title).toBe('eMush 0.40.0');
        expect(await new LoadArticle(api(fake)).execute(39)).toMatchObject({ ok: false });
        expect(await new LoadArticle(api(fake)).execute('38')).toMatchObject({ ok: false });
    });
});

describe('LoadRanking', () => {
    it('numbers the rows from the page offset and formats the numbers', async () => {
        const fake = new FakeGameServer().respond('daedaluses/ranking?language=&page=2&itemsPerPage=15&sort=cycles_survived', 200, SAMPLE_RANKING);

        const ranking = viewOf(await new LoadRanking(api(fake)).execute({ page: 2 }));

        expect(ranking.rows[0]).toEqual({
            rank: 16, shipId: 225, endCause: 'Daedalus rentré sur Sol', days: '21', cycles: '172',
            humanTriumph: '5 626', bestHumanTriumph: '483', mushTriumph: '0', // fr-FR groups with a narrow no-break space

        });
        expect(ranking.pager).toEqual({ page: 2, pageCount: 43 });
    });

    it('falls back to safe defaults for unexpected filters', () => {
        expect(parseRankingRequest({ language: 'de', sort: 'DROP TABLE', page: -1 })).toEqual({ language: null, sort: 'cycles_survived', page: 1 });
    });
});

describe('LoadProfile', () => {
    const history = `players/ships-history?userId=${ACCOUNT_UUID}&page=1&itemsPerPage=10&language=fr`;

    it('shows the own profile with points, statistics and history', async () => {
        const fake = new FakeGameServer()
            .respond('users/me', 200, SAMPLE_ACCOUNT)
            .respond(history, 200, SAMPLE_SHIP_HISTORY)
            .respond(`statistics?userId=${ACCOUNT_UUID}&language=fr&gender=male`, 200, SAMPLE_STATISTICS)
            .respond(`achievements?userId=${ACCOUNT_UUID}&language=fr&gender=male`, 200, SAMPLE_ACHIEVEMENTS);

        const profile = viewOf(await new LoadProfile(api(fake)).execute({}));

        expect(profile).toMatchObject({ isMe: true, username: 'lemal', points: 15, shipsPlayed: 72, memberSince: '21 novembre 2026' });
        expect(profile.history[0]).toEqual({
            shipId: 1227, characterKey: 'gioele', characterName: 'Gioele Rinaldo', endCause: 'Daedalus détruit', death: 'Jour 8 · Cycle 7', triumph: '113', wasMush: false,
        });
        expect(profile.achievements[0].points).toBe(10);
    });

    it('works for a new player with nothing yet', async () => {
        const fake = new FakeGameServer()
            .respond('users/me', 200, SAMPLE_ACCOUNT)
            .respond(history, 200, { data: [], totalItems: 0 });

        const profile = viewOf(await new LoadProfile(api(fake)).execute({ page: 1 }));

        expect(profile).toMatchObject({ points: 0, shipsPlayed: 0, history: [], statistics: [], achievements: [] });
    });

    it('asks to log in when signed out', async () => {
        expect(await new LoadProfile(api(new FakeGameServer().respond('users/me', 401))).execute({})).toEqual({ ok: false, message: 'Connecte-toi pour voir ton profil.' });
    });
});

describe('LoadCrew', () => {
    it('lists the boarding ship and who is already aboard', async () => {
        const fake = new FakeGameServer()
            .respond('users/me', 200, SAMPLE_ACCOUNT)
            .respond('daedaluses/available-characters?language=en', 200, SAMPLE_CREW_OFFER);

        const crew = viewOf(await new LoadCrew(api(fake)).execute('en'));

        expect(crew).toMatchObject({ status: 'choose', language: 'en', shipId: 1244, aboard: 1 });
        if (crew.status === 'choose') {
            expect(crew.characters.map((c) => c.fullName)).toEqual(['Andie Graham', 'Kim Jin-Su']);
        }
    });

    it.each([
        ['signed-out', new FakeGameServer().respond('users/me', 401)],
        ['rules', new FakeGameServer().respond('users/me', 200, { ...SAMPLE_ACCOUNT, hasAcceptedRules: false })],
        ['aboard', new FakeGameServer().respond('users/me', 200, { ...SAMPLE_ACCOUNT, playerInfo: 812 })],
    ])('does not offer characters when %s', async (status, fake) => {
        expect(viewOf(await new LoadCrew(api(fake)).execute('fr'))).toEqual({ status });
        expect(fake.requests.some((request) => request.startsWith('daedaluses/'))).toBe(false);
    });
});

describe('JoinCrew', () => {
    it('joins with the account from the server, not from the page', async () => {
        const fake = new FakeGameServer().respond('users/me', 200, SAMPLE_ACCOUNT).respondToPost('player', 201, {});

        expect(await new JoinCrew(api(fake)).execute({ shipId: 1244, characterKey: 'andie' })).toEqual({ ok: true });
        expect(fake.posts[0].body).toEqual({ user: ACCOUNT_UUID, daedalus: 1244, character: 'andie' });
    });

    it('never sends a join for a player already aboard', async () => {
        const fake = new FakeGameServer().respond('users/me', 200, { ...SAMPLE_ACCOUNT, playerInfo: 812 });

        expect(await new JoinCrew(api(fake)).execute({ shipId: 1244, characterKey: 'andie' })).toMatchObject({ ok: false });
        expect(fake.posts).toEqual([]);
    });

    it.each([{ shipId: '1244', characterKey: 'andie' }, { shipId: 1244, characterKey: 'Andie<' }, null])('rejects an invalid request %j', async (request) => {
        const fake = new FakeGameServer().respond('users/me', 200, SAMPLE_ACCOUNT);

        expect(await new JoinCrew(api(fake)).execute(request)).toEqual({ ok: false, message: 'Choix invalide.' });
        expect(fake.posts).toEqual([]);
    });
});
