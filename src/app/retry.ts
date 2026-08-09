export interface RetryPolicy {
  readonly attempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly shouldRetry: (error: unknown) => boolean;
}

export const networkRetryPolicy: RetryPolicy = {
  attempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 2_000,
  shouldRetry: (error) => error instanceof Error && /HTTP 5|fetch|network|timeout/i.test(error.message),
};

export function retryDelay(attempt: number, policy: RetryPolicy): number {
  const exponential = policy.baseDelayMs * 2 ** Math.max(attempt - 1, 0);
  const jitter = Math.floor(Math.random() * policy.baseDelayMs);
  return Math.min(exponential + jitter, policy.maxDelayMs);
}

export async function withRetry<T>(operation: () => Promise<T>, policy = networkRetryPolicy): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= policy.attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === policy.attempts || !policy.shouldRetry(error)) break;
      await new Promise<void>((resolve) => setTimeout(resolve, retryDelay(attempt, policy)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Retry operation failed");
}

export interface RequestLog {
  readonly name: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly outcome: "success" | "failure";
  readonly detail?: string;
}

export async function observed<T>(name: string, action: () => Promise<T>, sink: (log: RequestLog) => void): Promise<T> {
  const startedAt = new Date();
  try {
    const result = await action();
    sink({ name, startedAt, finishedAt: new Date(), outcome: "success" });
    return result;
  } catch (error) {
    sink({ name, startedAt, finishedAt: new Date(), outcome: "failure", detail: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
