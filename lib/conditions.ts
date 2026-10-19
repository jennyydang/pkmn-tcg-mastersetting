import { Condition } from "./cardData";

// Estimated price by condition. TCGdex gives one TCGplayer market price per
// version (close to Near Mint); other conditions use the discounts collectors
// commonly apply. Shown as estimates in the UI.
export const CONDITION_FACTORS: Record<Condition, number> = {
  NM:  1.0,
  LP:  0.85,
  MP:  0.7,
  HP:  0.5,
  DMG: 0.35,
};

export function conditionPrice(marketPrice: number, condition: Condition) {
  return Math.round(marketPrice * CONDITION_FACTORS[condition] * 100) / 100;
}
