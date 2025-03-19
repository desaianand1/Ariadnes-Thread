let fetchFunction = $state<typeof fetch>(fetch);

export function setFetchFunction(fn: typeof fetch) {
  fetchFunction = fn;
}

export const fetchClosure = () => fetchFunction;
