type ModLoaderColorMap = {
  [key: string]: string;
};
const modLoaderToTailwindColorMap: ModLoaderColorMap = {
  fabric: 'text-yellow-800',
  forge: 'text-slate-500',
  quilt: 'text-violet-500',
  neoforge: 'text-orange-600',
  bukkit: 'text-sky-500',
  rift: 'text-gray-500',
  bungeecord: 'text-amber-600',
  canvas: 'text-fuchsia-500',
  datapack: 'text-rose-500',
  folia: 'text-green-500',
  iris: 'text-neutral-600',
  liteloader: 'text-slate-500',
  minecraft: 'text-emerald-500',
  modloader: 'text-gray-500',
  optifine: 'text-zinc-500',
  paper: 'text-pink-500',
  purpur: 'text-purple-500',
  spigot: 'text-yellow-600',
  sponge: 'text-yellow-500',
  vanilla: 'text-zinc-500',
  velocity: 'text-indigo-500',
  waterfall: 'text-blue-500'
};

export function getTextColorByModLoader(modLoaderSlug: string): string {
  return modLoaderToTailwindColorMap[modLoaderSlug] || 'text-foreground';
}
