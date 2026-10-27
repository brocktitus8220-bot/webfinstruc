import type { RewardCategory } from "../schemas/credit-card";

/**
 * Transaction category labels (from Plaid, statement imports, and manual
 * entry) mapped to reward categories. Keys are lowercase.
 */
const CATEGORY_MAP: Record<string, RewardCategory> = {
  dining: "dining",
  restaurants: "dining",
  meals: "dining",
  "food and drink": "dining",
  coffee: "dining",
  groceries: "groceries",
  grocery: "groceries",
  supermarkets: "groceries",
  gas: "gas",
  fuel: "gas",
  "ev charging": "gas",
  travel: "travel",
  airlines: "travel",
  hotels: "travel",
  lodging: "travel",
  "car rental": "travel",
  transit: "transit",
  transportation: "transit",
  rideshare: "transit",
  parking: "transit",
  streaming: "streaming",
  shopping: "online_shopping",
  "online shopping": "online_shopping",
  "general merchandise": "online_shopping",
  drugstores: "drugstores",
  pharmacy: "drugstores",
  entertainment: "entertainment",
  recreation: "entertainment",
  utilities: "utilities",
  phone: "utilities",
  internet: "utilities",
  software: "software",
  "online services": "software",
};

export function rewardCategoryFor(category: string): RewardCategory {
  return CATEGORY_MAP[category.trim().toLowerCase()] ?? "other";
}
