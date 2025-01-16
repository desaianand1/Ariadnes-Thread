<script lang="ts">
  import { envConfig } from '$config/env';
  import { buttonVariants } from '$ui/button';
</script>

<footer class="border-t mt-auto">
  <div class="container flex flex-col gap-8 mx-auto p-4 text-center text-sm text-muted-foreground">
    <span
      >* This application is not affiliated with modrinth.com, Rinth, Inc. or its registered
      trademarks.</span
    >
    <span>Made with 💜 for the Minecraft modding community</span>
    <span
      >&COPY;&nbsp;2025
      <a
        class={buttonVariants({ variant: 'link' })}
        href={envConfig.DONATION_URL}
        rel="noopener noreferrer"
        target="_blank">Anand Desai.</a
      > All Rights Reserved.</span
    >
  </div>
</footer>
