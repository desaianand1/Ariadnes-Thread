<script lang="ts">
  import * as Select from '$ui/select';
  import Spinner from '$components/Spinner.svelte';
  import { versionState, type SelectMinecraftVersionItem } from '$state/minecraft-version.svelte';
  import MinecraftVersionItem from '$components/MinecraftVersionItem.svelte';
  import { DateTime } from 'luxon';

  interface SelectMinecraftVersionProps {
    value: string;
    name: string;
    id: string;
    'data-fs-error': string | undefined;
    'aria-describedby': string | undefined;
    'aria-invalid': 'true' | undefined;
    'aria-required': 'true' | undefined;
    'data-fs-control': string;
  }
  let { value, name, ...rest }: SelectMinecraftVersionProps = $props();
  const placeholder = 'Version';
  const triggerContent: SelectMinecraftVersionItem = $derived(
    versionState.versions.find((x) => x.value === value) ?? {
      label: placeholder,
      value: '',
      isMajorVersion: false,
      date: DateTime.now(),
      versionType: 'snapshot'
    }
  );
  const pinnedVersions = $derived(versionState.versions.filter((l) => l.isMajorVersion));
  const allOtherVersions = $derived(versionState.versions.filter((l) => !l.isMajorVersion));
</script>

{#if versionState.isLoading}
  <Spinner
    ><span class="cursor-not-allowed text-xs font-bold text-muted-foreground">Loading</span
    ></Spinner
  >
{:else}
  <Select.Root type="single" {name} bind:value>
    <Select.Trigger class="focus:ring-2" {...rest}>
      <MinecraftVersionItem item={triggerContent} containerClassNames="gap-2" />
    </Select.Trigger>
    <Select.Content class="w-auto min-w-full">
      <Select.Group>
        <Select.GroupHeading class="text-xs">📌 Popular</Select.GroupHeading>
        <Select.Separator class="bg-border" />
        {#each pinnedVersions as pv}
          <Select.Item
            label={pv.label}
            value={pv.value}
            class="data-[highlighted]:bg-muted data-[selected]:bg-primary/20"
          >
            <MinecraftVersionItem item={pv} />
          </Select.Item>
        {/each}
      </Select.Group>
      <Select.Separator class="bg-border" />
      <Select.Group>
        <Select.GroupHeading class="text-xs">Other</Select.GroupHeading>
        <Select.Separator class="bg-border" />
        {#each allOtherVersions as other}
          <Select.Item
            label={other.label}
            value={other.value}
            class="data-[highlighted]:bg-muted data-[selected]:bg-primary/20"
          >
            <MinecraftVersionItem item={other} />
          </Select.Item>
        {/each}
      </Select.Group>
    </Select.Content>
  </Select.Root>
{/if}
