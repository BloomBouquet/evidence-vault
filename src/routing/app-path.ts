export const APP_BASE_PATH = "/apps/evidence-vault";

export function appPath(path = "/") {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === "/" ? `${APP_BASE_PATH}/` : `${APP_BASE_PATH}${normalized}`;
}

export function appUrl(origin: URL | string, path = "/") {
  const base = origin instanceof URL ? origin : new URL(origin);
  return new URL(appPath(path), base.origin);
}
