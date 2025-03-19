import {
  fetchMinecraftVersions,
  type MinecraftVersionType,
  type ModrinthMinecraftVersion
} from '$api/game-version';
import { setCachedData, getCachedData } from '$utils/cache';
import { DateTime } from 'luxon';

export interface SelectMinecraftVersionItem {
  label: string;
  value: string;
  versionType: MinecraftVersionType;
  isMajorVersion: boolean;
  date: DateTime;
}

export interface MinecraftVersionState {
  versions: SelectMinecraftVersionItem[];
  isLoading: boolean;
}

const initialState: MinecraftVersionState = { versions: [], isLoading: true };
const storageKey = 'modrinth-minecraft-version';
const cacheExpirationTime = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

let state: MinecraftVersionState = $state(initialState);

async function loadMinecraftVersions(isBrowserEnvironment: boolean = true) {
  try {
    const cachedVersions = isBrowserEnvironment
      ? getCachedData<SelectMinecraftVersionItem[]>(storageKey, cacheExpirationTime)
      : null;
    if (cachedVersions) {
      state.versions = cachedVersions;
    } else {
      const versions = await fetchMinecraftVersions();
      state.versions = versions.map(formatMinecraftVersion);
      if (isBrowserEnvironment) {
        setCachedData<SelectMinecraftVersionItem[]>(storageKey, state.versions);
      }
    }
  } catch (error) {
    console.error('Error loading mod loaders:', error);
  } finally {
    state.isLoading = false;
  }
}

function formatMinecraftVersion(v: ModrinthMinecraftVersion): SelectMinecraftVersionItem {
  return {
    label: v.version.toLowerCase(),
    value: v.version.toLowerCase(),
    versionType: v.version_type,
    isMajorVersion: v.major,
    date: v.date
  };
}

export { state as versionState, loadMinecraftVersions };
