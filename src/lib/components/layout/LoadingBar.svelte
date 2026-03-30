<script lang="ts">
    import { navigating } from '$app/state';
</script>

{#if navigating.to}
    <div class="loading-bar" aria-hidden="true"></div>
{/if}

<style>
    .loading-bar {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 100;
        height: 2px;
        background: var(--color-primary);
        animation: loading 2s ease-out forwards;
    }

    @keyframes loading {
        0% {
            width: 0%;
        }
        100% {
            width: 90%;
        }
    }
</style>
