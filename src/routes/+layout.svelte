<script lang="ts">
    import './layout.css';
    import { ModeWatcher } from 'mode-watcher';
    import Header from '$lib/components/layout/Header.svelte';
    import Footer from '$lib/components/layout/Footer.svelte';
    import LoadingBar from '$lib/components/layout/LoadingBar.svelte';

    let { children } = $props();
</script>

<ModeWatcher />

<div class="flex min-h-screen flex-col">
    <LoadingBar />
    <Header />
    <main class="flex-1">
        {@render children()}
    </main>
    <Footer />
</div>
