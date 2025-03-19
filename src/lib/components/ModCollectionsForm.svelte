<script lang="ts">
  import * as Form from '$ui/form';
  import { crossfade } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import { CloudDownload, FileX } from 'lucide-svelte';
  import SelectModLoader from '$components/SelectModLoader.svelte';
  import SelectMinecraftVersion from '$components/SelectMinecraftVersion.svelte';
  import { superForm } from 'sveltekit-superforms';
  import SuperDebug from 'sveltekit-superforms';
  import { zod } from 'sveltekit-superforms/adapters';
  import { downloadCollectionsSchema } from '$schema';
  import { envConfig } from '$config/env';
  import type { PageData } from '$routes/$types';
  import Spinner from '$components/Spinner.svelte';
  import { browser } from '$app/environment';
    import CollectionsInput from '$components/CollectionsInput.svelte';

  let {
    pageData
  }: {
    pageData: PageData;
  } = $props();

  const [send, receive] = crossfade({
    duration: 300,
    easing: quintOut
  });
  const form = superForm(pageData.form, {
    SPA: true,
    validators: zod(downloadCollectionsSchema),
    delayMs: 800,
    timeoutMs: 8000
  });
  const { form: formData, enhance, timeout, delayed } = form;
  let showLoadingIndicator = $derived($timeout || $delayed);
</script>

<form method="POST" use:enhance>
  <div class="flex flex-col items-center gap-3">
    <div
      class="flex w-full flex-col items-center justify-center gap-3 md:flex-row md:justify-start"
    >
      <Form.Field {form} class="w-full md:min-w-44 md:max-w-fit" name="modLoader">
        <Form.Control>
          {#snippet children({ props })}
            <SelectModLoader value={$formData.modLoader} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors class="ps-2 text-start text-xs text-rose-500" />
      </Form.Field>
      <Form.Field class="w-full md:min-w-44 md:max-w-fit" {form} name="minecraftVersion">
        <Form.Control>
          {#snippet children({ props })}
            <SelectMinecraftVersion value={$formData.minecraftVersion} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors class="ps-2 text-start text-xs text-rose-500" />
      </Form.Field>
    </div>
    <div class="flex w-full flex-col gap-3 md:flex-row">
      <!-- <Form.Field class="w-full" {form} name="collectionUrls">
        <Form.Control>
          {#snippet children({ props })}
            <CollectionsInput value={$formData.collectionUrls} {...props} />
          {/snippet}
        </Form.Control>
        <Form.FieldErrors class="ps-2 text-start text-xs text-rose-500" />
      </Form.Field> -->
      <Form.Button
        class="group w-full drop-shadow-sm transition-all duration-500 ease-out hover:shadow-primary/60 hover:drop-shadow-lg disabled:cursor-wait disabled:opacity-60 disabled:shadow-none md:w-auto"
        disabled={showLoadingIndicator}
      >
        {#if showLoadingIndicator}
          <span
            class="flex items-center gap-2"
            in:receive={{ key: 'loading' }}
            out:send={{ key: 'loading' }}
          >
            {#if $delayed}
              <Spinner type="blinking-eyes" spinnerClassNames="text-primary-foreground" />
            {:else if $timeout}
              <Spinner spinnerClassNames="text-primary-foreground" />
            {/if}
            Downloading
          </span>
        {:else}
          <span
            class="flex items-center gap-2"
            in:receive={{ key: 'idle' }}
            out:send={{ key: 'idle' }}
          >
            Download
            <CloudDownload
              class="ml-1 h-4 w-4 transition-all duration-300 ease-in-out group-hover:animate-smooth-bounce"
            />
          </span>
        {/if}
      </Form.Button>
    </div>
  </div>
  {#if !envConfig.IS_PROD && browser}
    <div class=" py-4">
    <SuperDebug display={!envConfig.IS_PROD} data={$formData} label="Collections Form" collapsible/>
  </div>
  {/if}
</form>

<!-- <Form.Field {form} name="email">
  <Form.Control>
    {#snippet children({ props })}
      <Form.Label>Email</Form.Label>
      <Select.Root
        type="single"
        bind:value={$pageLoadData.email}
        name={props.name}
      >
        <Select.Trigger {...props}>
          {$pageLoadData.email
            ? $pageLoadData.email
            : "Select a verified email to display"}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="m@example.com" label="m@example.com" />
          <Select.Item value="m@google.com" label="m@google.com" />
          <Select.Item value="m@support.com" label="m@support.com" />
        </Select.Content>
      </Select.Root>
    {/snippet}
  </Form.Control>
  <Form.Description>
    You can manage email address in your <a href="/examples/forms"
      >email settings</a
    >.
  </Form.Description>
  <Form.FieldErrors />
</Form.Field>
<Form.Button>Submit</Form.Button>
{#if browser}
  <SuperDebug data={$pageLoadData} />
{/if} -->
