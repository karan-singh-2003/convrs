import { z } from "zod";
import { R2_URL } from "@repo/utils";
import { fileTypeFromBuffer } from "file-type";

const allowedImageTypes = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

// Base64 encoded image
export const base64ImageSchema = z
  .string()
  .trim()
  .regex(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/, {
    message: "Invalid image format, supports only png, jpeg, jpg, gif, webp.",
  })
  .refine(
    async (str) => {
      const base64Data = str.split(",")[1];

      if (!base64Data) {
        return false;
      }

      try {
        const buffer = new Uint8Array(Buffer.from(base64Data, "base64"));
        const fileType = await fileTypeFromBuffer(buffer);

        return fileType && allowedImageTypes.includes(fileType.mime);
      } catch (e) {
        return false;
      }
    },
    {
      message: "Invalid image format, supports only png, jpeg, jpg, gif, webp.",
    }
  )
  .transform((v) => v || null);

export const storedR2ImageUrlSchema = z
  .url()
  .trim()
  .refine((url) => url.startsWith(R2_URL), {
    message: `URL must start with ${R2_URL}`,
  });

export const uploadedImageSchema = z
  .union([base64ImageSchema, storedR2ImageUrlSchema])
  .transform((v) => v || null);

export const booleanQuerySchema = z
  .stringbool({
    truthy: ["true"],
    falsy: ["false"],
  })
  .meta({
    type: "boolean",
  });
