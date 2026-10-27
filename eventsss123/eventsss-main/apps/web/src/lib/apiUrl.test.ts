import { describe, expect, it } from 'vitest';
import { resolveApiRequest } from './apiUrl';

describe('resolveApiRequest', () => {
  it('routes relative API requests to the configured host', () => {
    expect(resolveApiRequest('/api/v1/events', 'https://api.example.com'))
      .toBe('https://api.example.com/api/v1/events');
  });

  it('keeps relative requests when no API host is configured', () => {
    expect(resolveApiRequest('/api/v1/events', '')).toBe('/api/v1/events');
  });

  it('does not rewrite non-API paths or already absolute requests', () => {
    expect(resolveApiRequest('/assets/logo.svg', 'https://api.example.com'))
      .toBe('/assets/logo.svg');
    expect(resolveApiRequest('https://other.example/api/v1/events', 'https://api.example.com'))
      .toBe('https://other.example/api/v1/events');
  });
});
