export function resolveApiRequest(input: RequestInfo | URL, apiOrigin: string): RequestInfo | URL {
  if (apiOrigin && typeof input === 'string' && input.startsWith('/api/')) {
    return `${apiOrigin}${input}`;
  }
  return input;
}
