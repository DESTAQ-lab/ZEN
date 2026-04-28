import { createClient } from "npm:@supabase/supabase-js@2";

type SourceType = "rss" | "newsapi" | "official";

type SourceConfig = {
  source: string;
  source_type: SourceType;
  category: string;
  url: string;
  count?: number;
};

type NormalizedArticle = {
  source: string;
  source_type: SourceType;
  title: string;
  summary: string;
  url: string;
  image_url: string | null;
  category: string;
  tags: string[];
  published_at: string;
  ingested_at: string;
  relevance_score: number;
  is_featured: boolean;
  is_active: boolean;
  raw_payload: Record<string, unknown>;
};

const DEFAULT_RSS_SOURCES: SourceConfig[] = [
  { source: "Tecnoblog", source_type: "rss", category: "tecnologia", url: "https://tecnoblog.net/feed/", count: 8 },
  { source: "g1 Tecnologia", source_type: "rss", category: "tecnologia", url: "https://g1.globo.com/rss/g1/tecnologia/", count: 8 },
  { source: "InfoMoney", source_type: "rss", category: "mercado", url: "https://www.infomoney.com.br/feed/", count: 8 },
];

const DEFAULT_OFFICIAL_SOURCES: SourceConfig[] = [
  {
    source: "MDIC Noticias",
    source_type: "official",
    category: "importacao",
    url: "https://www.gov.br/mdic/pt-br/assuntos/noticias/rss.xml",
    count: 8,
  },
];

const NEWSAPI_QUERIES = [
  '"importacao produtos" OR aduana OR NCM OR "imposto de importacao"',
  '"marketplace" AND ("politica" OR "seller center" OR "compliance")',
  '"cross-border ecommerce" OR "despacho aduaneiro" OR "logistica internacional"',
];

const KEYWORD_WEIGHTS: Record<string, number> = {
  importacao: 1.8,
  aduana: 1.6,
  ncm: 1.5,
  tributacao: 1.3,
  imposto: 1.2,
  crossborder: 1.4,
  marketplace: 1.4,
  seller: 1.1,
  ecommerce: 1.0,
  logistica: 1.0,
  compliance: 1.0,
  despacho: 1.2,
};

function parseJsonEnv<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function stripHtml(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "mc_cid",
      "mc_eid",
    ].forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return raw.trim();
  }
}

function deriveCategory(text: string, fallback: string): string {
  const s = text.toLowerCase();
  if (/importa|aduan|ncm|despacho|tribut/.test(s)) return "importacao";
  if (/marketplace|seller center|seller|mercado livre|amazon|shopee|magalu/.test(s)) return "marketplace";
  if (/logist|frete|entrega/.test(s)) return "logistica";
  if (/compliance|regra|politic|termos/.test(s)) return "compliance";
  if (/pagament|pix|cartao|gateway/.test(s)) return "payments";
  if (/e-?commerce|loja virtual/.test(s)) return "ecommerce";
  return fallback || "mercado";
}

function buildTags(text: string): string[] {
  const s = text.toLowerCase();
  const tags = new Set<string>();
  if (/importa|aduan|ncm|despacho/.test(s)) tags.add("importacao");
  if (/marketplace|seller center|mercado livre|amazon|shopee/.test(s)) tags.add("marketplace");
  if (/compliance|regra|politic/.test(s)) tags.add("compliance");
  if (/logist|frete/.test(s)) tags.add("logistica");
  if (/tribut|imposto/.test(s)) tags.add("tributacao");
  if (/cross.?border/.test(s)) tags.add("cross-border");
  if (!tags.size) tags.add("geral");
  return [...tags];
}

function computeRelevanceScore(text: string): number {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ");
  let score = 0;
  Object.entries(KEYWORD_WEIGHTS).forEach(([key, weight]) => {
    if (key === "crossborder") {
      if (/cross.?border/.test(normalized)) score += weight;
      return;
    }
    if (normalized.includes(key)) score += weight;
  });
  return Number(score.toFixed(4));
}

async function fetchRssLikeSource(
  sourceConfig: SourceConfig,
  rss2jsonUrl: string,
  rss2jsonKey: string,
  timeoutMs: number,
): Promise<Record<string, unknown>[]> {
  const endpoint = new URL(rss2jsonUrl);
  endpoint.searchParams.set("rss_url", sourceConfig.url);
  endpoint.searchParams.set("count", String(sourceConfig.count || 8));
  if (rss2jsonKey) endpoint.searchParams.set("api_key", rss2jsonKey);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint.toString(), { signal: ctrl.signal });
    if (!res.ok) throw new Error(`rss2json status ${res.status}`);
    const json = await res.json();
    if (String(json?.status || "").toLowerCase() !== "ok" || !Array.isArray(json?.items)) return [];
    return json.items;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchNewsApi(
  newsApiUrl: string,
  apiKey: string,
  timeoutMs: number,
): Promise<Record<string, unknown>[]> {
  if (!apiKey) return [];
  const all: Record<string, unknown>[] = [];
  for (const q of NEWSAPI_QUERIES) {
    const endpoint = new URL(newsApiUrl);
    endpoint.searchParams.set("q", q);
    endpoint.searchParams.set("language", "pt");
    endpoint.searchParams.set("sortBy", "publishedAt");
    endpoint.searchParams.set("pageSize", "30");

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint.toString(), {
        headers: { "X-Api-Key": apiKey },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`newsapi status ${res.status}`);
      const json = await res.json();
      if (!Array.isArray(json?.articles)) continue;
      json.articles.forEach((it: Record<string, unknown>) => all.push(it));
    } finally {
      clearTimeout(timer);
    }
  }
  return all;
}

async function normalizeArticles(
  raw: Record<string, unknown>[],
  sourceConfig: SourceConfig,
): Promise<NormalizedArticle[]> {
  const rows: NormalizedArticle[] = [];
  for (const item of raw) {
    const title = String(item.title || "").trim();
    const rawUrl = String(item.link || item.url || "").trim();
    if (!title || !rawUrl) continue;

    const url = canonicalizeUrl(rawUrl);
    const summary = stripHtml(String(item.description || item.content || item.summary || "")).slice(0, 320);
    const contentForScore = `${title} ${summary}`;
    const category = deriveCategory(contentForScore, sourceConfig.category);
    const relevance = computeRelevanceScore(contentForScore);
    const publishedAt = String(item.pubDate || item.publishedAt || item.published_at || new Date().toISOString());
    const imageUrl =
      String(item.enclosure?.link || item.thumbnail || item.urlToImage || item.image || "").trim() || null;

    rows.push({
      source: sourceConfig.source,
      source_type: sourceConfig.source_type,
      title,
      summary,
      url,
      image_url: imageUrl,
      category,
      tags: buildTags(contentForScore),
      published_at: publishedAt,
      ingested_at: new Date().toISOString(),
      relevance_score: relevance,
      is_featured: relevance >= 2.5,
      is_active: true,
      raw_payload: item,
    });
  }
  return rows;
}

function dedupe(rows: NormalizedArticle[]): NormalizedArticle[] {
  const map = new Map<string, NormalizedArticle>();
  for (const row of rows) {
    const key = row.url.toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      continue;
    }
    const better = row.relevance_score >= prev.relevance_score ? row : prev;
    map.set(key, better);
  }
  return [...map.values()].sort((a, b) => {
    if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-community-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

function errorMessage(error: unknown): string {
  if (!error) return "unknown_error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || String(error);
  const maybe = error as { message?: string; error_description?: string; code?: string; details?: string };
  return maybe.message || maybe.error_description || maybe.details || maybe.code || JSON.stringify(error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const cronSecret = Deno.env.get("COMMUNITY_CRON_SECRET") || "";
  if (cronSecret) {
    const received = req.headers.get("x-community-cron-secret") || "";
    if (received !== cronSecret) return json(401, { error: "unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRole) return json(500, { error: "missing_supabase_service_credentials" });

  const sb = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

  const rss2jsonUrl = Deno.env.get("RSS2JSON_URL") || "https://api.rss2json.com/v1/api.json";
  const rss2jsonKey = Deno.env.get("RSS2JSON_API_KEY") || "";
  const newsApiUrl = Deno.env.get("NEWSAPI_URL") || "https://newsapi.org/v2/everything";
  const newsApiKey = Deno.env.get("NEWSAPI_KEY") || "";
  const timeoutMs = Number(Deno.env.get("COMMUNITY_FETCH_TIMEOUT_MS") || "6000");
  const rssSources = parseJsonEnv<SourceConfig[]>(Deno.env.get("COMMUNITY_RSS_SOURCES"), DEFAULT_RSS_SOURCES);
  const officialSources = parseJsonEnv<SourceConfig[]>(
    Deno.env.get("COMMUNITY_OFFICIAL_SOURCES"),
    DEFAULT_OFFICIAL_SOURCES,
  );

  const sourceResults: Record<string, unknown>[] = [];
  const errors: Record<string, unknown>[] = [];

  const runStart = await sb
    .from("community_ingestion_runs")
    .insert({ status: "running", started_at: new Date().toISOString() })
    .select("id")
    .single();

  const runId = runStart.data?.id || null;
  let itemsRead = 0;
  let itemsInserted = 0;
  let itemsUpdated = 0;

  try {
    const allRawRows: NormalizedArticle[] = [];

    for (const source of [...rssSources, ...officialSources]) {
      try {
        const items = await fetchRssLikeSource(source, rss2jsonUrl, rss2jsonKey, timeoutMs);
        const normalized = await normalizeArticles(items, source);
        itemsRead += normalized.length;
        allRawRows.push(...normalized);
        sourceResults.push({ source: source.source, source_type: source.source_type, status: "ok", count: normalized.length });
      } catch (error) {
        sourceResults.push({ source: source.source, source_type: source.source_type, status: "error" });
        errors.push({ source: source.source, message: errorMessage(error) });
      }
    }

    try {
      const newsRaw = await fetchNewsApi(newsApiUrl, newsApiKey, timeoutMs);
      const normalizedNews = await normalizeArticles(
        newsRaw,
        { source: "NewsAPI", source_type: "newsapi", category: "marketplace", url: "newsapi://everything", count: 90 },
      );
      itemsRead += normalizedNews.length;
      allRawRows.push(...normalizedNews);
      sourceResults.push({ source: "NewsAPI", source_type: "newsapi", status: "ok", count: normalizedNews.length });
    } catch (error) {
      sourceResults.push({ source: "NewsAPI", source_type: "newsapi", status: "error" });
      errors.push({ source: "NewsAPI", message: errorMessage(error) });
    }

    const deduped = dedupe(allRawRows).slice(0, 250);
    const urls = deduped.map((row) => row.url);
    const existingQuery = urls.length
      ? await sb.from("community_articles").select("url").in("url", urls)
      : { data: [], error: null };

    if (existingQuery.error) throw existingQuery.error;
    const existingSet = new Set((existingQuery.data || []).map((x: { url: string }) => String(x.url || "").toLowerCase()));
    itemsUpdated = deduped.filter((row) => existingSet.has(row.url.toLowerCase())).length;
    itemsInserted = deduped.length - itemsUpdated;

    if (deduped.length) {
      const { error: upsertError } = await sb.from("community_articles").upsert(deduped, { onConflict: "url_hash" });
      if (upsertError) throw upsertError;
    }

    if (runId) {
      await sb
        .from("community_ingestion_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: errors.length ? "partial" : "success",
          items_read: itemsRead,
          items_inserted: itemsInserted,
          items_updated: itemsUpdated,
          source_results: sourceResults,
          errors,
        })
        .eq("id", runId);
    }

    return json(200, {
      ok: true,
      run_id: runId,
      status: errors.length ? "partial" : "success",
      items_read: itemsRead,
      items_inserted: itemsInserted,
      items_updated: itemsUpdated,
      errors_count: errors.length,
    });
  } catch (error) {
    if (runId) {
      await sb
        .from("community_ingestion_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "failed",
          items_read: itemsRead,
          items_inserted: itemsInserted,
          items_updated: itemsUpdated,
          source_results: sourceResults,
          errors: [...errors, { source: "ingest", message: errorMessage(error) }],
        })
        .eq("id", runId);
    }
    return json(500, {
      ok: false,
      run_id: runId,
      error: errorMessage(error),
      source_results: sourceResults,
    });
  }
});
