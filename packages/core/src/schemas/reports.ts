import { z } from "zod";
import { Cents, IsoDate, IsoMonth } from "./common";

export const BalancePoint = z.object({ date: IsoDate, balanceCents: Cents });
export type BalancePoint = z.infer<typeof BalancePoint>;

export const MonthlyTotal = z.object({ month: IsoMonth, amountCents: Cents });
export type MonthlyTotal = z.infer<typeof MonthlyTotal>;
