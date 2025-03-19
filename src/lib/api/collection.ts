import { ClientError, handleError, RateLimitError, ServerError } from '$api/error';
import { apiClient, type ModrinthAPIVersion } from '$api/client';
import { DateTime } from 'luxon';
import { convertDecimalToHex } from '$utils/colors';

interface ModrinthCollectionResponse {
  id: string;
  user: string;
  name: string;
  description: string;
  icon_url: string;
  color?: number;
  status: 'listed' | 'unlisted' | 'private';
  created: string;
  updated: string;
  projects: string[];
}

export interface ModrinthCollection
  extends Omit<ModrinthCollectionResponse, 'created' | 'updated' | 'color'> {
  color?: string;
  created: DateTime;
  updated: DateTime;
}

async function getCollection(
  id: string,
  apiVersion: ModrinthAPIVersion = 'v3'
): Promise<ModrinthCollection> {
  try {
    // As of Jan 2025, Modrinth's API only has a collection endpoint on v3
    const response = await apiClient.request<ModrinthCollectionResponse>('collection', apiVersion, [
      id
    ]);
    return {
      ...response,
      color: convertDecimalToHex(response.color),
      created: DateTime.fromISO(response.created),
      updated: DateTime.fromISO(response.updated)
    };
  } catch (error) {
    // Fallback to v2 if v3 fails
    if (apiVersion === 'v3' && error instanceof ClientError && error.status === 410) {
      return await getCollection(id, 'v2');
    } else {
      //TODO: add toast for errors
      handleError(error);
    }
    throw error;
  }
}

async function getSeveralCollections(ids: string[]): Promise<ModrinthCollection[]> {
  const collectionPromises = ids.map((id) => getCollection(id));
  const results = await Promise.allSettled(collectionPromises);
  const failedResults = results.filter((r) => r.status === 'rejected');
  //TODO: show failed results on screen or via toast
  const successfulResults = results.filter((r) => r.status === 'fulfilled');
  return successfulResults.map((s) => s.value);
}

export { getCollection, getSeveralCollections };
