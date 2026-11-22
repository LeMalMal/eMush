import { RichBlock } from './gameText';

// What the client reads from the game API, after defensive parsing (see parsers.ts).

export type Language = 'fr' | 'en' | 'es';
export const LANGUAGES: readonly Language[] = ['fr', 'en', 'es'];

export type Account = {
    uuid: string;
    username: string;
    /** Id of the active player, or null when the account has no character in a ship. */
    playerId: number | null;
    hasAcceptedRules: boolean;
    createdAt: Date | null;
};

export type PlayerStatus = 'in_game' | 'finished' | 'closed';

export type PlayerSummary = {
    id: number;
    characterKey: string;
    characterName: string;
    status: PlayerStatus;
    day: number | null;
    cycle: number | null;
    nextCycleAt: Date | null;
    triumph: number | null;
};

export type NewsSummary = {
    id: number;
    title: string;
    excerpt: string;
    publishedAt: Date | null;
    isPinned: boolean;
};

export type NewsArticle = NewsSummary & { content: RichBlock[] };

export type Page<T> = { items: T[]; total: number };

export type GameCounters = {
    shipsInFlight: number;
    mushKilled: number;
    messagesSent: number;
    expeditionsStarted: number;
};

export type RankingSort = 'cycles_survived' | 'human_triumph_sum' | 'mush_triumph_sum';
export const RANKING_SORTS: readonly RankingSort[] = ['cycles_survived', 'human_triumph_sum', 'mush_triumph_sum'];

export type RankedShip = {
    shipId: number;
    endCause: string;
    daysSurvived: number | null;
    cyclesSurvived: number | null;
    humanTriumph: number | null;
    mushTriumph: number | null;
    bestHumanTriumph: number | null;
};

export type ShipHistoryEntry = {
    shipId: number;
    characterKey: string;
    endCause: string;
    dayDeath: number | null;
    cycleDeath: number | null;
    triumph: number | null;
    wasMush: boolean;
};

export type Statistic = { key: string; name: string; description: string; count: string; isRare: boolean };
export type Achievement = { key: string; name: string; description: string; points: number; isRare: boolean };

export type CrewSkill = { name: string; description: RichBlock[] };

export type CrewCharacter = {
    key: string;
    name: string;
    abstract: string;
    level: number | null;
    available: boolean;
    skills: CrewSkill[];
};

export type CrewOffer = { shipId: number; characters: CrewCharacter[] };
