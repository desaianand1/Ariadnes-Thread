<script lang="ts">
    import type { Snippet } from 'svelte';
    import * as AlertDialog from '$lib/components/ui/alert-dialog';

    interface Props {
        projectTitle: string;
        onConfirm: () => void;
        trigger: Snippet<[{ props: Record<string, unknown> }]>;
    }

    let { projectTitle, onConfirm, trigger }: Props = $props();
</script>

<AlertDialog.Root>
    <AlertDialog.Trigger>
        {#snippet child({ props })}
            {@render trigger({ props })}
        {/snippet}
    </AlertDialog.Trigger>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>Exclude {projectTitle}?</AlertDialog.Title>
            <AlertDialog.Description>
                This mod won't be included in the ZIP download. You can restore it anytime from the
                mod list.
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onclick={onConfirm}>Exclude</AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
