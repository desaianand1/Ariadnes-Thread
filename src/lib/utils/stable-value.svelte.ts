/**
 * Rate-limits how often a displayed value changes to prevent visual jitter.
 * The returned getter updates at most once every `intervalMs` milliseconds.
 * First value is displayed immediately; subsequent changes are throttled.
 */
export function useStableValue<T>(source: () => T, intervalMs: number = 1000) {
    let displayed = $state<T>(undefined as T);
    let lastUpdateTime = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let initialized = false;

    $effect(() => {
        const value = source();

        if (!initialized) {
            displayed = value;
            lastUpdateTime = Date.now();
            initialized = true;
            return;
        }

        const now = Date.now();
        const elapsed = now - lastUpdateTime;

        if (elapsed >= intervalMs) {
            displayed = value;
            lastUpdateTime = now;
            if (timer) {
                clearTimeout(timer);
                timer = undefined;
            }
        } else if (!timer) {
            timer = setTimeout(() => {
                displayed = source();
                lastUpdateTime = Date.now();
                timer = undefined;
            }, intervalMs - elapsed);
        }

        return () => {
            if (timer) {
                clearTimeout(timer);
                timer = undefined;
            }
        };
    });

    return () => displayed;
}
