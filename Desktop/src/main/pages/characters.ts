/** Full names of the playable characters, by API key (from the game's French translations). */
const FULL_NAMES: Record<string, string> = {
    andie: 'Andie Graham',
    chao: 'Wang Chao',
    chun: 'Zhong Chun',
    derek: 'Derek Hogan',
    eleesha: 'Eleesha Williams',
    finola: 'Finola Keegan',
    frieda: 'Frieda Bergmann',
    gioele: 'Gioele Rinaldo',
    hua: 'Jiang Hua',
    ian: 'Ian Soulton',
    janice: 'Janice Kent',
    jin_su: 'Kim Jin-Su',
    kuan_ti: 'Lai Kuan Ti',
    paola: 'Paola Rinaldo',
    raluca: 'Raluca Tomescu',
    roland: 'Roland Zuccali',
    stephen: 'Stephen Seagull',
    terrence: 'Terrence Archer',
};

export function characterFullName(key: string, fallback?: string): string {
    return FULL_NAMES[key] ?? fallback ?? key;
}
