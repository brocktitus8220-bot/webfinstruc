import { randomUUID } from "node:crypto";

/** Prefixed random id, for example `tx_3f9c...`. */
export const newId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "")}`;
