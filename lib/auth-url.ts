const AUTH_QUERY_KEYS = [
  "access_token",
  "refresh_token",
  "expires_at",
  "expires_in",
  "token_type",
  "provider_token",
  "provider_refresh_token",
  "token_hash",
  "code",
  "type",
  "error",
  "error_code",
  "error_description",
] as const;

function removeAuthKeys(params: URLSearchParams) {
  AUTH_QUERY_KEYS.forEach((key) => params.delete(key));
}

export function stripAuthParamsFromUrl(href: string) {
  const url = new URL(href);
  removeAuthKeys(url.searchParams);

  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  if (!hash.includes("=")) return url.toString();

  const hashParams = new URLSearchParams(hash);
  removeAuthKeys(hashParams);
  const nextHash = hashParams.toString();
  url.hash = nextHash ? `#${nextHash}` : "";
  return url.toString();
}
