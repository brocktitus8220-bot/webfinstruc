import { z } from "zod";
import { Id, IsoDateTime } from "./common";

export const UserType = z.enum(["freelancer", "founder", "creator", "other"]);
export type UserType = z.infer<typeof UserType>;

export const User = z.object({
  id: Id,
  email: z.string().email(),
  name: z.string().min(1),
  userType: UserType.nullable(),
  createdAt: IsoDateTime,
});
export type User = z.infer<typeof User>;
