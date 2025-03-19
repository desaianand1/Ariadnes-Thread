import { apiClient } from '$api/client';
import { handleError } from '$api/error';
import DOMPurify from 'dompurify';
export type ModrinthProjectType =
  | 'mod'
  | 'modpack'
  | 'resourcepack'
  | 'shader'
  | 'plugin'
  | 'datapack';

interface ModrinthModLoaderResponse {
  icon: string;
  name: string;
  supported_project_types: ModrinthProjectType[];
}

export interface ModrinthModLoader
  extends Omit<ModrinthModLoaderResponse, 'icon' | 'supported_project_types'> {
  iconSvg: string;
  supportedProjectTypes: Set<ModrinthProjectType>;
  isPlugin: boolean;
  isPopular: boolean;
}

export async function fetchModLoaders(
  isBrowserEnvironment: boolean = true
): Promise<ModrinthModLoader[]> {
  try {
    if (!isBrowserEnvironment) return [];
    const response = await apiClient.request<ModrinthModLoaderResponse[]>('tag', 'v2', ['loader']);
    return response
      .map((r) => {
        return {
          ...r,
          iconSvg: DOMPurify.sanitize(r.icon, {
            ADD_TAGS: ['use']
          }),
          supportedProjectTypes: new Set<ModrinthProjectType>(r.supported_project_types),
          isPlugin: isPlugin(r),
          isPopular: isPopular(r)
        };
      })
      .filter(filterApplicableLoaders);
  } catch (error) {
    handleError(error);
    throw error;
  }
}

function filterApplicableLoaders(loader: ModrinthModLoader) {
  const blackList = new Set(['minecraft', 'modloader', 'canvas', 'iris', 'optifine', 'vanilla']);
  return !blackList.has(loader.name);
}

function isPlugin(item: ModrinthModLoaderResponse): boolean {
  return item.supported_project_types.includes('plugin');
}

function isPopular(item: ModrinthModLoaderResponse): boolean {
  const popularLoaders = new Set<string>(['fabric', 'forge', 'neoforge']);
  return popularLoaders.has(item.name);
}
