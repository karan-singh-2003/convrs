import {z} from "zod";
import { uploadedImageSchema } from "./misc";
export const trim = (u: unknown) => (typeof u === "string" ? u.trim() : u);

export const updateUserSchema = z.object({
    name: z.preprocess(trim,z.string().min(1).max(64)).optional(),
    email: z.preprocess(trim,z.email()).optional(),
    image: uploadedImageSchema.nullish()
});