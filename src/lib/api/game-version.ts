import { apiClient } from '$api/client';
import { DateTime } from 'luxon';
import { handleError } from '$api/error';

export type MinecraftVersionType = 'alpha' | 'beta' | 'snapshot' | 'release';
interface ModrinthMinecraftVersionResponse {
  version: string;
  version_type: MinecraftVersionType;
  date: string;
  major: boolean;
}
export interface ModrinthMinecraftVersion extends Omit<ModrinthMinecraftVersionResponse, 'date'> {
  date: DateTime;
}
export async function fetchMinecraftVersions(): Promise<ModrinthMinecraftVersion[]> {
  try {
    const response = await apiClient.request<ModrinthMinecraftVersionResponse[]>('tag', 'v2', [
      'game_version'
    ]);
    return response
      .map((r) => {
        return {
          ...r,
          date: DateTime.fromISO(r.date)
        };
      })
      .toSorted((a, b) => b.date.toMillis() - a.date.toMillis());
  } catch (error) {
    handleError(error);
    throw error;
  }
}
