import { fetchModLoaders, type ModrinthModLoader } from '$api/mod-loader';
import { getTextColorByModLoader } from '$utils/colors';
import { setCachedData, getCachedData } from '$utils/cache';

type SelectModLoaderSection = 'none' | 'pinned-to-top' | 'plugins';
export interface SelectModLoaderItem {
  label: string;
  value: string;
  iconSvg?: string;
  colorClassName: string;
  section: SelectModLoaderSection;
}

export interface ModLoaderState {
  modLoaders: SelectModLoaderItem[];
  isLoading: boolean;
}

const initialState: ModLoaderState = { modLoaders: [], isLoading: true };
const storageKey = 'modrinth-mod-loaders';
const cacheExpirationTime = 2 * 60 * 60 * 1000; // 2 hours  in milliseconds

let state: ModLoaderState = $state(initialState);

async function loadModLoaders(isBrowserEnvironment: boolean = true) {
  try {
    const cachedLoaders = isBrowserEnvironment
      ? getCachedData<SelectModLoaderItem[]>(storageKey, cacheExpirationTime)
      : null;
    if (cachedLoaders) {
      state.modLoaders = cachedLoaders;
    } else {
      const loaders = await fetchModLoaders(isBrowserEnvironment);
      state.modLoaders = loaders.map(formatModLoader);
      if (isBrowserEnvironment) {
        setCachedData(storageKey, state.modLoaders);
      }
    }
  } catch (error) {
    console.error('Error loading mod loaders:', error);
  } finally {
    state.isLoading = false;
  }
}

function formatModLoader(loader: ModrinthModLoader): SelectModLoaderItem {
  return {
    label: loader.name.charAt(0).toUpperCase() + loader.name.slice(1).toLowerCase(),
    value: loader.name.toLowerCase(),
    iconSvg: loader.iconSvg,
    colorClassName: getTextColorByModLoader(loader.name),
    section: assignSection(loader)
  };
}

function assignSection(loader: ModrinthModLoader): SelectModLoaderSection {
  if (loader.isPlugin) {
    return 'plugins';
  } else if (loader.isPopular) {
    return 'pinned-to-top';
  } else {
    return 'none';
  }
}

export { state as modLoaderState, loadModLoaders };
