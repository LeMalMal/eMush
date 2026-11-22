// Small, strict readers for untrusted JSON coming from the game API.

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function numberOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function stringOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function booleanOr(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

/** Accepts ISO dates and the API's "2026-11-21 21:24:29" format. */
export function dateOrNull(value: unknown): Date | null {
    if (typeof value !== 'string') {
        return null;
    }
    const date = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(value) ? `${value.replace(' ', 'T')}Z` : value);

    return Number.isNaN(date.getTime()) ? null : date;
}

export function firstText(...values: unknown[]): string | null {
    for (const value of values) {
        const text = stringOrNull(value);
        if (text !== null) {
            return text;
        }
    }

    return null;
}

/** "5626 :triumph:" -> 5626. The ranking and history endpoints return pre-formatted numbers. */
export function leadingNumber(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    const match = typeof value === 'string' ? /^\s*(-?\d+)/.exec(value) : null;

    return match ? Number(match[1]) : null;
}

/** Items of a plain JSON array, a JSON-LD collection or an `{ data: [] }` envelope. */
export function collectionItems(value: unknown): unknown[] {
    if (Array.isArray(value)) {
        return value;
    }
    if (!isRecord(value)) {
        return [];
    }
    for (const key of ['hydra:member', 'member', 'data']) {
        if (Array.isArray(value[key])) {
            return value[key] as unknown[];
        }
    }

    return [];
}

export function collectionTotal(value: unknown): number | null {
    if (!isRecord(value)) {
        return null;
    }

    return numberOrNull(value['hydra:totalItems'] ?? value.totalItems);
}
