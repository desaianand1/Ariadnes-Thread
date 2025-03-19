<script lang="ts">
  import * as Select from '$ui/select';
  import Spinner from '$components/Spinner.svelte';
  import { modLoaderState, type SelectModLoaderItem } from '$state/mod-loader.svelte';
  import ModLoaderItem from '$components/ModLoaderItem.svelte';

  interface SelectModLoaderProps {
    value: string;
    name: string;
    id: string;
    'data-fs-error': string | undefined;
    'aria-describedby': string | undefined;
    'aria-invalid': 'true' | undefined;
    'aria-required': 'true' | undefined;
    'data-fs-control': string;
  }
  let { value, name, ...rest }: SelectModLoaderProps = $props();
  const placeholder = 'Mod Loader';
  const triggerContent: SelectModLoaderItem = $derived(
    modLoaderState.modLoaders.find((x) => x.value === value) ?? {
      label: placeholder,
      value: '',
      colorClassName: '',
      section: 'none'
    }
  );
  const pluginLoaders = $derived(modLoaderState.modLoaders.filter((l) => l.section === 'plugins'));
  const pinnedLoaders = $derived(
    modLoaderState.modLoaders.filter((l) => l.section === 'pinned-to-top')
  );
  const allOtherLoaders = $derived(modLoaderState.modLoaders.filter((l) => l.section === 'none'));
</script>

{#if modLoaderState.isLoading}
  <Spinner
    ><span class="cursor-not-allowed text-xs font-bold text-muted-foreground">Loading</span
    ></Spinner
  >
{:else}
  <Select.Root type="single" {name} bind:value>
    <Select.Trigger class="focus:ring-2"  {...rest}>
      <ModLoaderItem item={triggerContent} iconClassNames="w-5 h-5" containerClassNames="gap-2" />
    </Select.Trigger>
    <Select.Content class="w-auto min-w-full">
      <Select.Group>
        <Select.GroupHeading class="text-xs">📌 Popular</Select.GroupHeading>
        <Select.Separator class="bg-border" />
        {#each pinnedLoaders as pinned}
          <Select.Item
            label={pinned.label}
            value={pinned.value}
            class="data-[highlighted]:bg-muted data-[selected]:bg-primary/20"
          >
            <ModLoaderItem item={pinned} />
          </Select.Item>
        {/each}
      </Select.Group>
      <Select.Separator class="bg-border" />
      <Select.Group>
        {#each allOtherLoaders as other}
          <Select.Item
            label={other.label}
            value={other.value}
            class="data-[highlighted]:bg-muted data-[selected]:bg-primary/20"
          >
            <ModLoaderItem item={other} />
          </Select.Item>
        {/each}
      </Select.Group>
      <Select.Separator class="bg-border" />
      <Select.Group>
        <Select.GroupHeading class="text-xs">🔌 Plugins</Select.GroupHeading>
        <Select.Separator class="bg-border" />
        {#each pluginLoaders as plugin}
          <Select.Item
            label={plugin.label}
            value={plugin.value}
            class="data-[highlighted]:bg-muted data-[selected]:bg-primary/20"
          >
            <ModLoaderItem item={plugin} />
          </Select.Item>
        {/each}
      </Select.Group>
    </Select.Content>
  </Select.Root>
{/if}
