import { rewardCategoryFor } from "../cards/categories";
import type { CreditCard, CreditCardProfile, RewardCategory } from "../schemas/credit-card";
import { REWARD_CATEGORY_LABELS } from "../schemas/credit-card";
import type { Transaction } from "../schemas/transaction";
import type { WorkspaceKind } from "../schemas/workspace";

/** Utilization above this hurts credit scores, so it is the warning line. */
export const UTILIZATION_WARNING_BASIS_POINTS = 3_000;

/** Earn rate for a category, in reward units per dollar times 100. */
export function earnRateBasisPoints(profile: CreditCardProfile, category: RewardCategory): number {
  return profile.rates.find((r) => r.category === category)?.rateBasisPoints ?? profile.baseRateBasisPoints;
}

/**
 * What a dollar in this category is worth, in basis points of cash value.
 * 3x points at 1.25 cents each is 375 (3.75%).
 */
export function valueRateBasisPoints(profile: CreditCardProfile, category: RewardCategory): number {
  return Math.round((earnRateBasisPoints(profile, category) * profile.pointValueHundredthsOfCent) / 100);
}

/** "3%" for cash back, "3x" for points and miles. */
export function formatEarnRate(profile: CreditCardProfile, category: RewardCategory): string {
  const rate = earnRateBasisPoints(profile, category) / 100;
  const text = Number.isInteger(rate) ? String(rate) : rate.toFixed(2).replace(/0$/, "");
  return profile.rewardType === "cashback" ? `${text}%` : `${text}x`;
}

/**
 * Cash value in cents of rewards on `spendCents` in one category. Bonus caps
 * are yearly, so `capScale` shrinks them for shorter periods (3 months is 0.25).
 */
export function rewardValueCents(profile: CreditCardProfile, category: RewardCategory, spendCents: number, capScale = 1): number {
  if (spendCents <= 0) return 0;
  const bonus = profile.rates.find((r) => r.category === category);
  let units: number;
  if (bonus) {
    const cap = bonus.annualCapCents === null ? Infinity : Math.floor(bonus.annualCapCents * capScale);
    const bonusSpend = Math.min(spendCents, cap);
    units = bonusSpend * bonus.rateBasisPoints + (spendCents - bonusSpend) * profile.baseRateBasisPoints;
  } else {
    units = spendCents * profile.baseRateBasisPoints;
  }
  // units are cents times basis points; value is that times the point value (hundredths of a cent).
  return Math.round((units * profile.pointValueHundredthsOfCent) / 1_000_000);
}

export interface CardSummary {
  accountId: string;
  spendCents: number;
  rewardsCents: number;
  annualizedRewardsCents: number;
  annualFeeCents: number;
  /** Yearly rewards minus the annual fee. */
  netAnnualValueCents: number;
  owedCents: number;
  limitCents: number | null;
  /** Owed over limit, in basis points. Null when the limit is unknown. */
  utilizationBasisPoints: number | null;
}

export interface CategoryInsight {
  workspaceKind: WorkspaceKind;
  category: RewardCategory;
  spendCents: number;
  /** Rewards actually earned on the cards used. */
  earnedCents: number;
  bestAccountId: string;
  bestValueRateBasisPoints: number;
  /** Rewards if all of this spend had gone on the best card. */
  bestPossibleCents: number;
  missedCents: number;
  byCard: { accountId: string; spendCents: number }[];
}

export interface CardRecommendation {
  id: string;
  kind: "switch_card" | "utilization" | "annual_fee" | "missing_limit";
  severity: "info" | "warning";
  title: string;
  detail: string;
  /** Yearly gain from acting on it, when it can be estimated. */
  annualValueCents: number | null;
  accountId: string | null;
}

export interface CreditCardAnalysis {
  months: number;
  cards: CardSummary[];
  categories: CategoryInsight[];
  totals: {
    spendCents: number;
    rewardsCents: number;
    bestPossibleCents: number;
    missedCents: number;
    owedCents: number;
    limitCents: number;
    utilizationBasisPoints: number | null;
  };
  recommendations: CardRecommendation[];
}

/** Card purchases: expenses that took money out of a credit card account. */
export const isCardPurchase = (t: Pick<Transaction, "kind" | "amountCents">) => t.kind === "expense" && t.amountCents < 0;

const owed = (c: CreditCard) => Math.max(0, -c.balanceCents);
const utilization = (owedCents: number, limitCents: number | null) =>
  limitCents && limitCents > 0 ? Math.round((owedCents / limitCents) * 10_000) : null;
const pct = (bp: number) => `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : bp % 10 === 0 ? 1 : 2)}%`;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

/**
 * Rewards earned, rewards missed, utilization, and what to change.
 * `transactions` can include anything; only purchases on the given cards count.
 * `months` is the length of the period the transactions cover.
 */
export function analyzeCreditCards(cards: readonly CreditCard[], transactions: readonly Transaction[], months: number): CreditCardAnalysis {
  const capScale = months / 12;
  const annualize = (cents: number) => Math.round((cents * 12) / months);
  const cardById = new Map(cards.map((c) => [c.accountId, c]));

  // spend[accountId][category]
  const spend = new Map<string, Map<RewardCategory, number>>();
  for (const t of transactions) {
    const card = cardById.get(t.accountId);
    if (!card || !isCardPurchase(t)) continue;
    const category = rewardCategoryFor(t.category);
    const byCat = spend.get(card.accountId) ?? new Map<RewardCategory, number>();
    byCat.set(category, (byCat.get(category) ?? 0) - t.amountCents);
    spend.set(card.accountId, byCat);
  }

  const cardSummaries: CardSummary[] = cards.map((card) => {
    let spendCents = 0;
    let rewardsCents = 0;
    for (const [category, cents] of spend.get(card.accountId) ?? []) {
      spendCents += cents;
      rewardsCents += rewardValueCents(card.profile, category, cents, capScale);
    }
    const annualizedRewardsCents = annualize(rewardsCents);
    const owedCents = owed(card);
    return {
      accountId: card.accountId,
      spendCents,
      rewardsCents,
      annualizedRewardsCents,
      annualFeeCents: card.profile.annualFeeCents,
      netAnnualValueCents: annualizedRewardsCents - card.profile.annualFeeCents,
      owedCents,
      limitCents: card.profile.creditLimitCents,
      utilizationBasisPoints: utilization(owedCents, card.profile.creditLimitCents),
    };
  });

  // Group spend by workspace and category. The best card is picked from the same workspace,
  // so business spending is never routed to a personal card.
  const groups = new Map<string, { workspaceKind: WorkspaceKind; category: RewardCategory; byCard: Map<string, number> }>();
  for (const [accountId, byCat] of spend) {
    const card = cardById.get(accountId)!;
    for (const [category, cents] of byCat) {
      const key = `${card.workspaceKind}:${category}`;
      const g = groups.get(key) ?? { workspaceKind: card.workspaceKind, category, byCard: new Map<string, number>() };
      g.byCard.set(accountId, (g.byCard.get(accountId) ?? 0) + cents);
      groups.set(key, g);
    }
  }

  const categories: CategoryInsight[] = [];
  for (const g of groups.values()) {
    const spendCents = [...g.byCard.values()].reduce((s, v) => s + v, 0);
    const earnedCents = [...g.byCard].reduce((s, [id, cents]) => s + rewardValueCents(cardById.get(id)!.profile, g.category, cents, capScale), 0);
    let best: { card: CreditCard; value: number } | null = null;
    for (const card of cards) {
      if (card.workspaceKind !== g.workspaceKind) continue;
      const value = rewardValueCents(card.profile, g.category, spendCents, capScale);
      if (!best || value > best.value) best = { card, value };
    }
    if (!best) continue;
    categories.push({
      workspaceKind: g.workspaceKind,
      category: g.category,
      spendCents,
      earnedCents,
      bestAccountId: best.card.accountId,
      bestValueRateBasisPoints: valueRateBasisPoints(best.card.profile, g.category),
      bestPossibleCents: Math.max(best.value, earnedCents),
      missedCents: Math.max(0, best.value - earnedCents),
      byCard: [...g.byCard].map(([accountId, cents]) => ({ accountId, spendCents: cents })).sort((a, b) => b.spendCents - a.spendCents),
    });
  }
  categories.sort((a, b) => b.missedCents - a.missedCents || b.spendCents - a.spendCents);

  const owedTotal = cardSummaries.reduce((s, c) => s + c.owedCents, 0);
  const limitTotal = cardSummaries.reduce((s, c) => s + (c.limitCents ?? 0), 0);
  const allLimitsKnown = cardSummaries.every((c) => c.limitCents !== null);
  const totals = {
    spendCents: cardSummaries.reduce((s, c) => s + c.spendCents, 0),
    rewardsCents: cardSummaries.reduce((s, c) => s + c.rewardsCents, 0),
    bestPossibleCents: categories.reduce((s, c) => s + c.bestPossibleCents, 0),
    missedCents: categories.reduce((s, c) => s + c.missedCents, 0),
    owedCents: owedTotal,
    limitCents: limitTotal,
    utilizationBasisPoints: allLimitsKnown ? utilization(owedTotal, limitTotal) : null,
  };

  return { months, cards: cardSummaries, categories, totals, recommendations: recommend(cards, cardSummaries, categories, annualize) };
}

function recommend(
  cards: readonly CreditCard[],
  summaries: CardSummary[],
  categories: CategoryInsight[],
  annualize: (cents: number) => number,
): CardRecommendation[] {
  const name = (id: string) => cards.find((c) => c.accountId === id)?.name ?? "this card";
  const out: CardRecommendation[] = [];

  for (const c of categories) {
    const yearly = annualize(c.missedCents);
    if (yearly < 1_000) continue; // Under $10 a year is noise.
    const others = [...new Set(c.byCard.filter((b) => b.accountId !== c.bestAccountId).map((b) => name(b.accountId)))];
    out.push({
      id: `switch:${c.workspaceKind}:${c.category}`,
      kind: "switch_card",
      severity: "info",
      title: `Use ${name(c.bestAccountId)} for ${lowerFirst(REWARD_CATEGORY_LABELS[c.category])}`,
      detail: `${others.length ? `Most of this went on ${others.join(" and ")}. ` : ""}${name(c.bestAccountId)} returns ${pct(c.bestValueRateBasisPoints)} here, about ${dollars(yearly)} more a year.`,
      annualValueCents: yearly,
      accountId: c.bestAccountId,
    });
  }

  for (const s of summaries) {
    const card = cards.find((c) => c.accountId === s.accountId)!;
    if (s.utilizationBasisPoints !== null && s.utilizationBasisPoints > UTILIZATION_WARNING_BASIS_POINTS) {
      const target = Math.floor(((s.limitCents ?? 0) * UTILIZATION_WARNING_BASIS_POINTS) / 10_000);
      const closes = card.profile.statementDay ? ` before the statement closes on day ${card.profile.statementDay}` : " before the statement closes";
      out.push({
        id: `utilization:${s.accountId}`,
        kind: "utilization",
        severity: "warning",
        title: `${card.name} is at ${pct(s.utilizationBasisPoints)} utilization`,
        detail: `Pay about ${dollars(s.owedCents - target)}${closes} to get under 30%. Lower reported balances help your credit score.`,
        annualValueCents: null,
        accountId: s.accountId,
      });
    }
    if (s.annualFeeCents > 0 && s.netAnnualValueCents < 0) {
      out.push({
        id: `fee:${s.accountId}`,
        kind: "annual_fee",
        severity: "warning",
        title: `${card.name} costs more than it earns`,
        detail: `At this pace it earns about ${dollars(s.annualizedRewardsCents)} a year against a ${dollars(s.annualFeeCents)} fee. Move more bonus spending to it, or consider a no-fee version.`,
        annualValueCents: -s.netAnnualValueCents,
        accountId: s.accountId,
      });
    }
    if (s.limitCents === null) {
      out.push({
        id: `limit:${s.accountId}`,
        kind: "missing_limit",
        severity: "info",
        title: `Add the credit limit for ${card.name}`,
        detail: "Utilization tips need each card's limit.",
        annualValueCents: null,
        accountId: s.accountId,
      });
    }
  }

  const order = { utilization: 0, switch_card: 1, annual_fee: 2, missing_limit: 3 } as const;
  return out.sort((a, b) => order[a.kind] - order[b.kind] || (b.annualValueCents ?? 0) - (a.annualValueCents ?? 0));
}
