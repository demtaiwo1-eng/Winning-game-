import { describe, expect, it } from 'vitest';
import { isSafeOfflineMutation } from '../outbox';

describe('Phase 5 offline policy', () => {
  it('allows cart editing while keeping checkout payment flows online-only', () => {
    expect(isSafeOfflineMutation('POST', '/api/v1/checkout/cart/items')).toBe(true);
    expect(isSafeOfflineMutation('PATCH', '/api/v1/checkout/cart/items/1')).toBe(true);
    expect(isSafeOfflineMutation('DELETE', '/api/v1/checkout/cart/items/1')).toBe(true);
    expect(isSafeOfflineMutation('POST', '/api/v1/checkout/checkout-sessions')).toBe(false);
    expect(isSafeOfflineMutation('POST', '/api/v1/checkout/checkout-sessions/1/pay-with-wallet')).toBe(false);
    expect(isSafeOfflineMutation('POST', '/api/v1/checkout/cart/items?source=offline')).toBe(true);
    expect(isSafeOfflineMutation('POST', '/api/v1/checkout/cart/../checkout-sessions/1/pay-with-wallet')).toBe(false);
    expect(isSafeOfflineMutation('POST', 'https://ess.example/api/v1/checkout/checkout-sessions/1/pay-with-wallet')).toBe(false);
  });

  it('keeps authentication and financial mutations out of the outbox', () => {
    for (const url of [
      '/api/v1/auth/refresh',
      '/api/v1/payments/intents',
      '/api/v1/wallet/deposit',
      '/api/v1/escrow/release',
    ]) {
      expect(isSafeOfflineMutation('POST', url)).toBe(false);
    }
  });

  it('keeps ordinary event and messaging mutations queueable', () => {
    expect(isSafeOfflineMutation('POST', '/api/v1/events')).toBe(true);
    expect(isSafeOfflineMutation('PATCH', '/api/v1/events/1/tasks/2')).toBe(true);
    expect(isSafeOfflineMutation('POST', '/api/v1/messages')).toBe(true);
    expect(isSafeOfflineMutation('TRACE', '/api/v1/events')).toBe(false);
    expect(isSafeOfflineMutation('POST', '/other/api/v1/events')).toBe(false);
  });
});
