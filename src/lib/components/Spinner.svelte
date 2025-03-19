<script lang="ts">
  import { cn } from '$lib/utils';
  import type { Snippet } from 'svelte';

  type SpinnerVariant =
    | 'concentric-ring'
    | 'delayed-rotation-ring'
    | 'bouncing-dot'
    | 'blinking-eyes';
  interface SpinnerProps {
    containerClassNames?: string;
    spinnerClassNames?: string;
    children?: Snippet;
    type?: SpinnerVariant;
  }
  const {
    containerClassNames: container,
    spinnerClassNames: classNames,
    children,
    type = 'concentric-ring'
  }: SpinnerProps = $props();

  const defaultSpinnerClassNames = 'w-4 h-4 text-secondary';
</script>

{#snippet spinnerSvg(type: SpinnerVariant, classNames: string | undefined)}
  {#if type === 'concentric-ring'}
    <svg
      class={cn(defaultSpinnerClassNames, classNames)}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      ><path
        d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"
        class="fill-slate-400 opacity-30"
      /><path
        d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"
        class="0.75s origin-center animate-spin fill-current ease-linear repeat-infinite"
      />
    </svg>
  {:else if type === 'delayed-rotation-ring'}
    <svg
      class={cn(defaultSpinnerClassNames, classNames)}
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      ><g class="animated-spinner"
        ><circle cx="12" cy="12" r="9.5" fill="none" stroke-width="3"></circle></g
      ></svg
    >
  {:else if type === 'blinking-eyes'}
    <div class="animated-blinking-eyes"></div>
  {:else}
    <svg
      class={cn(defaultSpinnerClassNames, classNames)}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      ><ellipse class="animated-bouncing-dot" cx="12" cy="5" rx="4" ry="4" /></svg
    >
  {/if}
{/snippet}

{#if children === undefined}
  {@render spinnerSvg(type, classNames)}
{:else}
  <div
    class={cn(
      'flex items-center justify-center gap-3 rounded-md border border-border p-2 shadow-sm shadow-border/60 dark:shadow-border/20',
      container
    )}
  >
    {@render spinnerSvg(type, classNames)}
    {@render children?.()}
  </div>
{/if}
