<script lang="ts">
  import Sun from 'lucide-svelte/icons/sun';
  import Moon from 'lucide-svelte/icons/moon';
  import System from 'lucide-svelte/icons/monitor-cog';
  import { mode, resetMode, setMode } from 'mode-watcher';
  import { buttonVariants } from '$ui/button';
  import * as DropdownMenu from '$ui/dropdown-menu';
  import { cn } from '$lib/utils';

  interface ThemeSwitcherProps {
    variant?: 'link' | 'secondary' | 'default' | 'destructive' | 'outline' | 'ghost' | undefined;
    size?: 'default' | 'sm' | 'lg' | 'icon' | undefined;
  }

  let { variant = 'ghost', size = 'icon' }: ThemeSwitcherProps = $props();
  const isDarkMode = $derived($mode === 'dark');
  const themes = [
    { name: 'Light', icon: Sun, action: () => setMode('light') },
    { name: 'Dark', icon: Moon, action: () => setMode('dark') },
    { name: 'Auto', icon: System, action: resetMode }
  ];
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger
    class={cn(buttonVariants({ variant, size }), 'rounded-lg hover:bg-popover-foreground/10')}
  >
    <div class="relative">
      {#each [Sun, Moon] as Icon, index}
        <Icon
          class={cn(
            'h-12 w-12 transition-all duration-300 ease-in-out',
            isDarkMode === (index === 1)
              ? 'absolute top-0 left-0 rotate-0 scale-100 opacity-100'
              : `${index === 0 ? '' : '-'}rotate-90 scale-0 opacity-0`
          )}
        />
        <div class="w-min"></div>
      {/each}
    </div>
    <span class="sr-only">Toggle theme</span>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="center">
    {#each themes as { name, icon: Icon, action }}
      <DropdownMenu.Item onclick={action}>
        <span
          class="flex w-full py-2 gap-3 items-center justify-center hover:bg-popover-foreground/10 transition-colors duration-300 ease-in-out rounded-lg"
        >
          <Icon class="h-5 w-5" />{name}
        </span>
      </DropdownMenu.Item>
    {/each}
  </DropdownMenu.Content>
</DropdownMenu.Root>
