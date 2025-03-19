<script lang="ts">
  import * as Alert from '$ui/alert';
  import { fade } from 'svelte/transition';
  import ModrinthBadge from '$components/ModrinthBadge.svelte';
  import ModCollectionsForm from '$components/ModCollectionsForm.svelte';
  import type { PageProps } from '$routes/$types';

  const { data: pageData }: PageProps = $props();
  const [baseDuration, baseDelay] = [1000, 1000];
</script>

<section class="mx-auto max-w-3xl">
  <div
    class="mb-6 flex items-center justify-center"
    in:fade={{ duration: baseDuration, delay: baseDelay * 2.5 }}
  >
    <ModrinthBadge />
  </div>
  <div class="space-y-6 text-center md:space-y-9">
    <h1
      class="font-raleway text-3xl font-bold tracking-wide lg:text-6xl"
      in:fade={{ duration: baseDuration, delay: 0 }}
    >
      Mod Collections made Effortless.
    </h1>

    <p
      class="text-base text-muted-foreground lg:text-xl"
      in:fade={{ duration: baseDuration, delay: baseDelay }}
    >
      Simplify the tedium of downloading and organizing Modrinth collections
    </p>

    <div
      class=" w-full space-y-6 md:space-y-9"
      in:fade={{ duration: baseDuration, delay: baseDelay * 2.5 }}
    >
      <ModCollectionsForm {pageData} />
      <Alert.Root class="bg-muted/50">
        <Alert.Description class="text-sm tracking-wide text-muted-foreground">
          Select your <b>Mod Loader</b>, <b>Minecraft version</b> and paste your
          <b>Modrinth collection URL or ID(s)</b> above. We'll handle the rest, including dependency
          management and compatibility checks.
        </Alert.Description>
      </Alert.Root>
    </div>
  </div>
</section>
