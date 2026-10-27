import { describe, expect, it } from 'vitest';
import { getApiBaseUrl, resolveApiRequest } from './apiUrl';

describe('resolveApiRequest', () => {
  it('preserves a Supabase function path while routing API calls', () => {
    const base = getApiBaseUrl('https://project.supabase.co/functions/v1/ess-api-proxy/api/v1');
    expect(resolveApiRequest('/api/v1/events', base))
      .toBe('https://project.supabase.co/functions/v1/ess-api-proxy/api/v1/events');
  });

  it('routes relative API requests to a regular HTTPS API host', () => {
    const base = getApiBaseUrl('https://api.example.com/api/v1');
    expect(resolveApiRequest('/api/v1/events', base))
      .toBe('https://api.example.com/api/v1/events');
  });

  it('keeps relative requests when no API host is configured', () => {
    expect(resolveApiRequest('/api/v1/events', getApiBaseUrl(''))).toBe('/api/v1/events');
  });

  it('does not rewrite non-API paths or already absolute requests', () => {
    const base = getApiBaseUrl('https://api.example.com/api/v1');
    expect(resolveApiRequest('/assets/logo.svg', 'https://api.example.com'))
      .toBe('/assets/logo.svg');
    expect(resolveApiRequest('https://other.example/api/v1/events', base))
      .toBe('https://other.example/api/v1/events');
  });

  it('rejects insecure non-local API URLs', () => {
    expect(getApiBaseUrl('http://api.example.com/api/v1')).toBe('');
    expect(getApiBaseUrl('http://localhost:5000/api/v1')).toBe('http://localhost:5000');
    expect(getApiBaseUrl('ftp://localhost/api/v1')).toBe('');
    expect(getApiBaseUrl('https://user:pass@api.example.com/api/v1')).toBe('');
  });
});
