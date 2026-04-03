<script lang="ts">
    interface Props {
        class?: string;
    }

    let { class: className = '' }: Props = $props();
</script>

<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 160.073 160.073"
    class={className}
    aria-hidden="true"
>
    <path d="M0 0h160.073v160.073H0z" fill="#3eae30" />
    <path
        d="M51.594 121.802h14.173v-14.173h28.915v13.985h14.552V78.619H94.966V35.624h28.821v28.821H37.041v-28.82h28.916v43.089H51.594Z"
        fill="currentColor"
    />
</svg>
