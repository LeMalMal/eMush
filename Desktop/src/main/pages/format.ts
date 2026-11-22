import { Pager } from './view';

const numbers = new Intl.NumberFormat('fr-FR');

export function formatNumber(value: number | null): string {
    return value === null ? '—' : numbers.format(value);
}

export function formatDate(date: Date | null): string | null {
    return date === null
        ? null
        : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function formatDayCycle(day: number | null, cycle: number | null): string | null {
    return day !== null && cycle !== null ? `Jour ${day} · Cycle ${cycle}` : null;
}

/** "1 h 42", "45 min", or null when the moment is past or unknown. */
export function formatCountdown(target: Date | null, now: Date): string | null {
    if (target === null) {
        return null;
    }
    const minutes = Math.ceil((target.getTime() - now.getTime()) / 60_000);
    if (minutes <= 0) {
        return null;
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    return hours > 0 ? `${hours} h ${String(rest).padStart(2, '0')}` : `${rest} min`;
}

export function pager(page: number, total: number, perPage: number): Pager {
    return { page, pageCount: Math.max(1, Math.ceil(total / perPage)) };
}

/** Clamps a page number coming from the UI. */
export function safePage(value: unknown): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 10_000 ? value : 1;
}
