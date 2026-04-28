/**
 * DestaQ — referência de configuração (não importar; não é entry).
 *
 * Runtime: index.html carrega /config.js, que define window.DESTAQ_CONFIG via import.meta.env.
 *
 * Mapeamento VITE_* → window.DESTAQ_CONFIG:
 *   VITE_SUPABASE_URL        → SUPABASE_URL, supabaseUrl
 *   VITE_SUPABASE_ANON_KEY   → SUPABASE_ANON_KEY, supabaseKey
 *   VITE_APP_URL             → APP_URL (default https://destaqlabs.com)
 *   VITE_AUTH_REDIRECT_ORIGIN → AUTH_REDIRECT_ORIGIN (opc.; redirects OAuth/email do Supabase)
 *   VITE_APP_NAME            → APP_NAME (default DestaQ)
 *   VITE_APP_ENV             → APP_ENV (default production)
 *   VITE_RSS2JSON_API_KEY    → jsRSS2JSON_API_KEY (opcional; vazio em prod)
 *   VITE_NEWSAPI_KEY         → NEWSAPI_KEY (opcional; vazio em prod)
 *
 * Setup: copie .env.example para .env e preencha as variáveis.
 * Ingestão server-side: NEWSAPI_KEY / feeds → secrets da Edge Function no Supabase.
 */
export {};
