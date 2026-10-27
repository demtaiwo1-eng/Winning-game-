import { describe, expect, it } from 'vitest';
import { isSafeOfflineMutation } from '../outbox';

describe('offline mutation policy', () => {
  it('allows ordinary event/task mutations', () => {
    expect(isSafeOfflineMutation('POST', '/api/v1/events')).toBe(true);
    expect(isSafeOfflineMutation('PATCH', '/api/v1/events/1/tasks/2')).toBe(true);
  });

  it('rejects authentication mutations', () => {
    expect(isSafeOfflineMutation('POST', '/api/v1/auth/login')).toBe(false);
    expect(isSafeOfflineMutation('POST', '/api/v1/auth/refresh')).toBe(false);
  });

  it('rejects financial mutations', () => {
    expect(isSafeOfflineMutation('POST', '/api/v1/payments')).toBe(false);
    expect(isSafeOfflineMutation('POST', '/api/v1/wallet/topup')).toBe(false);
    expect(isSafeOfflineMutation('POST', '/api/v1/escrow/release')).toBe(false);
    expect(isSafeOfflineMutation('POST', '/api/v1/checkout')).toBe(false);
  });

  it('does not classify reads as mutations', () => {
    expect(isSafeOfflineMutation('GET', '/api/v1/events')).toBe(false);
  });
});
