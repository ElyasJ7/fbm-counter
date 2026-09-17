/**
 * Login form defaults.
 * Demo credentials come only from Vite env (`VITE_DEMO_LOGIN_*`), which
 * should be set in local `.env.development` — not baked into source for prod.
 */
export function getLoginFieldDefaults(isDev: boolean): {
  email: string;
  password: string;
} {
  if (!isDev) {
    return { email: '', password: '' };
  }
  const env =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env
      : ({} as ImportMetaEnv);
  return {
    email: String(env.VITE_DEMO_LOGIN_EMAIL ?? ''),
    password: String(env.VITE_DEMO_LOGIN_PASSWORD ?? ''),
  };
}
