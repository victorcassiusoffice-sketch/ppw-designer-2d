/** The One Live Build type decks served on onelivebuild.com/decks/<slug>/, and the
 * "Who are you?" choices on the landing page that open them.
 *
 * Each deck is a copy of an approved, live deck from the deck site (ppw-decks), kept
 * byte for byte in public/decks/<slug>/ by `node tools/sync-olb-decks.mjs`. `sha256` is
 * the approved index.html; the tests and the sync tool both check it, so a deck changes
 * here only on purpose. The ppw-decks links stay as they are: these are duplicates.
 *
 * Only generic One Live Build type decks belong here. Decks made for one company, the
 * Tenant Folder, Lifestyle and Atlas Bod decks, the StretchTek deck and the spa page do not.
 * Plain TypeScript (no enums), so `node tools/sync-olb-decks.mjs` can import it as is. */

export type OlbDeck = {
  /** The address on onelivebuild.com: /decks/<slug>/ */
  readonly slug: string;
  /** Folder of the same deck on the deck site (ppw-decks.vercel.app/<source>/). */
  readonly source: string;
  /** sha256 of the approved index.html. */
  readonly sha256: string;
  readonly title: string;
};

export const OLB_DECKS: readonly OlbDeck[] = [
  { slug: 'developers', source: 'developers-d015f6', sha256: 'cc9d1d45a9c95157cfd6869d4ed687767b6ef0b0c1ea4f45648aa11254668ccb', title: 'One Live Build for developers' },
  { slug: 'builders', source: 'builders-13a28f', sha256: '4a9023d82d548480735e7c31b5abdfece59940e9855c81f727d9cb1856166afd', title: 'One Live Build for builders and contractors' },
  { slug: 'mep', source: 'mep-5cca8c', sha256: 'ee652f10648f3c38635d5e5d1b83a9742bcfc292fa4a727a273ca307be472610', title: 'One Live Build for plumbing, electrical and MEP' },
  { slug: 'materials', source: 'materials-c91b72', sha256: '951500ad2d86a251e6f2fd3003c080ab56515fbee587bb509fcaf7cbff420836', title: 'One Live Build for material and finish suppliers' },
  { slug: 'one-live-build', source: 'one-live-build', sha256: '0118542fb206319fbb074b9a85063f9f4334c6cf27197777978b28c9178f06d0', title: 'One Live Build' },
];

export type OlbAudience = {
  /** The value the landing form sends: /decks/?for=<id> */
  readonly id: string;
  /** What the visitor reads in the dropdown. */
  readonly label: string;
  /** The deck it opens (an OLB_DECKS slug). */
  readonly deck: string;
};

/** The dropdown, in order. Off-plan and office developers share the developers deck
 * (built for both on 1 Nov). */
export const OLB_AUDIENCES: readonly OlbAudience[] = [
  { id: 'developer', label: 'Developer', deck: 'developers' },
  { id: 'off-plan-developer', label: 'Off-plan developer', deck: 'developers' },
  { id: 'office-developer', label: 'Office developer', deck: 'developers' },
  { id: 'builder', label: 'Builder or contractor', deck: 'builders' },
  { id: 'mep', label: 'MEP or services firm', deck: 'mep' },
  { id: 'materials', label: 'Materials or finish supplier', deck: 'materials' },
  { id: 'other', label: 'Another build company', deck: 'one-live-build' },
];

export function deckBySlug(slug: string): OlbDeck | undefined {
  return OLB_DECKS.find((deck) => deck.slug === slug);
}

export function deckForAudience(id: string | null): OlbDeck | undefined {
  const audience = OLB_AUDIENCES.find((entry) => entry.id === id);
  return audience ? deckBySlug(audience.deck) : undefined;
}
