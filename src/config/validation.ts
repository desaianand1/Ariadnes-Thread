import { z } from 'zod';

const envSchema = z.object({
  VITE_MODRINTH_API_URL: z.string().url().includes('api.modrinth.com'),
  VITE_MODRINTH_USER_AGENT: z.string().nonempty(),
  IS_PROD: z.boolean(),
  VITE_WEBSITE_DOMAIN_URL: z.string().url(),
  VITE_DONATION_URL: z.string().url().optional().default('https://github.com/desaianand1')
});

const BackoffStrategySchema = z.enum(['fixed', 'linear', 'exponential']);
const appDefaultsSchema = z.object({
  VITE_MAX_REQUESTS_PER_MINUTE: z
    .number()
    .positive('Must be a positive, non-zero integer')
    .max(1000, 'Cannot be too large an integer!'),
  VITE_RESET_INTERVAL_IN_SECONDS: z
    .number()
    .positive('Must be a positive, non-zero integer')
    .max(300, 'Cannot be longer than 5 minutes! (300 seconds)'),
  VITE_MAX_REQUEST_RETRIES: z.number().positive().max(10, 'Must not exceed 10 retry limit!'),
  VITE_RETRY_BACKOFF_STRATEGY: BackoffStrategySchema.default('exponential'),
  VITE_RETRY_DELAY_IN_MS: z.number().positive().max(10000,"Must not exceed 10 seconds (10,000 ms)!")
});

type AppEnv = z.infer<typeof envSchema>;
type AppDefaults = z.infer<typeof appDefaultsSchema>;

function parseAppEnv(): AppEnv {
  try {
    const parsedAppEnv: AppEnv = envSchema.parse({
      VITE_MODRINTH_API_URL: import.meta.env.VITE_MODRINTH_API_URL,
      VITE_MODRINTH_USER_AGENT: import.meta.env.VITE_MODRINTH_USER_AGENT,
      IS_PROD: import.meta.env.PROD,
      VITE_DONATION_URL: import.meta.env.VITE_DONATION_URL,
      VITE_WEBSITE_DOMAIN_URL: import.meta.env.VITE_WEBSITE_DOMAIN_URL
    });
    console.debug('Environment variables validated successfully:', parsedAppEnv);
    return parsedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Environment variable validation errors:');
      for (const issue of error.errors) {
        console.error(`- ${issue.path.join('.')}: ${issue.message}`);
      }
    } else {
      console.error('Unexpected error during environment validation:', error);
    }
    throw new Error('Environment variable validation failed.');
  }
}

function parseAppDefaults(): AppDefaults {
  try {
    const parsedDefaults: AppDefaults = appDefaultsSchema.parse({
      VITE_MAX_REQUESTS_PER_MINUTE: import.meta.env.VITE_MAX_REQUESTS_PER_MINUTE,
      VITE_RESET_INTERVAL_IN_SECONDS: import.meta.env.VITE_RESET_INTERVAL_IN_SECONDS,
      VITE_MAX_REQUEST_RETRIES: import.meta.env.VITE_MAX_REQUEST_RETRIES,
      VITE_RETRY_BACKOFF_STRATEGY: import.meta.env.VITE_RETRY_BACKOFF_STRATEGY
    });
    console.debug('App Defaults variables validated successfully:', parsedDefaults);
    return parsedDefaults;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('App defaults environment variable validation errors:');
      for (const issue of error.errors) {
        console.error(`- ${issue.path.join('.')}: ${issue.message}`);
      }
    } else {
      console.error('Unexpected error during app defaults environment validation:', error);
    }
    throw new Error('App defaults environment variable validation failed.');
  }
}

export const parsedEnv = parseAppEnv();
export const parsedAppDefaults = parseAppDefaults();
