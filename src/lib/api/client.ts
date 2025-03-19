import { fetchClosure } from '$state/fetch.svelte';
import { appDefaults, envConfig, type RetryBackoffStrategy } from '$config/env';
import { stripTrailingSlash } from '$lib/utils';
import { ClientError, ServerError, RateLimitError } from '$api/error';

export type ModrinthAPIVersion = 'v2' | 'v3';
export type ModrinthAPIEndpoint = 'collection' | 'project' | 'tag';
export interface ModrinthAPIMetadata {
  about: string;
  documentation: string;
  name: string;
  version: string;
}

export interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

class APIClient {
  private semaphore: Promise<void> = Promise.resolve();
  private token?: string;
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly maxRequestsAllowedPerMinute: number;
  private remainingRequests: number;
  private readonly resetIntervalInSeconds: number;
  private readonly maxRetries: number;
  private readonly retryBackoffStrategy: RetryBackoffStrategy;
  private readonly defaultRetryDelayInMs: number;
  private apiVersion?: string;
  private resetTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.baseUrl = stripTrailingSlash(envConfig.MODRINTH_API_URL);
    this.userAgent = envConfig.MODRINTH_USER_AGENT;
    this.maxRequestsAllowedPerMinute = appDefaults.MAX_REQUESTS_PER_MINUTE;
    this.remainingRequests = this.maxRequestsAllowedPerMinute;
    this.resetIntervalInSeconds = appDefaults.RESET_INTERVAL_IN_SECONDS;
    this.maxRetries = appDefaults.MAX_REQUEST_RETRIES;
    this.retryBackoffStrategy = appDefaults.RETRY_BACKOFF_STRATEGY;
    this.defaultRetryDelayInMs = appDefaults.RETRY_DELAY_IN_MS;
    this.startRateLimitReset();
    this.fetchAPIMetadata();
  }

  setToken(token: string): void {
    this.token = token;
  }

  private startRateLimitReset(): void {
    if (this.resetTimer) clearInterval(this.resetTimer);
    this.resetTimer = setInterval(() => {
      this.remainingRequests = this.maxRequestsAllowedPerMinute;
    }, this.resetIntervalInSeconds * 1000);
  }

  private async fetchAPIMetadata(): Promise<void> {
    const requestOptions: RequestInit = {
      method: 'GET',
      headers: this.getHeaders()
    };
    try {
      const response = await fetchClosure()(this.baseUrl, requestOptions);
      const metadata = await this.handleResponse<ModrinthAPIMetadata>(response);
      this.apiVersion = metadata?.version ?? undefined;
      console.info(`Utilizing Modrinth API version ${this.apiVersion} ...`);
    } catch (error) {
      console.error('Failed to fetch API metadata:', error);
    }
  }

  private buildUrl(
    endpoint: ModrinthAPIEndpoint,
    version: ModrinthAPIVersion,
    pathParams: string[] = [],
    queryParams: Record<string, string> = {}
  ): string {
    const path = pathParams.join('/');
    const url = new URL(`${endpoint}/${path}`, `${this.baseUrl}/${version}/`);
    Object.entries(queryParams).forEach(([key, value]) => url.searchParams.append(key, value));
    return url.toString();
  }

  private getHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
      Origin: envConfig.WEBSITE_DOMAIN_URL
    };
    if (this.token) headers['Authorization'] = this.token;
    return { ...headers, ...additionalHeaders };
  }

  private async handleRateLimit(): Promise<void> {
    await this.acquire(); // Ensure single-threaded access
    try {
      if (this.remainingRequests <= 0) {
        // Calculate how much time remains until the next rate limit reset
        const timeUntilResetInMilliseconds =
          this.resetIntervalInSeconds * 1000 - (Date.now() % (this.resetIntervalInSeconds * 1000));
        console.warn(
          `Rate limit reached. Waiting for ${timeUntilResetInMilliseconds / 1000} seconds...`
        );
        await new Promise((resolve) => setTimeout(resolve, timeUntilResetInMilliseconds));
      }
      this.remainingRequests--;
    } finally {
      this.release();
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    if (!response.ok) {
      const errorDetails = isJson ? await response.json() : response.statusText;

      if (response.status === 410) {
        throw new ClientError(
          `API endpoint deprecated. ${response.statusText}`,
          response.status,
          errorDetails
        );
      }

      if (response.status === 429) {
        const retryAfter = parseInt(
          response.headers.get('Retry-After') || `${this.resetIntervalInSeconds}`,
          10
        );
        throw new RateLimitError(
          'Rate limit exceeded. Retry after delay.',
          retryAfter,
          errorDetails
        );
      }

      if (response.status >= 500) {
        throw new ServerError(
          `Server error: ${response.statusText}`,
          response.status,
          errorDetails
        );
      }

      if (response.status >= 400) {
        throw new ClientError(
          `Client error: ${response.statusText}`,
          response.status,
          errorDetails
        );
      }

      throw new Error('Unexpected HTTP error');
    }

    if (isJson) {
      return response.json();
    }

    throw new Error('Unexpected response format.');
  }

  private async retry<T>(
    operation: () => Promise<T>,
    retries: number = this.maxRetries,
    delay: number = this.defaultRetryDelayInMs
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ClientError && error.status === 410) {
        // Deprecated endpoint, don't retry!
        throw error;
      }
      if (error instanceof RateLimitError && error.retryAfter === 'never') {
        // Max retries reached, fatal failure
        throw error;
      }

      if (retries > 0) {
        console.warn(`Retrying request... Attempts left: ${retries}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        switch (this.retryBackoffStrategy) {
          case 'exponential':
            return this.retry(operation, retries - 1, delay * 2);
          case 'fixed':
            return this.retry(operation, retries - 1, delay);
          case 'linear':
            const linearDelayModifier = 1000;
            return this.retry(operation, retries - 1, delay + linearDelayModifier);
          default:
            return this.retry(operation, retries - 1, delay);
        }
      }
      console.error('Max retries reached. Request failed.');
      throw new RateLimitError(
        'Rate limit exceeded. Max retries reached. Request failed.',
        'never',
        error
      );
    }
  }

  async request<T>(
    endpoint: ModrinthAPIEndpoint,
    version: ModrinthAPIVersion = 'v2',
    pathParams: string[] = [],
    queryParams: Record<string, string> = {},
    options: RequestOptions = {}
  ): Promise<T> {
    const url = this.buildUrl(endpoint, version, pathParams, queryParams);
    const requestOptions: RequestInit = {
      method: options.method || 'GET',
      headers: this.getHeaders(options.headers),
      body: options.body ? JSON.stringify(options.body) : undefined
    };

    const attemptRequest = async () => {
      await this.handleRateLimit();
      const response = await fetchClosure()(url, requestOptions);
      return this.handleResponse<T>(response);
    };
    return this.retry(attemptRequest);
  }

  // Semaphore-based concurrency handling
  private async acquire(): Promise<void> {
    let release: () => void;
    const acquirePromise = new Promise<void>((resolve) => (release = resolve));
    this.semaphore = this.semaphore.then(() => acquirePromise);
    await Promise.resolve();
    return release!();
  }

  private release(): void {
    // Release the lock immediately.
    // No-op to prevent being removed by tree-shaking
    void 0;
  }
}

export const apiClient = new APIClient();
