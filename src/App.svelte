<script lang="ts">
  import { ModeWatcher } from 'mode-watcher';
  import { Toaster } from '$ui/sonner';
  import Navbar from '$components/Navbar.svelte';
  import Footer from '$components/Footer.svelte';
  import * as Alert from '$ui/alert';
  import { fade } from 'svelte/transition';
  import ModrinthBadge from '$components/ModrinthBadge.svelte';
  import ModCollectionsForm from '$components/ModCollectionsForm.svelte';

  const [baseDuration, baseDelay] = [1000, 1000];
</script>

<ModeWatcher />
<Toaster />
<div class="min-h-screen bg-background text-foreground font-sans">
  <header>
    <Navbar />
  </header>

  <main class="container mx-auto px-4 py-8">
    <section class="max-w-3xl mx-auto">
      <div
        class="mb-6 flex items-center justify-center"
        in:fade={{ duration: baseDuration, delay: baseDelay * 1.5 }}
      >
        <ModrinthBadge />
      </div>
      <div class="space-y-6 md:space-y-12 text-center">
        <h1
          class="text-4xl md:text-6xl font-bold tracking-wide font-raleway"
          in:fade={{ duration: baseDuration, delay: 0 }}
        >
          Mod Collections made Effortless.
        </h1>

        <p
          class="text-lg md:text-xl text-muted-foreground"
          in:fade={{ duration: baseDuration, delay: baseDelay }}
        >
          Simplify the tedium of downloading and organizing Modrinth collections
        </p>

        <div
          class=" w-full space-y-6 md:space-y-9"
          in:fade={{ duration: baseDuration, delay: baseDelay * 1.5 }}
        >
          <ModCollectionsForm />
          <Alert.Root class="bg-muted/50">
            <Alert.Description class="tracking-wide text-sm text-muted-foreground">
              Select your <b>Mod Loader</b>, <b>Minecraft version</b> and paste your
              <b>Modrinth collection URL or ID(s)</b> above. We'll handle the rest, including dependency
              management and compatibility checks.
            </Alert.Description>
          </Alert.Root>
        </div>
      </div>
    </section>
  </main>
  <Footer />
</div>
