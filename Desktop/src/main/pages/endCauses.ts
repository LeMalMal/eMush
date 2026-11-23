// End causes, by API key. The closed ship endpoints send keys only: these labels come from the web
// client's French translations (App/src/i18n/locales/fr.json, `theEnd.endCause`).

/** Ends that are not a death: the character reached Sol or Eden. */
const GOOD_ENDS = new Set(['sol_return', 'eden']);

const PLAYER_END_CAUSES: Record<string, string> = {
    sol_return: 'Le Daedalus est rentré sur Sol !',
    sol_return_infected: 'Le Daedalus est rentré sur Sol... avec des Mush !',
    eden: 'Le Daedalus s\'est installé sur Eden !',
    eden_infected: 'Le Mush a infecté Eden !',
    daedalus_destroyed: 'Son cadavre flotte parmi les débris du Daedalus pulvérisé !',
    killed_by_neron: 'En route vers le vide infini !',
    super_nova: 'Mort à cause d\'un Administrateur Taquin !',
    alien_abducted: 'Enlevé par des aliens.',
    assassinated: 'Assassiné par un équipier !',
    depression: 'A mis fin à ses jours...',
    asphyxia: 'Mort sur le Daedalus par manque d\'oxygène !',
    abandoned: 'Abandonné à son pauvre sort par le Daedalus !',
    allergy: 'Câlin avec un allergène !',
    self_extracted: 'Ses tripes avaient besoin de prendre l\'air !',
    exploration: 'Tué par un accident dans un monde alien !',
    exploration_combat: 'Pulvérisé par un alien mal réveillé !',
    exploration_lost: 'Quelque chose l\'a trouvé avant ses coéquipiers !',
    electrocuted: 'Électrocuté par ce vieux tas de ferraille !',
    injury: 'Blessé à mort !',
    burnt: 'Calciné par un incendie inopportun !',
    clumsiness: 'Tellement mal en point qu\'un rien l\'a achevé...',
    clumsiness_cat: 'Achevé par un matou mal léché',
    space_battle: 'Mort dans l\'explosion de son vaisseau suite à des tirs ennemis !',
    space_asphyxiated: 'Mort abandonné dans l\'espace intersidéral !',
    beheaded: 'Décapité par un fâcheux !',
    starvation: 'Mort de faim !',
    quarantine: 'Mis en quarantaine par NERON',
    black_bite: 'A succombé à une maladie extra-terrestre !',
    metal_plate: 'Victime de cette vieille bicoque !',
    rocketed: 'Éparpillé par un missile inquisiteur !',
    bled: 'Vidé de son sang !',
    infection: 'A succombé à une infection massive !',
    mankarog: 'Tué par un Mankarog chafouin !',
    no_infirmerie: 'Mort perdu dans l\'espace infini !',
    suicide: 'Suicidé avec panache !',
    patrol_ship_explosion: 'Manœuvre ratée !',
};

/** How the whole ship ended, with the matching artwork of the web end page. */
const SHIP_ENDS: Record<string, { title: string; image: string }> = {
    sol_return: { title: 'Retour sur Sol', image: 'sol' },
    sol_return_infected: { title: 'Retour sur Sol… avec des Mush', image: 'sol-infected' },
    eden: { title: 'Installés sur Eden', image: 'eden' },
    eden_infected: { title: 'Le Mush a infecté Eden', image: 'eden-infected' },
    killed_by_neron: { title: 'Envoyés dans le vide par NERON', image: 'neron' },
    daedalus_destroyed: { title: 'Daedalus pulvérisé', image: 'destroyed' },
};

export function isGoodEnd(endCause: string): boolean {
    return GOOD_ENDS.has(endCause);
}

export function playerEndCause(endCause: string): string {
    return PLAYER_END_CAUSES[endCause] ?? 'Fin de l\'aventure';
}

export function shipEnd(endCause: string): { title: string; image: string } {
    return SHIP_ENDS[endCause] ?? { title: 'Fin du voyage', image: 'destroyed' };
}
