export async function retryAsync(operation, {
  maxRetries = 2,
  baseDelayMs = 500,
  shouldRetry = () => false,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  onRetry = () => {},
  signal,
} = {}) {
  let attempt = 0;
  while (true) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await operation(attempt);
    } catch (error) {
      if (!shouldRetry(error, attempt) || attempt >= maxRetries) throw error;
      attempt += 1;
      const delay = baseDelayMs * (2 ** (attempt - 1));
      onRetry({ attempt, delay, error });
      await sleep(delay);
    }
  }
}
