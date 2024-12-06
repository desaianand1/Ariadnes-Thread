<script lang="ts">
  import { Sun, Moon, Laptop } from 'lucide-svelte';
  import { getTheme, setTheme, type Theme } from '../theme';

  let theme = $state(getTheme());

  $effect(() => {
    setTheme(theme);
  });
</script>

<div class="flex gap-2 items-center">
  <button
    class="p-2 rounded-lg hover:bg-muted"
    class:text-primary={theme === 'light'}
    onclick={() => (theme = 'light')}
    aria-label="Light theme"
  >
    <Sun size={20} />
  </button>

  <button
    class="p-2 rounded-lg hover:bg-muted"
    class:text-primary={theme === 'system'}
    onclick={() => (theme = 'system')}
    aria-label="System theme"
  >
    <Laptop size={20} />
  </button>

  <button
    class="p-2 rounded-lg hover:bg-muted"
    class:text-primary={theme === 'dark'}
    onclick={() => (theme = 'dark')}
    aria-label="Dark theme"
  >
    <Moon size={20} />
  </button>
</div>
