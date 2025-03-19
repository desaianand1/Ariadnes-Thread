<script lang="ts">
  import { ModeWatcher } from 'mode-watcher';
  import { Toaster } from '$ui/sonner';
  import Navbar from '$components/Navbar.svelte';
  import Footer from '$components/Footer.svelte';
  import '../app.css';

  let { children } = $props();
</script>

<ModeWatcher />
<Toaster />
<div class="min-h-screen font-sans transition-colors duration-200 ease-in-out">
  <header>
    <Navbar />
  </header>

  <main class="container mx-auto px-4 py-8">
    {@render children()}
  </main>

  <Footer />
</div>
