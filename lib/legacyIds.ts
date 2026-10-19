// Maps between pokemontcg.io IDs (what the app used before moving to TCGdex) and
// TCGdex IDs. Used to convert saved data and to borrow pokemontcg.io scans for the
// cards TCGdex has no English image for.

// pokemontcg.io set IDs that TCGdex names differently. The sv/me eras follow a
// pattern and are handled in code below ("sv3pt5" → "sv03.5", "me1" → "me01").
const RENAMED_SETS: Record<string, string> = {
  base6:       "lc",
  bp:          "bog",
  hsp:         "hgssp",
  sm35:        "sm3.5",
  sm75:        "sm7.5",
  swsh35:      "swsh3.5",
  swsh45:      "swsh4.5",
  swsh45sv:    "swsh4.5sv",
  cel25c:      "cel25cc",
  pgo:         "swsh10.5",
  swsh12pt5:   "swsh12.5",
  swsh12pt5gg: "swsh12.5gg",
  fut20:       "fut2020",
  mcd11:       "2011bw",
  mcd12:       "2012bw",
  mcd14:       "2014xy",
  mcd15:       "2015xy",
  mcd16:       "2016xy",
  mcd17:       "2017sm",
  mcd18:       "2018sm",
  mcd19:       "2019sm",
  mcd21:       "2021swsh",
  mcd22:       "2022swsh",
  zsv10pt5:    "sv10.5b",
  rsv10pt5:    "sv10.5w",
};

// pokemontcg.io set IDs that TCGdex uses unchanged.
const SAME_SETS = new Set([
  "base1", "base2", "basep", "base3", "base4", "base5", "gym1", "gym2", "neo1", "neo2", "si1", "neo3", "neo4",
  "ecard1", "ecard2", "ecard3", "np",
  "ex1", "ex2", "ex3", "ex4", "ex5", "ex6", "ex7", "ex8", "ex9", "ex10", "ex11", "ex12", "ex13", "ex14", "ex15", "ex16",
  "pop1", "pop2", "pop3", "pop4", "pop5", "pop6", "pop7", "pop8", "pop9",
  "dpp", "dp1", "dp2", "dp3", "dp4", "dp5", "dp6", "dp7", "pl1", "pl2", "pl3", "pl4", "ru1",
  "hgss1", "hgss2", "hgss3", "hgss4", "col1",
  "bwp", "bw1", "bw2", "bw3", "bw4", "bw5", "bw6", "bw7", "bw8", "bw9", "bw10", "bw11", "dv1",
  "xyp", "xy0", "xy1", "xy2", "xy3", "xy4", "xy5", "xy6", "xy7", "xy8", "xy9", "xy10", "xy11", "xy12", "dc1", "g1",
  "smp", "sm1", "sm2", "sm3", "sm4", "sm5", "sm6", "sm7", "sm8", "sm9", "sm10", "sm11", "sm12", "sm115", "sma", "det1",
  "swshp", "swsh1", "swsh2", "swsh3", "swsh4", "swsh5", "swsh6", "swsh7", "swsh8", "swsh9", "swsh10", "swsh11", "swsh12",
  "swsh9tg", "swsh10tg", "swsh11tg", "swsh12tg", "cel25",
  "svp", "sve",
]);

const RENAMED_SETS_REVERSE = Object.fromEntries(Object.entries(RENAMED_SETS).map(([k, v]) => [v, k]));

/** pokemontcg.io set ID → TCGdex set ID, or null if it isn't a known pokemontcg.io set. */
export function legacySetToTcgdex(setId: string): string | null {
  if (RENAMED_SETS[setId]) return RENAMED_SETS[setId];
  if (SAME_SETS.has(setId)) return setId;
  const m = /^(sv|me)(\d+)(pt5)?$/.exec(setId);
  if (m) return `${m[1]}${m[2].padStart(2, "0")}${m[3] ? ".5" : ""}`;
  return null;
}

/** TCGdex set ID → pokemontcg.io set ID, or null if pokemontcg.io doesn't have the set. */
export function tcgdexSetToLegacy(setId: string): string | null {
  if (RENAMED_SETS_REVERSE[setId]) return RENAMED_SETS_REVERSE[setId];
  if (SAME_SETS.has(setId)) return setId;
  const m = /^(sv|me)0?(\d+)(\.5)?$/.exec(setId);
  if (m) return `${m[1]}${m[2]}${m[3] ? "pt5" : ""}`;
  return null;
}

/**
 * The pokemontcg.io scan for a TCGdex card, or null when there's no known equivalent.
 * pokemontcg.io drops leading zeros from plain numbers ("025" → "25") but keeps
 * prefixed ones as printed ("TG01", "SV001").
 */
export function legacyImageUrl(setId: string, localId: string, quality: "low" | "high"): string | null {
  const legacySet = tcgdexSetToLegacy(setId);
  // Classic Collection numbers ("CC001" vs "15_A1") don't line up between the two.
  if (!legacySet || legacySet === "cel25c") return null;
  const number = /^\d+$/.test(localId) ? String(parseInt(localId, 10)) : localId;
  return `https://images.pokemontcg.io/${legacySet}/${number}${quality === "high" ? "_hires" : ""}.png`;
}
