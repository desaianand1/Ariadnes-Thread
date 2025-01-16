import { ClientError, RateLimitError, ServerError } from '$api/error';
import { apiClient } from '$api/client';
import type { DateTime } from 'luxon';

interface ModrinthCollection {
  id: string;
  user: string;
  name: string;
  description: string;
  icon_url: string;
  color?: number;
  status: 'listed' | 'unlisted' | 'private';
  created: DateTime;
  updated: DateTime;
  projects: string[];
}

async function getCollection(id: string): Promise<ModrinthCollection> {
  try {
    // Try v3 first
    return await apiClient.request<ModrinthCollection>('collection', 'v3', [id]);
  } catch (error) {
    // Fallback to v2 if v3 fails
    if (error instanceof ClientError && error.status === 410) {
      return await apiClient.request<ModrinthCollection>('collection', 'v2', [id]);
    } else if (error instanceof ServerError) {
      //TODO: throw toast showing that server is unavailable. Try again later
    } else if (error instanceof RateLimitError && error.retryAfter === 'never') {
      //TODO: throw toast showing that you are rate limited hard and failed all retries. Fatal failure
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
  return successfulResults.map(s => s.value)
}
