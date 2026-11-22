import { parseRichText, toExcerpt, toPlainText } from './gameText';
import {
    booleanOr, collectionItems, collectionTotal, dateOrNull, firstText, isPositiveInteger, isRecord,
    leadingNumber, numberOrNull, stringOrNull,
} from './json';
import {
    Account, Achievement, ChannelSummary, ChatMessage, ClosedCrewMember, ClosedShip, CrewCharacter, CrewOffer, DeathReport, DeathReportCrewmate,
    EndCause, GameCounters, Gauge, NewsArticle, NewsSummary, Page, PlayerStatus, PlayerSummary, RankedShip, ShipAlert, ShipHistoryEntry, ShipState,
    Statistic,
} from './models';

// Every parser accepts `unknown` and returns null / skips items on any unexpected shape:
// the eMush API is internal to the game and may change without notice.

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHARACTER_KEY = /^[a-z_]{2,20}$/;
const PLAYER_STATUSES: readonly string[] = ['in_game', 'finished', 'closed'];

export function parseAccount(data: unknown): Account | null {
    if (!isRecord(data) || typeof data.username !== 'string' || typeof data.userId !== 'string' || !UUID.test(data.userId)) {
        return null;
    }

    return {
        uuid: data.userId,
        username: data.username,
        playerId: isPositiveInteger(data.playerInfo) ? data.playerInfo : null,
        hasAcceptedRules: booleanOr(data.hasAcceptedRules, true),
        createdAt: dateOrNull(data.createdAt),
    };
}

export function parsePlayer(data: unknown): PlayerSummary | null {
    if (!isRecord(data) || !isPositiveInteger(data.id) || !isRecord(data.character)) {
        return null;
    }

    const { character, daedalus } = data;
    if (typeof character.key !== 'string' || typeof data.gameStatus !== 'string' || !PLAYER_STATUSES.includes(data.gameStatus)) {
        return null;
    }

    const calendar = isRecord(daedalus) && isRecord(daedalus.calendar) ? daedalus.calendar : {};
    const timer = isRecord(daedalus) && isRecord(daedalus.timer) ? daedalus.timer : {};

    return {
        id: data.id,
        shipId: isRecord(daedalus) && isPositiveInteger(daedalus.id) ? daedalus.id : null,
        characterKey: character.key,
        characterName: stringOrNull(character.value) ?? character.key,
        status: data.gameStatus as PlayerStatus,
        day: numberOrNull(calendar.day),
        cycle: numberOrNull(calendar.cycle),
        nextCycleAt: dateOrNull(timer.timerCycle),
        triumph: isRecord(data.triumph) ? numberOrNull(data.triumph.quantity) : null,
        points: {
            actionPoints: parseGauge(data.actionPoint),
            movementPoints: parseGauge(data.movementPoint),
            healthPoints: parseGauge(data.healthPoint),
            moralPoints: parseGauge(data.moralPoint),
        },
        room: isRecord(data.room) ? stringOrNull(data.room.name) : null,
        isMush: booleanOr(data.isMush, false),
        titles: names(data.titles),
        diseases: names(data.diseases),
        ship: parseShipState(daedalus),
    };
}

function parseShipState(daedalus: unknown): ShipState {
    const ship = isRecord(daedalus) ? daedalus : {};
    const quantity = (value: unknown): number | null => isRecord(value) ? numberOrNull(value.quantity) : null;
    const humans = numberOrNull(ship.humanPlayerAlive);
    const mush = numberOrNull(ship.mushPlayerAlive);

    return {
        oxygen: quantity(ship.oxygen),
        fuel: quantity(ship.fuel),
        hull: quantity(ship.hull),
        shield: quantity(ship.shield),
        crewAlive: humans === null ? null : humans + (mush ?? 0),
    };
}

/** Plain names of a list of `{ name }` objects (titles, diseases...). */
function names(value: unknown): string[] {
    return (Array.isArray(value) ? value : []).flatMap((item) => {
        const name = isRecord(item) ? stringOrNull(item.name) : null;
        return name === null ? [] : [toPlainText(name)];
    });
}

function textLines(value: unknown): string[] {
    const items = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : [];

    return items.flatMap((item) => {
        const text = stringOrNull(item);
        return text === null ? [] : [text];
    });
}

function parseEndCause(value: unknown): EndCause | null {
    if (!isRecord(value) || typeof value.key !== 'string' || value.key === '') {
        return null;
    }

    return {
        key: value.key,
        name: toPlainText(stringOrNull(value.name) ?? value.key),
        shortName: toPlainText(stringOrNull(value.shortName) ?? stringOrNull(value.name) ?? value.key),
        description: toPlainText(stringOrNull(value.description) ?? ''),
    };
}

/** The death page data. Null unless the character is dead and the page is complete enough to show. */
export function parseDeathReport(data: unknown): DeathReport | null {
    if (!isRecord(data) || !isPositiveInteger(data.id) || data.gameStatus !== 'finished' || !isRecord(data.character)) {
        return null;
    }
    const { character } = data;
    const endCause = parseEndCause(data.endCause);
    if (typeof character.key !== 'string' || !CHARACTER_KEY.test(character.key) || endCause === null) {
        return null;
    }

    const crew = (Array.isArray(data.players) ? data.players : []).flatMap((row): DeathReportCrewmate[] => {
        if (!isRecord(row) || !isPositiveInteger(row.id) || !isRecord(row.character) || typeof row.character.key !== 'string' || !CHARACTER_KEY.test(row.character.key)) {
            return [];
        }

        return [{
            playerId: row.id,
            characterKey: row.character.key,
            characterName: stringOrNull(row.character.value) ?? row.character.key,
            deathDay: numberOrNull(row.deathDay),
            deathCycle: numberOrNull(row.deathCycle),
            endCause: parseEndCause(row.endCause),
            likes: Math.max(0, Math.floor(numberOrNull(row.likes) ?? 0)),
        }];
    });

    return {
        playerId: data.id,
        characterKey: character.key,
        characterName: stringOrNull(character.value) ?? character.key,
        isMush: booleanOr(data.isMush, false),
        triumph: isRecord(data.triumph) ? numberOrNull(data.triumph.quantity) : null,
        endCause,
        triumphGains: textLines(data.triumphGains),
        highlights: textLines(data.playerHighlights),
        crew,
    };
}

export function parseClosedShip(data: unknown): ClosedShip | null {
    if (!isRecord(data) || !isPositiveInteger(data.id) || typeof data.endCause !== 'string') {
        return null;
    }
    const statistics = isRecord(data.statistics) ? data.statistics : {};
    const holders = Array.isArray(data.titleHolders) ? data.titleHolders : isRecord(data.titleHolders) ? Object.values(data.titleHolders) : [];

    return {
        id: data.id,
        endCause: data.endCause,
        daysSurvived: numberOrNull(data.daysSurvived),
        cyclesSurvived: numberOrNull(data.cyclesSurvived),
        humanTriumph: numberOrNull(data.humanTriumphSum),
        mushTriumph: numberOrNull(data.mushTriumphSum),
        isCheater: booleanOr(data.isCheater, false),
        statistics: {
            title: toPlainText(stringOrNull(statistics.title) ?? 'Statistiques').replace(/\s*:\s*$/, ''),
            lines: (Array.isArray(statistics.lines) ? statistics.lines : []).flatMap((line) => {
                const name = isRecord(line) ? stringOrNull(line.name) : null;
                const value = isRecord(line) ? numberOrNull(line.value) : null;
                return name === null || value === null ? [] : [{ name: toPlainText(name), value }];
            }),
        },
        titleHolders: holders.flatMap((holder) => {
            const title = isRecord(holder) ? stringOrNull(holder.title) : null;
            if (title === null || !isRecord(holder)) {
                return [];
            }
            return [{ title: toPlainText(title), characterKeys: characterKeys(holder.characterKeys) }];
        }),
        funFacts: (Array.isArray(data.funFacts) ? data.funFacts : []).flatMap((fact) => {
            if (!isRecord(fact) || stringOrNull(fact.title) === null || typeof fact.characterKey !== 'string' || !CHARACTER_KEY.test(fact.characterKey)) {
                return [];
            }
            return [{ title: toPlainText(String(fact.title)), description: toPlainText(stringOrNull(fact.description) ?? ''), characterKey: fact.characterKey }];
        }),
    };
}

function characterKeys(value: unknown): string[] {
    const items = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : [];

    return items.filter((key): key is string => typeof key === 'string' && CHARACTER_KEY.test(key));
}

export function parseClosedCrew(data: unknown): ClosedCrewMember[] {
    return collectionItems(data).flatMap((row): ClosedCrewMember[] => {
        if (!isRecord(row) || !isPositiveInteger(row.id) || typeof row.characterKey !== 'string' || !CHARACTER_KEY.test(row.characterKey)) {
            return [];
        }

        return [{
            id: row.id,
            characterKey: row.characterKey,
            userId: typeof row.userId === 'string' && UUID.test(row.userId) ? row.userId : null,
            username: stringOrNull(row.username) ?? '?',
            message: stringOrNull(row.message),
            endCause: stringOrNull(row.endCause) ?? '',
            dayDeath: numberOrNull(row.dayDeath),
            cycleDeath: numberOrNull(row.cycleDeath),
            likes: Math.max(0, Math.floor(numberOrNull(row.likes) ?? 0)),
            isMush: booleanOr(row.isMush, false),
            score: numberOrNull(row.score) ?? numberOrNull(row.triumph),
            highlights: textLines(row.playerHighlights),
            triumphGains: textLines(row.triumphGains),
        }];
    });
}

function parseGauge(value: unknown): Gauge | null {
    if (!isRecord(value)) {
        return null;
    }
    const quantity = numberOrNull(value.quantity);

    return quantity === null ? null : { value: quantity, max: numberOrNull(value.max) };
}

export function parseNewsSummary(item: unknown): NewsSummary | null {
    if (!isRecord(item) || !isPositiveInteger(item.id)) {
        return null;
    }
    const title = firstText(item.frenchTitle, item.englishTitle, item.spanishTitle);
    if (title === null) {
        return null;
    }

    return {
        id: item.id,
        title,
        excerpt: toExcerpt(firstText(item.frenchContent, item.englishContent, item.spanishContent) ?? ''),
        publishedAt: dateOrNull(item.publicationDate),
        isPinned: booleanOr(item.isPinned, false),
    };
}

export function parseNewsPage(data: unknown): Page<NewsSummary> {
    const items = collectionItems(data).map(parseNewsSummary).filter((item): item is NewsSummary => item !== null);

    return { items, total: collectionTotal(data) ?? items.length };
}

export function parseArticle(data: unknown): NewsArticle | null {
    const summary = parseNewsSummary(data);
    if (summary === null || !isRecord(data)) {
        return null;
    }

    return { ...summary, content: parseRichText(firstText(data.frenchContent, data.englishContent, data.spanishContent) ?? '') };
}

export function parseCounters(data: unknown): GameCounters | null {
    if (!isRecord(data)) {
        return null;
    }
    const values = [data.daedalusesInGame, data.mushKilled, data.messagesSent, data.expeditionsStarted];
    if (!values.every((value) => typeof value === 'number')) {
        return null;
    }
    const [shipsInFlight, mushKilled, messagesSent, expeditionsStarted] = values as number[];

    return { shipsInFlight, mushKilled, messagesSent, expeditionsStarted };
}

export function parseRanking(data: unknown): Page<RankedShip> {
    const items = collectionItems(data).flatMap((row): RankedShip[] => {
        if (!isRecord(row) || !isPositiveInteger(row.id)) {
            return [];
        }

        return [{
            shipId: row.id,
            endCause: stringOrNull(row.endCause) ?? '—',
            daysSurvived: numberOrNull(row.daysSurvived),
            cyclesSurvived: numberOrNull(row.cyclesSurvived),
            humanTriumph: leadingNumber(row.humanTriumphSum),
            mushTriumph: leadingNumber(row.mushTriumphSum),
            bestHumanTriumph: leadingNumber(row.highestHumanTriumph),
        }];
    });

    return { items, total: collectionTotal(data) ?? items.length };
}

export function parseShipHistory(data: unknown): Page<ShipHistoryEntry> {
    const items = collectionItems(data).flatMap((row): ShipHistoryEntry[] => {
        if (!isRecord(row) || !isPositiveInteger(row.daedalusId) || typeof row.character !== 'string' || !CHARACTER_KEY.test(row.character)) {
            return [];
        }

        return [{
            shipId: row.daedalusId,
            characterKey: row.character,
            endCause: stringOrNull(row.endCause) ?? '—',
            dayDeath: numberOrNull(row.dayDeath),
            cycleDeath: numberOrNull(row.cycleDeath),
            triumph: leadingNumber(row.triumph),
            wasMush: booleanOr(row.isMush, false),
        }];
    });

    return { items, total: collectionTotal(data) ?? items.length };
}

export function parseStatistics(data: unknown): Statistic[] {
    return collectionItems(data).flatMap((row): Statistic[] => {
        if (!isRecord(row) || typeof row.key !== 'string' || stringOrNull(row.name) === null) {
            return [];
        }

        return [{
            key: row.key,
            name: toPlainText(String(row.name)),
            description: toPlainText(stringOrNull(row.description) ?? ''),
            count: stringOrNull(row.formattedCount) ?? String(numberOrNull(row.count) ?? ''),
            isRare: booleanOr(row.isRare, false),
        }];
    });
}

export function parseAchievements(data: unknown): Achievement[] {
    return collectionItems(data).flatMap((row): Achievement[] => {
        if (!isRecord(row) || typeof row.key !== 'string' || stringOrNull(row.name) === null) {
            return [];
        }

        return [{
            key: row.key,
            name: toPlainText(String(row.name)),
            description: toPlainText(stringOrNull(row.statisticName) ?? ''),
            points: numberOrNull(row.points) ?? 0,
            isRare: booleanOr(row.isRare, false),
        }];
    });
}

export function parseCrewOffer(data: unknown): CrewOffer | null {
    if (!isRecord(data) || !isPositiveInteger(data.daedalus) || !Array.isArray(data.characters)) {
        return null;
    }

    const characters = data.characters.flatMap((row): CrewCharacter[] => {
        if (!isRecord(row) || typeof row.key !== 'string' || !CHARACTER_KEY.test(row.key)) {
            return [];
        }
        const skills = Array.isArray(row.skills) ? row.skills : [];

        return [{
            key: row.key,
            name: stringOrNull(row.name) ?? row.key,
            abstract: toPlainText(stringOrNull(row.abstract) ?? ''),
            level: numberOrNull(row.level),
            available: booleanOr(row.available, true),
            skills: skills.flatMap((skill) => isRecord(skill) && stringOrNull(skill.name) !== null
                ? [{ name: toPlainText(String(skill.name)), description: parseRichText(stringOrNull(skill.description) ?? '') }]
                : []),
        }];
    });

    return { shipId: data.daedalus, characters };
}

/** The API's error message (`detail`), when it gives one. */
export function parseApiError(data: unknown): string | null {
    return isRecord(data) ? stringOrNull(data.detail) ?? stringOrNull(data.message) ?? stringOrNull(data.error) : null;
}

export function parseChannels(data: unknown): ChannelSummary[] {
    return collectionItems(data).flatMap((row): ChannelSummary[] => {
        if (!isRecord(row) || !isPositiveInteger(row.id)) {
            return [];
        }
        const unread = numberOrNull(row.numberOfNewMessages);

        return [{
            id: row.id,
            scope: stringOrNull(row.scope) ?? 'unknown',
            name: stringOrNull(row.name) ?? '',
            unread: unread !== null && unread > 0 ? Math.floor(unread) : 0,
        }];
    });
}

export function parseAlerts(data: unknown): ShipAlert[] {
    return collectionItems(data).flatMap((row): ShipAlert[] => {
        if (!isRecord(row) || typeof row.key !== 'string' || row.key === '') {
            return [];
        }

        return [{
            key: row.key,
            name: toPlainText(stringOrNull(row.name) ?? row.key),
            description: toPlainText(stringOrNull(row.description) ?? ''),
        }];
    });
}

export function parseMessages(data: unknown): ChatMessage[] {
    return collectionItems(data).flatMap((row): ChatMessage[] => {
        if (!isRecord(row) || !isPositiveInteger(row.id)) {
            return [];
        }
        const author = isRecord(row.character) ? stringOrNull(row.character.value) ?? stringOrNull(row.character.key) : null;
        const authorKey = isRecord(row.character) && typeof row.character.key === 'string' && CHARACTER_KEY.test(row.character.key) ? row.character.key : null;

        return [{
            id: row.id,
            author: author ?? 'NERON',
            authorKey,
            date: stringOrNull(row.date),
            text: toPlainText(stringOrNull(row.message) ?? ''),
            unread: booleanOr(row.isUnread, false),
            replies: parseMessages(row.child),
        }];
    });
}
