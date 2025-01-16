<script lang="ts">
  import { envConfig } from '$config/env';
  import threadIcon from '$assets/thread-icon.svg';
  import { Button, buttonVariants } from '$ui/button';
  import CoffeeIcon from 'lucide-svelte/icons/coffee';
  import { slide } from 'svelte/transition';
  import ThemeSwitcher from '$components/ThemeSwitcher.svelte';

  type MenuItem = {
    href?: string;
    label: string;
    variant?: 'link' | 'secondary' | 'default' | 'destructive' | 'outline' | 'ghost' | undefined;
    size?: 'default' | 'sm' | 'lg' | 'icon' | undefined;
    mobileOnly: boolean;
    icon?: typeof CoffeeIcon;
    external: boolean;
    isThemeSwitcher: boolean;
  };

  const menuItems: MenuItem[] = [
    {
      label: 'Theme Switcher',
      variant: 'ghost',
      size: 'icon',
      mobileOnly: false,
      external: false,
      isThemeSwitcher: true
    },
    {
      href: '/',
      label: 'Home',
      variant: 'link',
      size: 'lg',
      mobileOnly: true,
      external: false,
      isThemeSwitcher: false
    },
    {
      href: '/about',
      label: 'About',
      variant: 'link',
      size: 'lg',
      mobileOnly: false,
      external: false,
      isThemeSwitcher: false
    },
    {
      href: envConfig.DONATION_URL,
      label: 'Buy me a Coffee',
      variant: 'secondary',
      size: 'default',
      mobileOnly: false,
      icon: CoffeeIcon,
      external: true,
      isThemeSwitcher: false
    }
  ];

  let isMenuOpen = $state(false);

  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
  }

  const mobileMenuItems = menuItems.filter((item) => !item.isThemeSwitcher);
  const largeDeviceMenuItems = menuItems.filter((item) => !item.mobileOnly);
</script>

<nav>
  <div class="container max-w-screen-2xl mx-auto p-4 flex flex-wrap justify-between items-center">
    <a class="flex items-center gap-2" href="/"
      ><img src={threadIcon} class="w-8 h-auto" alt="thread logo" loading="eager" />
      <h1 class="text-xl md:text-2xl text-primary font-black whitespace-nowrap">
        Ariadne's Thread
      </h1>
    </a>
    <!-- small screen hamburger menu itself: -->
    <div class="flex items-center justify-center text-center gap-4 md:hidden">
      <ThemeSwitcher variant="ghost" size="icon" />
      <Button
        onclick={toggleMenu}
        type="button"
        class="inline-flex items-center p-2 w-10 h-10 justify-center text-lg rounded-lg focus:outline-none focus:ring-2"
        aria-controls="navbar-menu"
        aria-expanded={isMenuOpen}
      >
        <span class="sr-only">Open main menu</span>
        <svg
          class="w-6 h-6 transition-transform duration-500 ease-in-out"
          class:rotate-90={isMenuOpen}
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d={isMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
          />
        </svg>
      </Button>
    </div>
    <!-- on medium and larger screens, the top nav menu:-->
    <div class="w-full md:block md:w-auto" id="navbar-menu">
      <div class="hidden md:block">
        <ul
          class="font-medium flex flex-col p-4 space-y-2 md:space-y-0 md:p-0 border rounded-lg md:flex-row md:border-0 items-center"
        >
          {#each largeDeviceMenuItems as item}
            <li>
              {#if item.isThemeSwitcher}
                <ThemeSwitcher variant={item.variant} size={item.size} />
              {:else}
                <a
                  href={item.href}
                  class={buttonVariants({ variant: item.variant, size: item.size })}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                >
                  {#if item.icon}
                    <item.icon />
                  {/if}
                  {item.label}
                </a>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
      <!-- on small screens, when mobile hamburger menu is opened:-->
      {#if isMenuOpen}
        <div class="md:hidden mt-4" transition:slide={{ duration: 500 }}>
          <ul class="font-medium flex flex-col p-4 border rounded-lg items-center">
            {#each mobileMenuItems as item}
              <li>
                <a
                  href={item.href}
                  class={buttonVariants({ variant: item.variant, size: item.size })}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                >
                  {#if item.icon}
                    <item.icon />
                  {/if}
                  {item.label}
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  </div>
</nav>
