export class ClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ClientError';
  }
}

export class ServerError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ServerError';
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number | 'never',
    public details?: any
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export function handleError(error: unknown): void {
  if (error instanceof ServerError) {
    //TODO: throw toast showing that server is unavailable. Try again later
  } else if (error instanceof RateLimitError && error.retryAfter === 'never') {
    //TODO: throw toast showing that you are rate limited hard and failed all retries. Fatal failure
  } else {
    //TODO: some other fatal error, handle via toast again I guess
  }
}
