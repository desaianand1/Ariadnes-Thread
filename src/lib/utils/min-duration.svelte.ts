/**
 * Prevents visual flash when boolean states toggle true→false too quickly.
 * Once the source becomes true, the returned getter stays true for at least `minMs`.
 */
export function useMinDuration(source: () => boolean, minMs: number = 300) {
    let held = $state(false);
    let timer: ReturnType<typeof setTimeout> | undefined;

    $effect(() => {
        const value = source();
        if (value) {
            held = true;
            if (timer) {
                clearTimeout(timer);
                timer = undefined;
            }
        } else if (held) {
            timer = setTimeout(() => {
                held = false;
            }, minMs);
        }
        return () => {
            if (timer) clearTimeout(timer);
        };
    });

    return () => held;
}
