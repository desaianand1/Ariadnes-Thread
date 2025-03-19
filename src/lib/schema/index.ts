import { z } from 'zod';

export const downloadCollectionsSchema = z.object({
  collectionUrls: z
    .array(
      z
        .string()
        .nonempty('Modrinth collection URL or ID cannot be left blank')
        .url('Enter a valid Modrinth collection URL')
        .or(
          z
            .string()
            .nonempty('Modrinth collection URL or ID cannot be left blank')
            .regex(/^[a-zA-Z0-9]+$/, 'Invalid Modrinth Collection ID. Did you copy it completely?')
        )
    )
    .min(1, 'Modrinth collection URL or ID cannot be left blank')
    .max(7, 'Cannot download more collections at once'),
  modLoader: z.string().nonempty('Mod Loader is required'),
  minecraftVersion: z.string().nonempty('Minecraft version is required')
});

export type DownloadCollectionsSchema = typeof downloadCollectionsSchema;
