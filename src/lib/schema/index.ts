import { z } from "zod";

export const collectionSchema = z.object({
    collectionUrl: z
      .string()
      .min(1, "Please enter a Modrinth collection URL or ID")
      .refine(
        (value) => {
          const urlPattern = /^(https:\/\/modrinth\.com\/collection\/[a-zA-Z0-9-]+|[a-zA-Z0-9-]+)$/;
          return urlPattern.test(value);
        },
        {
          message: "Please enter a valid Modrinth collection URL or ID",
        }
      ),
  });