<script lang="ts">
  import { Button } from '$ui/button';
  import { Input } from '$ui/input';
  import { CloudDownload } from 'lucide-svelte';
  import {apiClient} from '$api/client'

  const client = apiClient;
</script>

<form>
  <div class="flex flex-col sm:flex-row gap-3">
    <div class="flex-1">
      <Input
        name="collectionUrl"
        type="text"
        placeholder="Paste your Modrinth collection URL or ID"
        class="w-full"
      />
    </div>

    <Button type="submit" class="group">
      Download
      <CloudDownload
        class="ml-1 h-4 w-4 transition-all duration-300 ease-in-out group-hover:animate-smooth-bounce"
      />
    </Button>
  </div>
</form>
