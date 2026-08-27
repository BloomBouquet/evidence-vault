export type AuthConfig = {
  appBaseUrl: URL;
  bouquetBaseUrl: URL;
  bouquetClientId: string;
  bouquetRedirectUri: URL;
  sessionSecret: string;
  secureCookies: boolean;
};

function invalid(): never {
  throw new Error("auth_config_invalid");
}

function required(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key]?.trim();
  if (!value) invalid();
  return value;
}

function httpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") invalid();
    return url;
  } catch {
    invalid();
  }
}

export function getAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  try {
    const appBaseUrl = httpUrl(required(env, "APP_BASE_URL"));
    const bouquetBaseUrl = httpUrl(required(env, "BOUQUET_BASE_URL"));
    const bouquetClientId = required(env, "BOUQUET_CLIENT_ID");
    const bouquetRedirectUri = httpUrl(required(env, "BOUQUET_REDIRECT_URI"));
    const sessionSecret = required(env, "SESSION_SECRET");
    const secureCookies = env.NODE_ENV === "production";

    if (Buffer.byteLength(sessionSecret, "utf8") < 32) invalid();
    if (
      bouquetRedirectUri.pathname !== "/auth/bouquet/callback" ||
      bouquetRedirectUri.search ||
      bouquetRedirectUri.hash
    ) {
      invalid();
    }

    if (
      secureCookies &&
      [appBaseUrl, bouquetBaseUrl, bouquetRedirectUri].some((url) => url.protocol !== "https:")
    ) {
      invalid();
    }

    return {
      appBaseUrl,
      bouquetBaseUrl,
      bouquetClientId,
      bouquetRedirectUri,
      sessionSecret,
      secureCookies,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "auth_config_invalid") throw error;
    invalid();
  }
}
