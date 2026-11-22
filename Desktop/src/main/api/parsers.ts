import { parseRichText, toExcerpt, toPlainText } from './gameText';
import {
    booleanOr, collectionItems, collectionTotal, dateOrNull, firstText, isPositiveInteger, isRecord,
    leadingNumber, numberOrNull, stringOrNull,
} from './json';
import {
    Account, Achievement, ChannelSummary, ChatMessage, CrewCharacter, CrewOffer, GameCounters, NewsArticle, NewsSummary, Page,
    PlayerStatus, PlayerSummary, RankedShip, ShipAlert, ShipHistoryEntry, Statistic,
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
    };
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

        return [{
            id: row.id,
            author: author ?? 'NERON',
            text: toPlainText(stringOrNull(row.message) ?? ''),
            unread: booleanOr(row.isUnread, false),
            replies: parseMessages(row.child),
        }];
    });
}
