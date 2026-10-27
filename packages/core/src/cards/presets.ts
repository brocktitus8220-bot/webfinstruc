import type { CreditCardProfile } from "../schemas/credit-card";

export interface CreditCardPreset {
  id: string;
  label: string;
  description: string;
  profile: Omit<CreditCardProfile, "creditLimitCents" | "aprBasisPoints" | "statementDay" | "dueDay" | "preset">;
}

/**
 * Starting points for a card's rewards profile. Issuers change terms, so
 * every field stays editable after a preset is applied.
 */
export const CREDIT_CARD_PRESETS: readonly CreditCardPreset[] = [
  {
    id: "apple_card",
    label: "Apple Card",
    description: "2% Daily Cash with Apple Pay, 3% at Apple and select merchants, 1% with the physical card. Base rate assumes Apple Pay.",
    profile: {
      annualFeeCents: 0,
      rewardType: "cashback",
      pointValueHundredthsOfCent: 100,
      baseRateBasisPoints: 200,
      rates: [],
    },
  },
  {
    id: "flat_2",
    label: "Flat 2% cash back",
    description: "2% on everything, no annual fee.",
    profile: { annualFeeCents: 0, rewardType: "cashback", pointValueHundredthsOfCent: 100, baseRateBasisPoints: 200, rates: [] },
  },
  {
    id: "everyday_3",
    label: "Everyday 3% cash back",
    description: "3% dining and groceries, 2% gas and transit, 1% everything else.",
    profile: {
      annualFeeCents: 0,
      rewardType: "cashback",
      pointValueHundredthsOfCent: 100,
      baseRateBasisPoints: 100,
      rates: [
        { category: "dining", rateBasisPoints: 300, annualCapCents: null },
        { category: "groceries", rateBasisPoints: 300, annualCapCents: null },
        { category: "gas", rateBasisPoints: 200, annualCapCents: null },
        { category: "transit", rateBasisPoints: 200, annualCapCents: null },
      ],
    },
  },
  {
    id: "grocery_6",
    label: "Grocery and streaming 6%",
    description: "6% groceries up to $6,000 a year and streaming, 3% gas and transit, 1% else. $95 fee.",
    profile: {
      annualFeeCents: 9_500,
      rewardType: "cashback",
      pointValueHundredthsOfCent: 100,
      baseRateBasisPoints: 100,
      rates: [
        { category: "groceries", rateBasisPoints: 600, annualCapCents: 600_000 },
        { category: "streaming", rateBasisPoints: 600, annualCapCents: null },
        { category: "gas", rateBasisPoints: 300, annualCapCents: null },
        { category: "transit", rateBasisPoints: 300, annualCapCents: null },
      ],
    },
  },
  {
    id: "travel_3x",
    label: "Travel points 3x",
    description: "3x points on travel and dining, 1x else, points worth about 1.25 cents. $95 fee.",
    profile: {
      annualFeeCents: 9_500,
      rewardType: "points",
      pointValueHundredthsOfCent: 125,
      baseRateBasisPoints: 100,
      rates: [
        { category: "travel", rateBasisPoints: 300, annualCapCents: null },
        { category: "dining", rateBasisPoints: 300, annualCapCents: null },
      ],
    },
  },
  {
    id: "business_1_5",
    label: "Business 1.5% cash back",
    description: "1.5% on everything, with 3% on software and online services.",
    profile: {
      annualFeeCents: 0,
      rewardType: "cashback",
      pointValueHundredthsOfCent: 100,
      baseRateBasisPoints: 150,
      rates: [{ category: "software", rateBasisPoints: 300, annualCapCents: 2_500_000 }],
    },
  },
];

export const findCreditCardPreset = (id: string | null | undefined) => CREDIT_CARD_PRESETS.find((p) => p.id === id);
