import { EmushApi } from '../api/EmushApi';
import { parseInlines } from '../api/gameText';
import { ClosedCrewMember, ClosedShip } from '../api/models';
import { isPositiveInteger } from '../api/json';
import { characterFullName } from './characters';
import { isGoodEnd, playerEndCause, shipEnd } from './endCauses';
import { formatNumber } from './format';
import { load, PageError } from './load';
import { Loaded, ShipCrewCard, ShipEndView, Tag } from './view';

/** Places of the web end page: the headliner, then the main roles, then everyone else. */
const MAIN_ROLES = 6;
const HIGHLIGHTS_PER_CARD = 3;

/** The awards of the web end page, by rank (0 = best score). */
export function awardFor(rank: number): { label: string; image: string } {
    const awards = [
        { label: 'Prix Supernova d\'Or', image: 'first' },
        { label: 'Prix Supernova d\'Excellence', image: 'second' },
        { label: 'Prix Supernova d\'Honneur', image: 'third' },
        { label: 'Prix Supernova Révélée', image: 'fourth' },
    ];

    return awards[rank] ?? (rank <= MAIN_ROLES ? { label: 'Prix Nova Spécial', image: 'fifth' } : { label: 'Prix Nova', image: 'sixth' });
}

function crewCard(member: ClosedCrewMember, rank: number): ShipCrewCard {
    return {
        characterKey: member.characterKey,
        name: characterFullName(member.characterKey),
        username: member.username,
        userId: member.userId,
        score: formatNumber(member.score),
        isMush: member.isMush,
        endCause: playerEndCause(member.endCause),
        good: isGoodEnd(member.endCause),
        death: isGoodEnd(member.endCause) || !member.dayDeath ? null : `Jour ${member.dayDeath} · Cycle ${member.cycleDeath ?? '?'}`,
        likes: member.likes,
        // Epitaphs can span lines, even inside **bold**: one line of text, as in the web end page.
        epitaph: member.message === null ? null : parseInlines(member.message.replace(/\s*\n\s*/g, ' ')),
        award: awardFor(rank),
        highlights: member.highlights.slice(0, HIGHLIGHTS_PER_CARD).map(parseInlines),
    };
}

function shipTags(ship: ClosedShip): Tag[] {
    const tags: Tag[] = [];
    if (ship.daysSurvived !== null) {
        tags.push({ label: `${ship.daysSurvived} jours · ${formatNumber(ship.cyclesSurvived)} cycles`, tone: 'neutral' });
    }
    if (ship.humanTriumph !== null && ship.humanTriumph >= 0) {
        tags.push({ label: `${formatNumber(ship.humanTriumph)} triomphe humain`, tone: 'ok' });
    }
    if (ship.mushTriumph !== null && ship.mushTriumph > 0) {
        tags.push({ label: `${formatNumber(ship.mushTriumph)} triomphe Mush`, tone: 'alert' });
    }

    return tags;
}

/** Pure: what the end page of a finished ship shows. */
export function buildShipEndView(ship: ClosedShip, crew: ClosedCrewMember[]): ShipEndView {
    const cards = [...crew]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .map(crewCard);
    const character = (key: string) => ({ key, name: characterFullName(key) });

    return {
        shipId: ship.id,
        end: shipEnd(ship.endCause),
        tags: shipTags(ship),
        isCheater: ship.isCheater,
        headliner: cards[0] ?? null,
        mainRoles: cards.slice(1, 1 + MAIN_ROLES),
        extras: cards.slice(1 + MAIN_ROLES),
        statistics: { title: ship.statistics.title, lines: ship.statistics.lines.map(({ name, value }) => ({ name, value: formatNumber(value) })) },
        titles: ship.titleHolders
            .filter((holder) => holder.characterKeys.length > 0)
            .map((holder) => ({ title: holder.title, characters: holder.characterKeys.map(character) })),
        funFacts: ship.funFacts.map((fact) => ({ title: fact.title, description: fact.description, character: character(fact.characterKey) })),
    };
}

export class LoadShipEnd {
    constructor(private readonly api: EmushApi) {}

    execute(value: unknown): Promise<Loaded<ShipEndView>> {
        return load(async () => {
            if (!isPositiveInteger(value)) {
                throw new PageError('Vaisseau inconnu.');
            }
            const [ship, crew] = await Promise.all([this.api.closedShip(value), this.api.closedShipCrew(value)]);
            if (ship === null) {
                throw new PageError('Ce vaisseau est introuvable, ou son voyage n\'est pas encore terminé.');
            }

            return buildShipEndView(ship, crew);
        });
    }
}
