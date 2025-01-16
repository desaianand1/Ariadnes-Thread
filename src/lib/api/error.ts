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
