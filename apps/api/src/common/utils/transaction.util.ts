import { ConflictException } from '@nestjs/common';

/**
 * Bounded retry for PostgreSQL serialization/deadlock conflicts.
 * Prisma raises P2034 for serializable conflicts. Raw statements inside an
 * interactive transaction can instead surface as P2010 with meta.code 40001
 * (serialization_failure) or 40P01 (deadlock_detected).
 */
function isRetryableConflict(error: unknown): boolean {
  const typed = error as {
    code?: string;
    meta?: { code?: string } | null;
    message?: string;
  };
  if (typed?.code === 'P2034') return true;
  if (typed?.code === 'P2010') {
    const databaseCode = typed.meta?.code;
    if (databaseCode === '40001' || databaseCode === '40P01') return true;
  }
  const message = typed?.message ?? '';
  return (
    message.includes('40001') ||
    message.includes('40P01') ||
    /could not serialize access|deadlock detected/i.test(message)
  );
}

export async function withSerializableRetry<T>(
  operation: () => Promise<T>,
  attempts = 4,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableConflict(error)) throw error;
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
  throw new ConflictException(
    lastError instanceof Error
      ? 'The request conflicted with another checkout. Please retry.'
      : 'The request conflicted with another transaction. Please retry.',
  );
}
