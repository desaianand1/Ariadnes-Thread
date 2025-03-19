<script lang="ts">
  import { Input } from '$ui/input';
  import * as Form from '$ui/form';
  import { Button } from '$ui/button';
  import { Plus, Minus } from 'lucide-svelte';
  import { slide } from 'svelte/transition';

  interface CollectionsInputProps {
    value: string[];
    form
    name: string;
    id: string;
    'data-fs-error': string | undefined;
    'aria-describedby': string | undefined;
    'aria-invalid': 'true' | undefined;
    'aria-required': 'true' | undefined;
    'data-fs-control': string;
  }

  let { value: collectionUrls,form, ...remaining }: CollectionsInputProps = $props();

  let fieldCount = $derived(collectionUrls.length || 1);

  function addField() {
    if (fieldCount < 7) {
      collectionUrls = [...(collectionUrls || []), ''];
    }
  }

  function removeField(index: number) {
    if (fieldCount > 1) {
      collectionUrls = collectionUrls.filter((_, i) => i !== index);
    }
  }
</script>

<!-- {#snippet collectionUrlInput(
  values: string[],
  boundIndex: number,
  remainingProps: Omit<CollectionsInputProps, 'value'>
)}
  <Input
    type="text"
    placeholder="Paste your Modrinth collection URL or ID"
    class="focus:ring-2"
    bind:value={values[boundIndex]}
    {...remainingProps}
  />
{/snippet}

{#if isSingleInputField}
  {@render collectionUrlInput(value, 0, remaining)}
{:else}
  {#each value as url, index (index)}
    <div class="flex w-full items-center gap-2">
      {@render collectionUrlInput(value, index, remaining)}
    </div>
  {/each}
{/if} -->

<div class="space-y-4">
  {#each Array(fieldCount) as _, i}
    <div transition:slide class="flex items-center gap-2">
      <Form.Field class="w-full" {form} name={`collectionUrl-${i}`}>
        <Form.Control>
          <div class="flex gap-2">
            <Input
              type="text"
              placeholder="Enter collection URL or ID"
              bind:value={collectionUrls[i]}
            />
            {#if i > 0}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onclick={() => removeField(i)}
                class="flex-shrink-0"
              >
                <Minus class="h-4 w-4" />
              </Button>
            {/if}
          </div>
        </Form.Control>
        <Form.FieldErrors class="ps-2 text-start text-xs text-rose-500" />
      </Form.Field>



      <Form.Field class="w-full" {form} name="collectionUrls">
        <Form.Control>
          {#snippet children({ props })}
            <CollectionsInput value={$formData.collectionUrls} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors class="ps-2 text-start text-xs text-rose-500" />
      </Form.Field>





    </div>
  {/each}

  {#if fieldCount < 7}
    <Button type="button" variant="outline" onclick={addField} class="w-full">
      <Plus class="mr-2 h-4 w-4" />
      Add More
    </Button>
  {/if}
</div>
