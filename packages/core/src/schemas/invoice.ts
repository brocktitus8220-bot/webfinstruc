import { z } from "zod";
import { Cents, Id, IsoDate } from "./common";

export const InvoiceStatus = z.enum(["draft", "sent", "paid", "overdue"]);
export type InvoiceStatus = z.infer<typeof InvoiceStatus>;

export const Invoice = z.object({
  id: Id,
  workspaceId: Id,
  number: z.string().min(1),
  client: z.string().min(1),
  issueDate: IsoDate,
  dueDate: IsoDate,
  amountCents: Cents,
  status: InvoiceStatus,
  paidDate: IsoDate.nullable(),
});
export type Invoice = z.infer<typeof Invoice>;

export const CreateInvoiceInput = z
  .object({
    client: z.string().trim().min(1, "Client is required").max(140),
    number: z.string().trim().min(1, "Invoice number is required").max(40),
    issueDate: IsoDate,
    dueDate: IsoDate,
    amountCents: Cents.positive("Amount must be greater than zero"),
    status: InvoiceStatus.default("sent"),
  })
  .refine((v) => v.dueDate >= v.issueDate, {
    message: "Due date must be on or after the issue date",
    path: ["dueDate"],
  });
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInput>;
