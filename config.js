// DestaQ — Configuração central (Vite injeta VITE_* em build/dev via import.meta.env)
// Preencha scroll-demo/.env a partir de .env.example (não commite .env)

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

window.DESTAQ_CONFIG = {
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ANON_KEY: supabaseKey,

  jsRSS2JSON_API_KEY: String(import.meta.env.VITE_RSS2JSON_API_KEY || '').trim(),
  NEWSAPI_KEY: String(import.meta.env.VITE_NEWSAPI_KEY || '').trim(),

  APP_URL: String(import.meta.env.VITE_APP_URL || 'https://destaqlabs.com').replace(/\/+$/, '') || 'https://destaqlabs.com',
  /** Base opcional OAuth/email do Supabase; se vazio, auth.js usa APP_URL ou a origem do browser */
  AUTH_REDIRECT_ORIGIN: String(import.meta.env.VITE_AUTH_REDIRECT_ORIGIN || '').trim(),
  APP_NAME: String(import.meta.env.VITE_APP_NAME || 'DestaQ'),
  APP_ENV: String(import.meta.env.VITE_APP_ENV || 'production'),

  FEATURES: {
    NETWORK_REALTIME: true,
    COMMUNITY_RSS: true,
    EXIT_INTENT: true,
    MASCOT_DEQ: true,
  },

  COMMUNITY: {
    BACKEND_SOURCE: 'supabase',
    RSS_FALLBACK_ENABLED: true,
    MAX_AGE_MINUTES: 30,
    UI_CACHE_MINUTES: 5,
  },

  PRODUCT: {
    UI_CACHE_MINUTES: 5,
    INQUIRY_IMAGE_BUCKET: 'product-inquiry-images',
    SHOW_ENTRY_MODAL_EVERY_SESSION: true,
  },
};

window.DESTAQ_CONFIG.supabaseUrl = supabaseUrl;
window.DESTAQ_CONFIG.supabaseKey = supabaseKey;
