<script lang="ts">
  import { onMount } from 'svelte';
  import { updateTheme } from '$lib/theme';
  
  onMount(() => {
    updateTheme();
  });
</script>

<main>

  <p class="read-the-docs">
    Click on the Vite and Svelte logos to learn more
  </p>
</main>
