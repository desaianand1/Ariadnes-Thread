<script lang="ts">
    import { fade } from 'svelte/transition';
    import { tweened } from 'svelte/motion';
    import { cubicOut } from 'svelte/easing';
    import CircleIcon from '@lucide/svelte/icons/circle';
    import CircleCheckBigIcon from '@lucide/svelte/icons/circle-check-big';
    import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
    import CircleXIcon from '@lucide/svelte/icons/circle-x';
    import { Spinner } from '$lib/components/ui/spinner';
    import { Progress } from '$lib/components/ui/progress';
    import { Button } from '$lib/components/ui/button';
    import { cn } from '$lib/utils';
    import { safeTransition } from '$lib/utils/motion';
    import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';

    export type StepStatus = 'pending' | 'loading' | 'complete' | 'warning' | 'error';

    export type LoadingState = {
        text: string;
        status?: StepStatus;
    };

    interface Props {
        states: LoadingState[];
        loading?: boolean;
        /** Externally controlled current step index (overrides auto-advance) */
        currentStep?: number;
        /** Externally controlled per-step statuses */
        stepStatuses?: StepStatus[];
        showProgress?: boolean;
        /** Heading shown above the steps */
        title?: string;
        /** Subtitle shown below the heading */
        description?: string;
        /** Optional message shown beneath the active step (e.g. "Waiting for Modrinth...") */
        statusMessage?: string;
        /** Callback when cancel is clicked. If provided, renders a cancel button. */
        onCancel?: () => void;
        /** Label for the cancel button */
        cancelLabel?: string;
        class?: string;
    }

    let {
        states,
        loading = false,
        currentStep = 0,
        stepStatuses = [],
        showProgress = false,
        title,
        description,
        statusMessage,
        onCancel,
        cancelLabel = 'Back to home',
        class: className
    }: Props = $props();

    const progress = tweened(0, { duration: 400, easing: cubicOut });

    const STEP_HEIGHT = 48;

    $effect(() => {
        if (!loading) {
            progress.set(0, { duration: 0 });
            return;
        }

        const baseProgress = states.length > 1 ? (currentStep / (states.length - 1)) * 100 : 100;
        progress.set(Math.min(100, Math.max(0, baseProgress)));
    });

    function resolveStatus(index: number): StepStatus {
        const explicit = stepStatuses[index] ?? states[index]?.status;
        if (explicit === 'warning' || explicit === 'error') return explicit;
        if (explicit === 'complete') return 'complete';
        if (explicit === 'loading') return 'loading';
        if (index < currentStep) return 'complete';
        if (index === currentStep) return 'loading';
        return 'pending';
    }

    const STEP_STATUS_TEXT_COLORS: Record<StepStatus, string> = {
        complete: 'text-emerald-700 dark:text-emerald-400',
        warning: 'text-amber-700 dark:text-amber-400',
        error: 'text-destructive',
        loading: 'text-foreground',
        pending: 'text-muted-foreground/60'
    };

    const PROGRESS_INDICATOR_COLORS: Record<string, string> = {
        error: '**:data-[slot=progress-indicator]:bg-destructive',
        warning:
            '**:data-[slot=progress-indicator]:bg-amber-600 dark:**:data-[slot=progress-indicator]:bg-amber-400',
        default:
            '**:data-[slot=progress-indicator]:bg-emerald-600 dark:**:data-[slot=progress-indicator]:bg-emerald-400'
    };

    let currentStatus = $derived(resolveStatus(currentStep));
    let indicatorColor = $derived(
        PROGRESS_INDICATOR_COLORS[currentStatus] ?? PROGRESS_INDICATOR_COLORS.default
    );
    let progressPercent = $derived(Math.round($progress));
</script>

{#if loading}
    <div
        class={cn(
            'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/90 backdrop-blur-2xl',
            className
        )}
        transition:fade={safeTransition({ duration: 250 })}
        role="status"
        aria-live="polite"
        aria-label="Loading"
    >
        <div class="flex w-full max-w-lg flex-col items-center gap-8 px-6">
            <!-- Header + progress -->
            <div class="flex w-full flex-col items-center gap-4 text-center">
                {#if title}
                    <h2 class="text-2xl font-semibold tracking-tight">{title}</h2>
                {/if}
                {#if description}
                    <p class="max-w-sm text-sm text-muted-foreground">{description}</p>
                {/if}

                {#if showProgress}
                    <div class="flex w-full items-center gap-3">
                        <Progress
                            value={$progress}
                            class={cn('h-2 flex-1 bg-muted', indicatorColor)}
                        />
                        <span class="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {progressPercent}%
                        </span>
                    </div>
                {/if}
            </div>

            <!-- Steps -->
            <div class="w-full space-y-1">
                {#each states as state, i (state.text)}
                    {@const status = resolveStatus(i)}
                    {@const color = STEP_STATUS_TEXT_COLORS[status]}
                    <div
                        class={cn(
                            'flex items-center gap-3.5 rounded-lg px-4 py-2.5 transition-all duration-300',
                            status === 'loading' && 'bg-muted/50'
                        )}
                        style:height="{STEP_HEIGHT}px"
                        style:opacity={status === 'pending' ? 0.45 : 1}
                    >
                        <span class={cn('shrink-0', color)}>
                            {#if status === 'complete'}
                                <CircleCheckBigIcon class="size-5" />
                            {:else if status === 'warning'}
                                <CircleAlertIcon class="size-5" />
                            {:else if status === 'error'}
                                <CircleXIcon class="size-5" />
                            {:else if status === 'loading'}
                                <Spinner class="size-5" />
                            {:else}
                                <CircleIcon class="size-5" />
                            {/if}
                        </span>

                        <div class="flex flex-col">
                            <span class={cn('text-sm font-medium', color)}>
                                {state.text}
                            </span>
                            {#if status === 'loading' && statusMessage}
                                <span
                                    class="text-xs text-muted-foreground"
                                    transition:fade={safeTransition({ duration: 150 })}
                                >
                                    {statusMessage}
                                </span>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>

            {#if onCancel}
                <Button variant="ghost" class="text-muted-foreground" onclick={onCancel}>
                    <ArrowLeftIcon class="mr-2 size-4" />
                    {cancelLabel}
                </Button>
            {/if}
        </div>
    </div>
{/if}
