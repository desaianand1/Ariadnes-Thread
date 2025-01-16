<script lang="ts">
  import * as Select from '$ui/select';
  import { cn } from '$lib/utils';

  export type SelectItem = {
    label: string;
    value: string;
    iconSvg?: string;
    colorClassName: string;
  };

  export type SelectProps = {
    name: string;
    heading: string;
    selectOptions: SelectItem[];
    placeholder: string;
    classNames: string;
  };

  const { name, heading, selectOptions, placeholder, classNames }: SelectProps = $props();

  let selectedValue = $state<string>('');

  const triggerContent = $derived(
    selectOptions.find((x) => x.value === selectedValue)?.label ?? placeholder
  );
</script>

<Select.Root type="single" {name} bind:value={selectedValue}>
  <Select.Trigger class={classNames}>
    {triggerContent}
  </Select.Trigger>
  <Select.Content>
    <Select.Group>
      <Select.GroupHeading>{heading}</Select.GroupHeading>
      {#each selectOptions as option}
        <Select.Item value={option.value} label={option.label}>
          <div class="flex items-center justify-center text-center gap-2">
            {#if option.iconSvg}
              {@html option.iconSvg}
            {/if}
            <span class={cn('text-sm font-raleway font-medium', option.colorClassName)}
              >{option.label}
            </span>
          </div>
        </Select.Item>
      {/each}
    </Select.Group>
  </Select.Content>
</Select.Root>
