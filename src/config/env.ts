import { parsedAppDefaults, parsedEnv } from '$config/validation';

export type RetryBackoffStrategy = 'fixed' | 'exponential' | 'linear';
export interface EnvConfig {
  MODRINTH_API_URL: string;
  MODRINTH_USER_AGENT: string;
  IS_PROD: boolean;
  WEBSITE_DOMAIN_URL: string;
  DONATION_URL: string;
}

export interface AppDefaultsConfig {
  MAX_REQUESTS_PER_MINUTE: number;
  RESET_INTERVAL_IN_SECONDS: number;
  MAX_REQUEST_RETRIES: number;
  RETRY_BACKOFF_STRATEGY: RetryBackoffStrategy;
  RETRY_DELAY_IN_MS: number;
}

declare global {
  interface ImportMetaEnv extends EnvConfig {}
}

const getEnvConfig = (): EnvConfig => {
  return {
    MODRINTH_API_URL: parsedEnv.VITE_MODRINTH_API_URL,
    MODRINTH_USER_AGENT: parsedEnv.VITE_MODRINTH_USER_AGENT,
    IS_PROD: parsedEnv.IS_PROD,
    WEBSITE_DOMAIN_URL: parsedEnv.VITE_WEBSITE_DOMAIN_URL,
    DONATION_URL: parsedEnv.VITE_DONATION_URL
  };
};

const getAppDefaults = (): AppDefaultsConfig => {
  return {
    MAX_REQUESTS_PER_MINUTE: parsedAppDefaults.VITE_MAX_REQUESTS_PER_MINUTE,
    RESET_INTERVAL_IN_SECONDS: parsedAppDefaults.VITE_RESET_INTERVAL_IN_SECONDS,
    MAX_REQUEST_RETRIES: parsedAppDefaults.VITE_MAX_REQUEST_RETRIES,
    RETRY_BACKOFF_STRATEGY: parsedAppDefaults.VITE_RETRY_BACKOFF_STRATEGY,
    RETRY_DELAY_IN_MS: parsedAppDefaults.VITE_RETRY_DELAY_IN_MS
  };
};
export const appDefaults = getAppDefaults();
export const envConfig = getEnvConfig();
