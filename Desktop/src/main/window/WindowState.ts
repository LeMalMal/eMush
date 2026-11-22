export type Rectangle = { x: number; y: number; width: number; height: number };

export type WindowState = {
    width: number;
    height: number;
    x?: number;
    y?: number;
    isMaximized: boolean;
    isFullScreen: boolean;
};

export const DEFAULT_WINDOW_STATE: WindowState = {
    width: 1280,
    height: 800,
    isMaximized: false,
    isFullScreen: false,
};

export const MIN_WINDOW_SIZE = { width: 800, height: 600 };

export interface WindowStateStore {
    load(): WindowState | null;
    save(state: WindowState): void;
}

/**
 * Makes a saved window state safe to restore: enforces the minimum size and drops the
 * position when the window would open off-screen (e.g. a monitor was unplugged).
 */
export function fitToDisplays(state: WindowState, workAreas: Rectangle[]): WindowState {
    const fitted: WindowState = {
        ...state,
        width: Math.max(state.width, MIN_WINDOW_SIZE.width),
        height: Math.max(state.height, MIN_WINDOW_SIZE.height),
    };

    if (fitted.x === undefined || fitted.y === undefined) {
        return withoutPosition(fitted);
    }

    const titleBar = { x: fitted.x, y: fitted.y, width: fitted.width, height: 40 };
    const isVisible = workAreas.some((area) => intersects(titleBar, area));

    return isVisible ? fitted : withoutPosition(fitted);
}

export function isValidWindowState(value: unknown): value is WindowState {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const state = value as Record<string, unknown>;

    return isFiniteNumber(state.width)
        && isFiniteNumber(state.height)
        && (state.x === undefined || isFiniteNumber(state.x))
        && (state.y === undefined || isFiniteNumber(state.y))
        && typeof state.isMaximized === 'boolean'
        && typeof state.isFullScreen === 'boolean';
}

function withoutPosition(state: WindowState): WindowState {
    const { x: _x, y: _y, ...rest } = state;

    return rest;
}

function intersects(a: Rectangle, b: Rectangle): boolean {
    return a.x < b.x + b.width
        && a.x + a.width > b.x
        && a.y < b.y + b.height
        && a.y + a.height > b.y;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}
