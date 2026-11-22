import { describe, expect, it } from 'vitest';
import { EmushApi } from './EmushApi';
import {
    ACCOUNT_UUID, FakeGameServer, SAMPLE_ACCOUNT, SAMPLE_ACHIEVEMENTS, SAMPLE_CREW_OFFER, SAMPLE_NEWS, SAMPLE_PLAYER_IN_GAME,
    SAMPLE_RANKING, SAMPLE_SHIP_HISTORY, SAMPLE_STATISTICS,
} from './FakeGameServer';
import { parseRichText, toExcerpt, toPlainText } from './gameText';
import { dateOrNull, leadingNumber } from './json';
import {
    parseAccount, parseAchievements, parseArticle, parseCrewOffer, parseNewsPage, parsePlayer, parseRanking, parseShipHistory, parseStatistics,
} from './parsers';

const server = new URL('https://emush.eternaltwin.org');

describe('parseAccount', () => {
    it('reads uuid, username, rules and the absence of an active player', () => {
        expect(parseAccount(SAMPLE_ACCOUNT)).toEqual({
            uuid: ACCOUNT_UUID,
            username: 'lemal',
            playerId: null,
            hasAcceptedRules: true,
            createdAt: new Date('2026-11-21T21:24:29Z'),
        });
    });

    it('reads the active player id', () => {
        expect(parseAccount({ ...SAMPLE_ACCOUNT, playerInfo: 812 })?.playerId).toBe(812);
    });

    it.each([null, [], 'lemal', { username: 'x' }, { ...SAMPLE_ACCOUNT, userId: '../admin' }])('rejects %j', (value) => {
        expect(parseAccount(value)).toBeNull();
    });
});

describe('parsePlayer', () => {
    it('reads character, status, calendar, next cycle and triumph', () => {
        expect(parsePlayer(SAMPLE_PLAYER_IN_GAME)).toEqual({
            id: 812, characterKey: 'jin_su', characterName: 'Jin-Su', status: 'in_game',
            day: 2, cycle: 3, nextCycleAt: new Date('2026-11-21T23:00:00Z'), triumph: 12,
        });
    });

    it('reads a dead player, whose payload has no timer', () => {
        const dead = { id: 812, character: { key: 'jin_su', value: 'Jin-Su' }, gameStatus: 'finished', daedalus: { key: 77, calendar: { day: 9, cycle: 1 } } };

        expect(parsePlayer(dead)).toMatchObject({ status: 'finished', day: 9, nextCycleAt: null, triumph: null });
    });

    it('rejects an unknown status', () => {
        expect(parsePlayer({ ...SAMPLE_PLAYER_IN_GAME, gameStatus: 'starting_soon' })).toBeNull();
    });
});

describe('news parsers', () => {
    it('reads a JSON-LD page with its total and turns markup into an excerpt', () => {
        const page = parseNewsPage({ 'hydra:totalItems': 38, 'hydra:member': [...SAMPLE_NEWS, { id: 3 }] });

        expect(page.total).toBe(38);
        expect(page.items.map((item) => item.id)).toEqual([38, 37]);
        expect(page.items[0].excerpt).toBe('Nouvelles fonctionnalités Nouvelle statistique');
        expect(page.items[1].isPinned).toBe(true);
    });

    it('reads a full article as rich text', () => {
        const article = parseArticle(SAMPLE_NEWS[0]);

        expect(article?.content).toEqual([
            { kind: 'paragraph', inlines: [{ text: 'Nouvelles fonctionnalités', strong: true }] },
            { kind: 'list', items: [[{ text: 'Nouvelle statistique' }]] },
        ]);
    });
});

describe('ranking, history, statistics and achievements parsers', () => {
    it('reads ranked ships and their pre-formatted triumph', () => {
        const ranking = parseRanking(SAMPLE_RANKING);

        expect(ranking.total).toBe(645);
        expect(ranking.items[0]).toEqual({
            shipId: 225, endCause: 'Daedalus rentré sur Sol', daysSurvived: 21, cyclesSurvived: 172,
            humanTriumph: 5626, mushTriumph: 0, bestHumanTriumph: 483,
        });
    });

    it('reads a player history and skips rows with unknown characters', () => {
        const history = parseShipHistory({ ...SAMPLE_SHIP_HISTORY, data: [...SAMPLE_SHIP_HISTORY.data, { character: '<script>', daedalusId: 3 }] });

        expect(history.total).toBe(72);
        expect(history.items).toHaveLength(2);
        expect(history.items[1]).toEqual({ shipId: 1076, characterKey: 'terrence', endCause: 'Dépression fatale', dayDeath: 7, cycleDeath: 1, triumph: 63, wasMush: true });
    });

    it('reads statistics and achievements', () => {
        expect(parseStatistics(SAMPLE_STATISTICS)[0]).toMatchObject({ name: 'Sol', count: 'x27', isRare: true });
        expect(parseAchievements(SAMPLE_ACHIEVEMENTS).map((a) => a.points)).toEqual([5, 10]);
    });
});

describe('parseCrewOffer', () => {
    it('reads the ship, characters, availability and skills', () => {
        const offer = parseCrewOffer(SAMPLE_CREW_OFFER);

        expect(offer?.shipId).toBe(1244);
        expect(offer?.characters.map((c) => [c.key, c.available])).toEqual([['andie', true], ['jin_su', false]]);
        expect(offer?.characters[0].skills[0].description).toEqual([
            { kind: 'paragraph', inlines: [{ text: 'Une fois par jour, ' }, { text: '1', strong: true }, { text: ' PA.' }] },
        ]);
    });

    it('rejects a payload without ship', () => {
        expect(parseCrewOffer({ characters: [] })).toBeNull();
    });
});

describe('game text', () => {
    it('handles line breaks, bullets, emphasis, links and icons', () => {
        expect(parseRichText('Intro *vite*//- un [wiki](https://fr.emushpedia.com/wiki/X)//- deux :pa:')).toEqual([
            { kind: 'paragraph', inlines: [{ text: 'Intro ' }, { text: 'vite', em: true }] },
            { kind: 'list', items: [
                [{ text: 'un ' }, { text: 'wiki', href: 'https://fr.emushpedia.com/wiki/X' }],
                [{ text: 'deux PA' }],
            ] },
        ]);
    });

    it('keeps URLs intact (the // of https:// is not a line break) and trims trailing punctuation', () => {
        expect(parseRichText('Voir https://emush.eternaltwin.org/news.')).toEqual([
            { kind: 'paragraph', inlines: [{ text: 'Voir ' }, { text: 'https://emush.eternaltwin.org/news', href: 'https://emush.eternaltwin.org/news' }, { text: '.' }] },
        ]);
    });

    it('never produces markup: tags stay plain text', () => {
        expect(toPlainText('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>');
    });

    it('drops unknown icons and makes short excerpts', () => {
        expect(toPlainText('Bravo :unknown_emote: !')).toBe('Bravo !');
        expect(toExcerpt('mot '.repeat(100), 40)).toHaveLength(40);
    });
});

describe('json helpers', () => {
    it('reads the API date format and pre-formatted numbers', () => {
        expect(dateOrNull('2026-11-21 21:24:29')).toEqual(new Date('2026-11-21T21:24:29Z'));
        expect(leadingNumber('5626 :triumph:')).toBe(5626);
        expect(leadingNumber(':triumph:')).toBeNull();
    });
});

describe('EmushApi', () => {
    it('treats 401 and 403 on users/me as "not logged in"', async () => {
        expect(await new EmushApi(server, new FakeGameServer().respond('users/me', 401)).me()).toBeNull();
        expect(await new EmushApi(server, new FakeGameServer().respond('users/me', 403)).me()).toBeNull();
    });

    it('sends the same join request as the web client', async () => {
        const fake = new FakeGameServer().respondToPost('player', 201, {});

        const result = await new EmushApi(server, fake).joinShip(ACCOUNT_UUID, 1244, 'andie');

        expect(result).toEqual({ ok: true });
        expect(fake.posts).toEqual([{ path: 'player', body: { user: ACCOUNT_UUID, daedalus: 1244, character: 'andie' } }]);
    });

    it('reports the server message when a join is refused', async () => {
        const fake = new FakeGameServer().respondToPost('player', 422, { detail: 'Ce personnage est déjà pris.' });

        expect(await new EmushApi(server, fake).joinShip(ACCOUNT_UUID, 1244, 'andie')).toEqual({ ok: false, message: 'Ce personnage est déjà pris.' });
    });

    it('asks for the ranking with the API sort names', async () => {
        const fake = new FakeGameServer().respond('daedaluses/ranking?language=fr&page=2&itemsPerPage=15&sort=human_triumph_sum', 200, SAMPLE_RANKING);

        const page = await new EmushApi(server, fake).ranking({ language: 'fr', sort: 'human_triumph_sum', page: 2, perPage: 15 });

        expect(page.items).toHaveLength(2);
    });
});
