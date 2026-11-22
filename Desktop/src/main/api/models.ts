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
    /** The player's Daedalus (null if the API did not say). */
    shipId: number | null;
    characterKey: string;
    characterName: string;
    status: PlayerStatus;
    day: number | null;
    cycle: number | null;
    nextCycleAt: Date | null;
    triumph: number | null;
    /** Action, movement, health and moral points (null when the API does not send them). */
    points: { actionPoints: Gauge | null; movementPoints: Gauge | null; healthPoints: Gauge | null; moralPoints: Gauge | null };
    room: string | null;
    isMush: boolean;
    /** Titles held by the character (Commandant, Responsable NERON...). */
    titles: string[];
    /** Active diseases, by name. */
    diseases: string[];
    ship: ShipState;
};

export type Gauge = { value: number; max: number | null };

/** The Daedalus as the crew sees it in the game's banner (null when the API did not send a value). */
export type ShipState = {
    oxygen: number | null;
    fuel: number | null;
    hull: number | null;
    shield: number | null;
    crewAlive: number | null;
};

/** Why a character's adventure ended. `name` is the long sentence, `shortName` the table label. */
export type EndCause = { key: string; name: string; shortName: string; description: string };

/** The death page of the signed-in player (`GET player/:id` once the character is dead). */
export type DeathReport = {
    playerId: number;
    characterKey: string;
    characterName: string;
    isMush: boolean;
    triumph: number | null;
    endCause: EndCause;
    /** Game markup, one line each ("3 x Objectif ( +3 :triumph: )"). */
    triumphGains: string[];
    highlights: string[];
    crew: DeathReportCrewmate[];
};

export type DeathReportCrewmate = {
    playerId: number;
    characterKey: string;
    characterName: string;
    deathDay: number | null;
    deathCycle: number | null;
    endCause: EndCause | null;
    likes: number;
};

/** A finished Daedalus (`GET closed_daedaluses/:id`). */
export type ClosedShip = {
    id: number;
    endCause: string;
    daysSurvived: number | null;
    cyclesSurvived: number | null;
    humanTriumph: number | null;
    mushTriumph: number | null;
    isCheater: boolean;
    statistics: { title: string; lines: { name: string; value: number }[] };
    titleHolders: { title: string; characterKeys: string[] }[];
    funFacts: { title: string; description: string; characterKey: string }[];
};

/** A crew member of a finished Daedalus (`GET closed_daedaluses/:id/players`). */
export type ClosedCrewMember = {
    id: number;
    characterKey: string;
    userId: string | null;
    username: string;
    /** The epitaph (null when there is none, or when it was hidden by a moderator). */
    message: string | null;
    endCause: string;
    dayDeath: number | null;
    cycleDeath: number | null;
    likes: number;
    isMush: boolean;
    score: number | null;
    highlights: string[];
    triumphGains: string[];
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

/** A chat channel of the active player, with its number of unread messages. */
export type ChannelSummary = { id: number; scope: string; name: string; unread: number };

/** An alert of the Daedalus (fire, hunters, low oxygen...). */
export type ShipAlert = { key: string; name: string; description: string };

/** A chat message (or a reply), with its author's character name. */
export type ChatMessage = { id: number; author: string; authorKey: string | null; text: string; date: string | null; unread: boolean; replies: ChatMessage[] };
