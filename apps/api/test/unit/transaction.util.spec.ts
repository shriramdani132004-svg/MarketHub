import { ConflictException } from '@nestjs/common';
import { withSerializableRetry } from '../../src/common/utils/transaction.util';

describe('withSerializableRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function advance(ms = 1000) {
    await Promise.resolve();
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  }

  it('returns the result when the first attempt succeeds', async () => {
    const operation = jest.fn().mockResolvedValue('ok');
    const promise = withSerializableRetry(operation);
    await expect(promise).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries P2034 conflicts and eventually succeeds', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockResolvedValue('recovered');

    const promise = withSerializableRetry(operation, 4);
    await advance(1000);
    await advance(1000);
    await expect(promise).resolves.toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('retries raw PostgreSQL serialization failures (P2010 / 40001)', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce({
        code: 'P2010',
        meta: { code: '40001' },
        message: 'Raw query failed. Code: `40001`.',
      })
      .mockResolvedValue('recovered');

    const promise = withSerializableRetry(operation, 3);
    await advance(1000);
    await expect(promise).resolves.toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-conflict errors', async () => {
    const error = Object.assign(new Error('unique violation'), { code: 'P2002' });
    const operation = jest.fn().mockRejectedValue(error);
    const promise = withSerializableRetry(operation);
    await expect(promise).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('throws a ConflictException after exhausting attempts', async () => {
    const operation = jest.fn().mockRejectedValue({ code: 'P2034' });
    const promise = withSerializableRetry(operation, 2);
    promise.catch(() => undefined);
    await advance(1000);
    await advance(1000);
    await expect(promise).rejects.toBeInstanceOf(ConflictException);
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
