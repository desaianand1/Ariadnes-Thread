type ModLoaderColorMap = {
  [key: string]: string;
};
const modLoaderToTailwindColorMap: ModLoaderColorMap = {
  fabric: 'text-yellow-800 dark:text-amber-400',
  forge: 'text-slate-500 dark:text-slate-300',
  quilt: 'text-violet-500 dark:text-violet-400',
  neoforge: 'text-orange-600 dark:text-orange-400',
  bukkit: 'text-sky-500 dark:text-sky-400',
  rift: 'text-gray-500 dark:text-gray-300',
  bungeecord: 'text-amber-600 text-amber-400',
  canvas: 'text-fuchsia-500 dark:text-fuchsia-400',
  datapack: 'text-rose-500 dark:text-rose-400',
  folia: 'text-green-500 dark:text-green-400',
  iris: 'text-neutral-600 dark:text-neutral-300',
  liteloader: 'text-slate-500 dark:text-slate-300',
  minecraft: 'text-emerald-500 dark:text-emerald-400',
  modloader: 'text-gray-500 dark:text-gray-300',
  optifine: 'text-zinc-500 dark:text-zinc-300',
  paper: 'text-pink-500 dark:text-pink-400',
  purpur: 'text-purple-500 dark:text-purple-400',
  spigot: 'text-yellow-600 dark:text-amber-400',
  sponge: 'text-yellow-500 dark:text-yellow-400',
  vanilla: 'text-zinc-500 dark:text-zinc-300',
  velocity: 'text-indigo-500 dark:text-indigo-400',
  waterfall: 'text-blue-500 dark:text-blue-400'
};

export function getTextColorByModLoader(modLoaderSlug: string): string {
  return modLoaderToTailwindColorMap[modLoaderSlug] || 'text-foreground';
}

/**
 * Converts a 7-digit decimal color value to a hexadecimal color string.
 * @param decimalColor A number between 0 and 9999999 representing the color in decimal.
 * @returns A string representing the color in hexadecimal (e.g., "#123456").
 * @throws An error if the input is out of range or invalid.
 */
export function convertDecimalToHex(decimalColor: number | undefined): string | undefined {
  if (
    decimalColor === undefined ||
    !Number.isInteger(decimalColor) ||
    decimalColor < 0 ||
    decimalColor > 9999999
  ) {
    // invalid input, fail
    return undefined;
  }
  const hexColor = decimalColor.toString(16).toUpperCase().padStart(6, '0');
  return `#${hexColor}`;
}
