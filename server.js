const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || "properties";
const SUPABASE_PROFILE_TABLE = process.env.SUPABASE_PROFILE_TABLE || "profiles";
const SUPABASE_AI_SETTINGS_TABLE = process.env.SUPABASE_AI_SETTINGS_TABLE || "ai_settings";
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "google/gemma-4-31b-it:free";
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const AI_ROUTING_STORAGE = process.env.AI_ROUTING_STORAGE || (supabaseConfigured() ? "db" : "disk");
const AI_ROUTING_PATH = path.join(ROOT, ".data", "ai-routing.json");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  try {
    setCors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    const parsed = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "POST" && parsed.pathname === "/api/scrape") {
      await handleScrape(req, res);
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/openrouter") {
      await handleOpenRouter(req, res);
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/openrouter/test") {
      await handleOpenRouterTest(req, res);
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/ai-config") {
      await handleGetAiConfig(req, res);
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/ai-config") {
      await handleSaveAiConfig(req, res);
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/ai-routing") {
      await handleGetAiConfig(req, res);
      return;
    }
    if (req.method === "PUT" && parsed.pathname === "/api/ai-routing") {
      await handleSaveAiConfig(req, res);
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/health/ai") {
      await handleAiHealth(req, res);
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/auth/login") {
      await handleLogin(req, res);
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/auth/me") {
      await handleMe(req, res);
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/properties") {
      await handleGetProperties(req, res);
      return;
    }
    if (req.method === "POST" && parsed.pathname === "/api/properties") {
      await handleSyncProperties(req, res);
      return;
    }
    if (req.method === "GET" && parsed.pathname === "/api/config") {
      sendJson(res, 200, {
        openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
        defaultModel: DEFAULT_MODEL,
        aiRoutingStorage: AI_ROUTING_STORAGE,
        supabaseConfigured: supabaseConfigured(),
        authConfigured: supabaseAuthConfigured(),
      });
      return;
    }
    serveStatic(parsed.pathname, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Owner Direct demo: http://${HOST}:${PORT}`);
});

function serveStatic(pathname, res) {
  const safePath = pathname === "/" || !path.extname(pathname) ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, safePath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseAuthConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function supabaseUrl(pathname) {
  return `${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${pathname}`;
}

function supabaseAuthUrl(pathname) {
  return `${process.env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/${pathname}`;
}

async function handleLogin(req, res) {
  const body = await readBody(req);
  const { email, password } = JSON.parse(body || "{}");
  if (!email || !password) {
    sendJson(res, 400, { error: "Faltan email y password." });
    return;
  }

  if (!supabaseAuthConfigured()) {
    const demo = demoUser(email, password);
    if (!demo) {
      sendJson(res, 401, { error: "Usuario demo inválido." });
      return;
    }
    sendJson(res, 200, demo);
    return;
  }

  const response = await fetch(supabaseAuthUrl("token?grant_type=password"), {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    sendJson(res, response.status, { error: data.error_description || data.msg || "Login inválido." });
    return;
  }
  const profile = await profileForUser(data.user);
  sendJson(res, 200, {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: { id: data.user.id, email: data.user.email, role: profile.role },
  });
}

async function handleMe(req, res) {
  const session = await sessionFromRequest(req);
  sendJson(res, 200, { user: session?.user || null });
}

function demoUser(email, password) {
  if (password !== "1234") return null;
  const roles = {
    "admin@admin.com": "admin",
    "vendedor@vendedor.com": "vendedor",
    "user@user.com": "user",
  };
  const role = roles[String(email).toLowerCase()];
  if (!role) return null;
  return {
    access_token: `demo-${role}`,
    user: { id: `demo-${role}`, email: String(email).toLowerCase(), role },
  };
}

async function sessionFromRequest(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  if (!supabaseAuthConfigured() && token.startsWith("demo-")) {
    const role = token.replace("demo-", "");
    const email = role === "admin" ? "admin@admin.com" : role === "vendedor" ? "vendedor@vendedor.com" : "user@user.com";
    return { user: { id: token, email, role } };
  }
  if (!supabaseAuthConfigured()) return null;
  const response = await fetch(supabaseAuthUrl("user"), {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  const user = await response.json();
  const profile = await profileForUser(user);
  return { user: { id: user.id, email: user.email, role: profile.role } };
}

async function profileForUser(user) {
  const fallbackRole = user?.email === "admin@admin.com" ? "admin" : user?.email === "vendedor@vendedor.com" ? "vendedor" : "user";
  if (!supabaseConfigured() || !user?.id) return { role: fallbackRole };
  const response = await fetch(supabaseUrl(`${SUPABASE_PROFILE_TABLE}?select=role,email&id=eq.${encodeURIComponent(user.id)}&limit=1`), {
    headers: supabaseHeaders(),
  });
  if (!response.ok) return { role: fallbackRole };
  const [profile] = await response.json();
  return { role: profile?.role || fallbackRole };
}

function canManageProperties(user) {
  return user?.role === "admin" || user?.role === "vendedor";
}

function canManageAiConfig(user) {
  return user?.role === "admin";
}

function canSeeProperty(user, property) {
  if (user?.role === "admin") return true;
  if (user?.role === "vendedor") return property.ownerId === user.id || property.ownerEmail === user.email;
  return property.status === "published";
}

function defaultAiConfig() {
  return {
    profile: "balanced",
    functions: {
      search: {
        activeModel: DEFAULT_MODEL,
        fallbacks: ["openai/gpt-oss-120b:free", "meta-llama/llama-3.2-3b-instruct:free"],
        lastSuccessfulModel: "",
        lastSuccessAt: "",
        status: "unknown",
        averageMs: null,
      },
      vision: {
        activeModel: DEFAULT_MODEL,
        fallbacks: ["tencent/hy3-preview:free", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "nvidia/llama-nemotron-embed-vl-1b-v2:free"],
        lastSuccessfulModel: "",
        lastSuccessAt: "",
        status: "unknown",
        averageMs: null,
      },
      plan: {
        activeModel: DEFAULT_MODEL,
        fallbacks: ["tencent/hy3-preview:free", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"],
        lastSuccessfulModel: "",
        lastSuccessAt: "",
        status: "unknown",
        averageMs: null,
      },
      score: {
        activeModel: "openai/gpt-oss-120b:free",
        fallbacks: [DEFAULT_MODEL, "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"],
        lastSuccessfulModel: "",
        lastSuccessAt: "",
        status: "unknown",
        averageMs: null,
      },
    },
  };
}

async function handleGetAiConfig(req, res) {
  const session = await sessionFromRequest(req);
  const user = session?.user || null;
  const config = await loadAiRoutingConfig();
  const publicPayload = {
    configured: supabaseConfigured() || AI_ROUTING_STORAGE === "disk",
    storage: AI_ROUTING_STORAGE,
    serverKeyConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    config,
  };
  if (!canManageAiConfig(user)) {
    sendJson(res, 200, { ...publicPayload, readonly: true });
    return;
  }
  if (AI_ROUTING_STORAGE === "disk" || !supabaseConfigured()) {
    sendJson(res, 200, publicPayload);
    return;
  }
  const fallback = defaultAiConfig();
  const response = await fetch(supabaseUrl(`${SUPABASE_AI_SETTINGS_TABLE}?select=config,health,profile&scope=eq.global&limit=1`), {
    headers: supabaseHeaders(),
  });
  if (!response.ok) {
    sendJson(res, 200, { configured: true, config: fallback, warning: await response.text() });
    return;
  }
  const [row] = await response.json();
  sendJson(res, 200, {
    configured: true,
    config: row?.config || fallback,
    health: row?.health || {},
    profile: row?.profile || row?.config?.profile || fallback.profile,
  });
}

async function handleSaveAiConfig(req, res) {
  const session = await sessionFromRequest(req);
  const user = session?.user || null;
  if (!canManageAiConfig(user)) {
    sendJson(res, 403, { error: "Solo admin puede guardar configuración IA." });
    return;
  }
  const body = await readBody(req);
  const { config, health = {} } = JSON.parse(body || "{}");
  const normalized = normalizeAiConfig(config);
  if (AI_ROUTING_STORAGE === "disk" || !supabaseConfigured()) {
    await saveDiskAiConfig(normalized);
    sendJson(res, 200, { configured: false, storage: "disk", saved: true, config: normalized });
    return;
  }
  const row = {
    id: "global",
    scope: "global",
    owner_id: isUuid(user.id) ? user.id : null,
    profile: normalized.profile || "balanced",
    config: normalized,
    health,
    updated_at: new Date().toISOString(),
  };
  const response = await fetch(supabaseUrl(SUPABASE_AI_SETTINGS_TABLE), {
    method: "POST",
    headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify([row]),
  });
  if (!response.ok) {
    sendJson(res, response.status, { error: await response.text() });
    return;
  }
  sendJson(res, 200, { configured: true, saved: true, config: normalized });
}

async function loadAiRoutingConfig() {
  if (AI_ROUTING_STORAGE !== "disk" && supabaseConfigured()) {
    const response = await fetch(supabaseUrl(`${SUPABASE_AI_SETTINGS_TABLE}?select=config&scope=eq.global&limit=1`), {
      headers: supabaseHeaders(),
    });
    if (response.ok) {
      const [row] = await response.json();
      if (row?.config) return normalizeAiConfig(row.config);
    }
  }
  return loadDiskAiConfig();
}

function loadDiskAiConfig() {
  try {
    return normalizeAiConfig(JSON.parse(fs.readFileSync(AI_ROUTING_PATH, "utf8")));
  } catch {
    return defaultAiConfig();
  }
}

async function saveDiskAiConfig(config) {
  await fs.promises.mkdir(path.dirname(AI_ROUTING_PATH), { recursive: true });
  await fs.promises.writeFile(AI_ROUTING_PATH, JSON.stringify(normalizeAiConfig(config), null, 2));
}

function normalizeAiConfig(config) {
  const fallback = defaultAiConfig();
  const next = config && typeof config === "object" ? config : fallback;
  const result = { profile: next.profile || fallback.profile, functions: {} };
  for (const key of ["search", "vision", "plan", "score"]) {
    const item = next.functions?.[key] || fallback.functions[key];
    result.functions[key] = {
      activeModel: String(item.activeModel || fallback.functions[key].activeModel),
      fallbacks: unique(Array.isArray(item.fallbacks) ? item.fallbacks.filter(Boolean).map(String) : fallback.functions[key].fallbacks),
      lastSuccessfulModel: item.lastSuccessfulModel || "",
      lastSuccessAt: item.lastSuccessAt || "",
      status: item.status || "unknown",
      averageMs: item.averageMs || null,
    };
  }
  return result;
}

async function handleGetProperties(req, res) {
  const session = await sessionFromRequest(req);
  const user = session?.user || null;
  if (!supabaseConfigured()) {
    sendJson(res, 200, { configured: false, properties: [] });
    return;
  }
  const response = await fetch(supabaseUrl(`${SUPABASE_TABLE}?select=id,payload,updated_at&order=updated_at.desc`), {
    headers: supabaseHeaders(),
  });
  if (!response.ok) {
    sendJson(res, response.status, { error: await response.text() });
    return;
  }
  const rows = await response.json();
  const properties = rows
    .map((row) => row.payload)
    .filter(Boolean)
    .filter((property) => canSeeProperty(user, property));
  sendJson(res, 200, { configured: true, properties, user });
}

async function handleSyncProperties(req, res) {
  const body = await readBody(req);
  const { properties = [] } = JSON.parse(body || "{}");
  const session = await sessionFromRequest(req);
  const user = session?.user || null;
  if (!supabaseConfigured()) {
    sendJson(res, 200, { configured: false, saved: false });
    return;
  }
  if (!canManageProperties(user)) {
    sendJson(res, 403, { error: "No tenés permiso para guardar propiedades." });
    return;
  }
  const current = Array.isArray(properties) ? properties : [];
  const rows = current
    .filter((property) => user.role === "admin" || !property.ownerId || property.ownerId === user.id)
    .map((property) => ({
      id: property.id,
      payload: {
        ...property,
        ownerId: property.ownerId || user.id,
        ownerEmail: property.ownerEmail || user.email,
      },
      owner_id: isUuid(property.ownerId || user.id) ? (property.ownerId || user.id) : null,
      owner_email: property.ownerEmail || user.email,
      status: property.status || "draft",
      updated_at: new Date().toISOString(),
    })).filter((row) => row.id);

  const existingResponse = await fetch(supabaseUrl(`${SUPABASE_TABLE}?select=id,payload`), { headers: supabaseHeaders() });
  if (!existingResponse.ok) {
    sendJson(res, existingResponse.status, { error: await existingResponse.text() });
    return;
  }
  const existing = await existingResponse.json();
  const nextIds = new Set(rows.map((row) => row.id));
  await Promise.all(existing
    .filter((row) => !nextIds.has(row.id) && (user.role === "admin" || canSeeProperty(user, row.payload || {})))
    .map((row) => fetch(supabaseUrl(`${SUPABASE_TABLE}?id=eq.${encodeURIComponent(row.id)}`), {
      method: "DELETE",
      headers: supabaseHeaders(),
    })));

  if (rows.length) {
    const upsertResponse = await fetch(supabaseUrl(SUPABASE_TABLE), {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify(rows),
    });
    if (!upsertResponse.ok) {
      sendJson(res, upsertResponse.status, { error: await upsertResponse.text() });
      return;
    }
  }
  sendJson(res, 200, { configured: true, saved: true, count: rows.length });
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-OpenRouter-Key");
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

async function handleScrape(req, res) {
  const body = await readBody(req);
  const { url } = JSON.parse(body || "{}");
  const target = new URL(url);
  if (!["http:", "https:"].includes(target.protocol)) {
    sendJson(res, 400, { error: "URL invalida." });
    return;
  }

  const response = await fetch(target.href, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 OwnerDirectDemo/1.0",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-UY,es;q=0.9,en;q=0.7",
    },
  });
  if (!response.ok) {
    sendJson(res, 502, { error: `La plataforma respondio ${response.status}.` });
    return;
  }
  const html = await response.text();
  const scraped = await scrapeHtml(target.href, html);
  sendJson(res, 200, scraped);
}

async function handleOpenRouter(req, res) {
  const body = await readBody(req);
  const { apiKey, model, fallbackModels = null, functionType = "search", messages, temperature = 0.2, responseFormat = true } = JSON.parse(body || "{}");
  const effectiveApiKey = req.headers["x-openrouter-key"] || apiKey || process.env.OPENROUTER_API_KEY;
  const routing = await loadAiRoutingConfig();
  const task = routing.functions?.[functionType] || routing.functions?.search || defaultAiConfig().functions.search;
  const effectiveModel = model || task.activeModel || DEFAULT_MODEL;
  if (!effectiveApiKey) {
    sendJson(res, 401, { error: "Falta API key de OpenRouter." });
    return;
  }
  if (!effectiveModel) {
    sendJson(res, 400, { error: "Falta modelo de OpenRouter." });
    return;
  }

  const models = unique([
    effectiveModel,
    ...(Array.isArray(fallbackModels) ? fallbackModels : (task.fallbacks || [])),
    ...(process.env.OPENROUTER_FALLBACK_MODELS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  ]);

  const result = await runOpenRouterCompletion({
    apiKey: effectiveApiKey,
    models,
    messages,
    temperature,
    responseFormat,
    origin: req.headers.origin,
  });
  await persistAiHealth(functionType, result);
  if (!result.ok) {
    sendJson(res, result.status || 502, {
      error: humanOpenRouterError(result.status, result.text),
      raw: result.text,
      meta: result.meta,
    });
    return;
  }
  sendJson(res, 200, { ...result.json, meta: result.meta });
}

async function handleOpenRouterTest(req, res) {
  const body = await readBody(req);
  const { apiKey, model, functionType = "search" } = JSON.parse(body || "{}");
  const effectiveApiKey = req.headers["x-openrouter-key"] || apiKey || process.env.OPENROUTER_API_KEY;
  if (!effectiveApiKey) {
    sendJson(res, 401, { error: "Falta API key de OpenRouter." });
    return;
  }
  if (!model) {
    sendJson(res, 400, { error: "Falta modelo para probar." });
    return;
  }
  const result = await runOpenRouterCompletion({
    apiKey: effectiveApiKey,
    models: [model],
    temperature: 0,
    responseFormat: true,
    origin: req.headers.origin,
    messages: [{
      role: "user",
      content: `Respondé solo JSON válido para probar ${functionType}: {"ok":true,"functionType":"${functionType}","message":"modelo disponible"}`,
    }],
  });
  await persistAiHealth(functionType, result);
  if (!result.ok) {
    sendJson(res, result.status || 502, {
      ok: false,
      status: result.status,
      error: humanOpenRouterError(result.status, result.text),
      meta: result.meta,
    });
    return;
  }
  sendJson(res, 200, { ok: true, result: result.json, meta: result.meta });
}

async function handleAiHealth(req, res) {
  const session = await sessionFromRequest(req);
  const user = session?.user || null;
  if (!canManageAiConfig(user)) {
    sendJson(res, 403, { error: "Solo admin puede ver health IA." });
    return;
  }
  const effectiveApiKey = req.headers["x-openrouter-key"] || process.env.OPENROUTER_API_KEY;
  if (!effectiveApiKey) {
    sendJson(res, 200, { serverKeyConfigured: false, status: "error", tasks: {}, error: "Falta OPENROUTER_API_KEY." });
    return;
  }
  const routing = await loadAiRoutingConfig();
  const tasks = {};
  for (const functionType of ["search", "vision", "plan", "score"]) {
    const item = routing.functions?.[functionType] || defaultAiConfig().functions[functionType];
    const result = await runOpenRouterCompletion({
      apiKey: effectiveApiKey,
      models: [item.activeModel, ...(item.fallbacks || [])],
      temperature: 0,
      responseFormat: true,
      origin: req.headers.origin,
      messages: [{
        role: "user",
        content: `Respondé JSON válido: {"ok":true,"task":"${functionType}"}`,
      }],
    });
    await persistAiHealth(functionType, result);
    tasks[functionType] = result.ok
      ? { status: result.meta.fallbackUsed ? "fallback" : "ok", usedModel: result.meta.usedModel, durationMs: result.meta.durationMs }
      : { status: "error", attemptedModels: result.meta.attemptedModels, error: humanOpenRouterError(result.status, result.text) };
  }
  const statuses = Object.values(tasks).map((task) => task.status);
  const status = statuses.includes("error") ? "error" : statuses.includes("fallback") ? "fallback" : "ok";
  sendJson(res, 200, { serverKeyConfigured: true, status, tasks });
}

async function persistAiHealth(functionType, result) {
  try {
    const config = await loadAiRoutingConfig();
    const current = config.functions?.[functionType];
    if (!current) return;
    current.status = result.ok ? (result.meta?.fallbackUsed ? "fallback" : "active") : "failed";
    current.lastSuccessfulModel = result.ok ? result.meta?.usedModel || current.lastSuccessfulModel : current.lastSuccessfulModel;
    current.lastSuccessAt = result.ok ? new Date().toISOString() : current.lastSuccessAt;
    current.averageMs = result.meta?.durationMs || current.averageMs;
    if (AI_ROUTING_STORAGE === "disk" || !supabaseConfigured()) {
      await saveDiskAiConfig(config);
    } else {
      await fetch(supabaseUrl(SUPABASE_AI_SETTINGS_TABLE), {
        method: "POST",
        headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates" }),
        body: JSON.stringify([{
          id: "global",
          scope: "global",
          profile: config.profile || "balanced",
          config,
          health: { updatedAt: new Date().toISOString(), lastTask: functionType, lastStatus: current.status },
          updated_at: new Date().toISOString(),
        }]),
      });
    }
  } catch {
    // Health telemetry is best-effort.
  }
}

async function runOpenRouterCompletion({ apiKey, models, messages, temperature = 0.2, responseFormat = true, origin }) {
  const payload = { messages, temperature };
  if (responseFormat) payload.response_format = { type: "json_object" };
  const attemptedModels = [];
  const started = Date.now();
  let lastResponse = null;
  let lastText = "";
  for (const candidate of unique(models.filter(Boolean))) {
    attemptedModels.push(candidate);
    const response = await fetch(`${OPENROUTER_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": origin || process.env.PUBLIC_URL || "http://127.0.0.1:4173",
        "X-Title": "Owner Direct Demo",
      },
      body: JSON.stringify({ ...payload, model: candidate }),
    });
    const text = await response.text();
    if (response.ok) {
      let json = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
      return {
        ok: true,
        status: response.status,
        json,
        text,
        meta: {
          usedModel: candidate,
          attemptedModels,
          fallbackUsed: attemptedModels.length > 1,
          durationMs: Date.now() - started,
        },
      };
    }
    lastResponse = response;
    lastText = text;
    if ([401, 402].includes(response.status)) break;
  }
  return {
    ok: false,
    status: lastResponse?.status || 502,
    text: lastText,
    meta: {
      usedModel: null,
      attemptedModels,
      fallbackUsed: attemptedModels.length > 1,
      durationMs: Date.now() - started,
    },
  };
}

function humanOpenRouterError(status, text = "") {
  if (status === 429) return "El modelo gratuito está temporalmente limitado. Probá de nuevo en unos minutos o configurá otro modelo/fallback en OpenRouter.";
  if (status === 401) return "La API key de OpenRouter no es válida o no está configurada.";
  if (status === 402) return "OpenRouter requiere crédito o un proveedor habilitado para este modelo.";
  if (status >= 500) return "El proveedor de IA respondió con error temporal.";
  try {
    return JSON.parse(text).error?.message || `OpenRouter respondió ${status}.`;
  } catch {
    return text.slice(0, 220) || `OpenRouter respondió ${status}.`;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) reject(new Error("Body demasiado grande."));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function scrapeHtml(url, html) {
  const platform = detectPlatform(url);
  const metadata = readMetadata(html);
  const jsonLd = readJsonLd(html);
  const text = cleanText(`${stripTags(html)} ${extractJsonText(html)}`);
  const coordinates = readCoordinates(html, text);
  const mercadoLibre = platform === "MercadoLibre" ? await readMercadoLibreEnrichment(url, html) : null;
  const rawPhotos = unique([
    ...(mercadoLibre?.photos || []),
    ...extractImagesFromJson(jsonLd),
    ...extractImageUrls(html),
    metadata["og:image"],
    metadata["twitter:image"],
  ]).filter(Boolean);
  const photos = unique([
    ...(mercadoLibre?.photos || []),
    ...filterPropertyPhotos(rawPhotos),
  ]).slice(0, 80);

  const data = normalizeUruguayData({
    title: first(mercadoLibre?.data?.title, jsonLd.name, metadata["og:title"], metadata.title, betweenTitle(html)),
    description: first(jsonLd.description, metadata["og:description"], metadata.description),
    price: firstNumber(mercadoLibre?.data?.price, jsonLd.offers?.price, readPrice(text)),
    priceUsd: firstNumber(mercadoLibre?.data?.priceUsd, readUsdPrice(text)),
    bedrooms: firstNumber(mercadoLibre?.data?.bedrooms, readAttribute(text, ["dormitorio", "dormitorios", "dorm."])),
    bathrooms: firstNumber(mercadoLibre?.data?.bathrooms, readAttribute(text, ["baño", "baños", "banos", "bano"])),
    parking: firstNumber(mercadoLibre?.data?.parking, readAttribute(text, ["cochera", "cocheras", "garaje", "garage"])),
    builtArea: firstNumber(mercadoLibre?.data?.builtArea, readArea(text, ["área privada", "area privada", "superficie cubierta", "cubiertos", "construidos", "edificados", "edificada", "construida"])),
    landArea: firstNumber(mercadoLibre?.data?.landArea, readArea(text, ["terreno", "solar", "lote", "superficie total", "totales", "total"])),
    totalArea: firstNumber(mercadoLibre?.data?.totalArea, readArea(text, ["superficie total", "totales", "total"])),
    commonFees: readExpenses(text),
    city: readCity(jsonLd, metadata, text),
    neighborhood: readNeighborhood(jsonLd, metadata, text),
    lat: coordinates.lat,
    lng: coordinates.lng,
    mapUrl: coordinates.mapUrl,
    type: readPropertyType(text),
    extras: mergeServerExtras(mercadoLibre?.data?.extras || [], readExtraDetails(text)),
  }, text);

  return {
    url,
    platform,
    data,
    photos,
    videos: mercadoLibre?.videos || [],
    confidence: {
      metadata: Boolean(metadata["og:title"] || metadata.description),
      jsonLd: Boolean(jsonLd.name || jsonLd.description || jsonLd.offers),
      photos: photos.length,
      mercadoLibreApi: Boolean(mercadoLibre),
    },
  };
}

function detectPlatform(url) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host.includes("mercadolibre")) return "MercadoLibre";
  if (host.includes("infocasas")) return "InfoCasas";
  return host;
}

async function readMercadoLibreEnrichment(url, html) {
  const itemId = extractMercadoLibreItemId(url, html);
  if (!itemId) return null;
  try {
    const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 OwnerDirectDemo/1.0",
        Accept: "application/json",
      },
    });
    if (!response.ok) return null;
    const item = await response.json();
    const attrs = Array.isArray(item.attributes) ? item.attributes : [];
    const photos = unique((item.pictures || [])
      .map((picture) => picture.secure_url || picture.url || picture.max_size || picture.id)
      .filter((value) => typeof value === "string" && /^https?:\/\//i.test(value)));
    const videos = readMercadoLibreVideos(item);
    const data = {
      title: item.title || null,
      price: item.price || null,
      priceUsd: item.currency_id === "USD" ? item.price : null,
      bedrooms: attrNumber(attrs, ["BEDROOMS"], ["Dormitorios"]),
      bathrooms: attrNumber(attrs, ["FULL_BATHROOMS", "BATHROOMS"], ["Baños", "Banos"]),
      parking: attrNumber(attrs, ["PARKING_LOTS", "GARAGES"], ["Cocheras", "Garajes"]),
      builtArea: attrNumber(attrs, ["COVERED_AREA", "PRIVATE_AREA"], ["Área privada", "Area privada", "Superficie cubierta", "Cubiertos", "Edificados"]),
      landArea: attrNumber(attrs, ["TOTAL_AREA", "LOT_AREA"], ["Superficie total", "Terreno"]),
      totalArea: attrNumber(attrs, ["TOTAL_AREA", "LOT_AREA"], ["Superficie total"]),
      extras: attrs
        .map((attr) => ({ label: attr.name || attr.id, value: attr.value_name || valueStructLabel(attr.value_struct) }))
        .filter((item) => item.label && item.value)
        .slice(0, 40),
    };
    return { itemId, data, photos, videos };
  } catch {
    return null;
  }
}

function extractMercadoLibreItemId(url, html) {
  const source = `${url} ${html}`;
  const patterns = [
    /\b(ML[A-Z])[-_]?(\d{6,})\b/i,
    /"itemId"\s*:\s*"?\b(ML[A-Z])[-_]?(\d{6,})\b/i,
    /"id"\s*:\s*"?\b(ML[A-Z])[-_]?(\d{6,})\b/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (match) return `${match[1].toUpperCase()}${match[2]}`;
  }
  return null;
}

function readMercadoLibreVideos(item) {
  const videos = [];
  if (item.video_id) videos.push(videoUrl(item.video_id));
  if (Array.isArray(item.videos)) {
    item.videos.forEach((video) => videos.push(video.url || video.secure_url || video.id || video.video_id));
  }
  return unique(videos.filter(Boolean).map(videoUrl));
}

function videoUrl(value) {
  const text = String(value || "");
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  return `https://www.youtube.com/watch?v=${encodeURIComponent(text)}`;
}

function attrNumber(attrs, ids, names) {
  const attr = attrs.find((item) => ids.includes(item.id))
    || attrs.find((item) => names.some((name) => normalizeLabelText(item.name) === normalizeLabelText(name)));
  if (!attr) return null;
  if (attr.value_struct && Number.isFinite(Number(attr.value_struct.number))) return Number(attr.value_struct.number);
  return numberFrom(attr.value_name || attr.value_id || "");
}

function valueStructLabel(value) {
  if (!value || typeof value !== "object") return "";
  if (value.number === undefined || value.number === null) return "";
  return `${value.number}${value.unit ? ` ${value.unit}` : ""}`;
}

function normalizeLabelText(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function readMetadata(html) {
  const out = {};
  const metaRe = /<meta\s+([^>]+)>/gi;
  let match;
  while ((match = metaRe.exec(html))) {
    const attrs = attrsFrom(match[1]);
    const key = attrs.property || attrs.name;
    if (key && attrs.content) out[key.toLowerCase()] = decode(attrs.content);
  }
  return out;
}

function attrsFrom(source) {
  const attrs = {};
  const attrRe = /([\w:-]+)\s*=\s*["']([^"']*)["']/g;
  let match;
  while ((match = attrRe.exec(source))) attrs[match[1].toLowerCase()] = match[2];
  return attrs;
}

function readJsonLd(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, raw] of scripts) {
    try {
      const parsed = JSON.parse(decode(raw.trim()));
      if (Array.isArray(parsed)) return parsed[0] || {};
      if (parsed["@graph"]) return parsed["@graph"].find((item) => item.offers || item.name) || parsed["@graph"][0] || {};
      return parsed;
    } catch {
      continue;
    }
  }
  return {};
}

function extractImagesFromJson(value) {
  const images = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (typeof node.image === "string") images.push(node.image);
    if (Array.isArray(node.image)) images.push(...node.image.filter((item) => typeof item === "string"));
    Object.values(node).forEach(visit);
  };
  visit(value);
  return images;
}

function extractImageUrls(html) {
  const normalized = html.replace(/\\\//g, "/").replace(/\\u002F/g, "/");
  const matches = normalized.match(/https?:\/\/[^"'\s)]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\s)]*)?/gi) || [];
  return matches.map((url) => decode(url));
}

function filterPropertyPhotos(urls) {
  const bad = /logo|avatar|profile|perfil|mapa|map|staticmap|icon|sprite|placeholder|blank|default|favicon|watermark|marker|pin|agency|agencia|banner|facebook|instagram|whatsapp|youtube|google|apple|appstore|app-store|playstore|googleplay|google-play|store|disponible|available|download|descarga|flag|flags|bandera|country|countries|pais|pa[ií]s|search|lupa|magnif|qr|badge|award|medal/i;
  const goodHost = /infocasas|mercadolibre|mlstatic|cloudfront|cdn|img|image|photos|fotos|static/i;
  const seen = new Set();
  return unique(urls)
    .map((url) => url.replace(/&amp;/g, "&"))
    .filter((url) => /^https?:\/\//i.test(url))
    .filter((url) => /\.(jpe?g|png|webp)(\?|$)/i.test(url))
    .filter((url) => !bad.test(url))
    .filter((url) => goodHost.test(url) || /\/(properties|inmuebles|fotos|photos|uploads|items)\//i.test(url))
    .filter((url) => !/(\b16x16\b|\b32x32\b|\b48x48\b|\b64x64\b|\b80x80\b|\b100x100\b|\b150x150\b|\b200x200\b)/i.test(url))
    .filter((url) => {
      const key = photoDedupeKey(url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function photoDedupeKey(url) {
  try {
    const parsed = new URL(url);
    const filename = parsed.pathname.split("/").pop() || parsed.pathname;
    return filename
      .toLowerCase()
      .replace(/[_-](small|thumb|thumbnail|medium|large|original|webp|jpg|jpeg|png)/g, "")
      .replace(/[_-]?\d{2,4}x\d{2,4}/g, "")
      .replace(/\.(jpe?g|png|webp)$/i, "");
  } catch {
    return url.toLowerCase().split("?")[0];
  }
}

function stripTags(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

function extractJsonText(html) {
  return decode(html)
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/")
    .replace(/[{}[\]",]/g, " ")
    .replace(/[:_]/g, " ");
}

function cleanText(value) {
  return decode(value).replace(/\s+/g, " ").trim();
}

function betweenTitle(html) {
  return decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
}

function readPrice(text) {
  const match = text.match(/(?:USD|U\$S|US\$|\$)\s*([0-9][0-9.\s]{3,})/i);
  return match ? numberFrom(match[1]) : null;
}

function readUsdPrice(text) {
  const match = text.match(/(?:USD|U\$S|US\$)\s*([0-9][0-9.\s]{3,})/i);
  return match ? numberFrom(match[1]) : null;
}

function readAttribute(text, labels) {
  for (const label of labels) {
    const after = new RegExp(`([0-9]+(?:[,.][0-9]+)?)\\s*(?:${escapeReg(label)})`, "i").exec(text);
    if (after) return numberFrom(after[1]);
    const before = new RegExp(`${labelPattern(label)}\\s*:?\\s*([0-9]+(?:[,.][0-9]+)?)`, "i").exec(text);
    if (before) return numberFrom(before[1]);
  }
  return null;
}

function readArea(text, labels) {
  for (const label of labels) {
    const before = new RegExp(`([0-9]+(?:[,.\\s][0-9]+)*)\\s*m(?:²|2)?\\s*(?:${labelPattern(label)})`, "i").exec(text);
    if (before) return numberFrom(before[1]);
    const after = new RegExp(`${labelPattern(label)}\\s*:?\\s*([0-9]+(?:[,.\\s][0-9]+)*)\\s*m(?:²|2)?`, "i").exec(text);
    if (after) return numberFrom(after[1]);
  }
  return null;
}

function readExpenses(text) {
  const match = text.match(/gastos\s+comunes[^0-9]*(?:USD|U\$S|\$)?\s*([0-9][0-9.\s]*)/i);
  return match ? numberFrom(match[1]) : null;
}

function readCoordinates(html, text) {
  const decoded = `${decode(html)} ${decode(text || "")}`.replace(/\\u002F/g, "/");
  const mapUrl = (decoded.match(/https?:\/\/(?:(?:www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|goo\.gl\/maps)[^"'\s<]+/i) || [])[0] || "";
  const patterns = [
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /(?:lat|latitude)["']?\s*[:=]\s*["']?(-?\d{1,2}\.\d+)["']?[\s\S]{0,80}?(?:lng|lon|longitude)["']?\s*[:=]\s*["']?(-?\d{1,3}\.\d+)/i,
    /(?:lng|lon|longitude)["']?\s*[:=]\s*["']?(-?\d{1,3}\.\d+)["']?[\s\S]{0,80}?(?:lat|latitude)["']?\s*[:=]\s*["']?(-?\d{1,2}\.\d+)/i,
    /ll=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /q=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(decoded);
    if (!match) continue;
    let lat;
    let lng;
    if (/lng|lon|longitude/i.test(pattern.source) && pattern.source.indexOf("lng") < pattern.source.indexOf("lat")) {
      lng = Number(match[1]);
      lat = Number(match[2]);
    } else {
      lat = Number(match[1]);
      lng = Number(match[2]);
    }
    if (isUruguayCoordinate(lat, lng)) return { lat: roundCoord(lat), lng: roundCoord(lng), mapUrl };
  }
  return { lat: null, lng: null, mapUrl };
}

function isUruguayCoordinate(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat <= -30 && lat >= -36 && lng <= -53 && lng >= -59;
}

function roundCoord(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(4)) : null;
}

function readLocationPart(jsonLd, metadata, index) {
  const address = jsonLd.address;
  if (address && typeof address === "object") {
    if (index === 0) return address.addressLocality || address.streetAddress || null;
    if (index === 1) return address.addressRegion || address.addressCountry || null;
  }
  const title = metadata["og:title"] || metadata.title || "";
  const parts = title.split(/[|-]/).map((part) => part.trim()).filter(Boolean);
  return parts[index + 1] || null;
}

function readNeighborhood(jsonLd, metadata, text) {
  const address = jsonLd.address;
  if (address && typeof address === "object") {
    const locality = address.addressLocality || address.streetAddress;
    if (locality && !/montevideo|canelones|maldonado|uruguay/i.test(locality)) return locality;
  }
  const candidates = [
    readAfterLabel(text, "Barrio"),
    readAfterLabel(text, "Zona"),
    readFromTitle(metadata, 0),
    readKnownNeighborhood(text),
  ].filter(Boolean);
  return candidates.find((value) => !/uruguay|venta|alquiler|apartamento|casa/i.test(value)) || null;
}

function normalizeUruguayData(data, text) {
  const neighborhood = readKnownNeighborhood(`${data.title || ""} ${data.description || ""} ${text}`) || data.neighborhood;
  const city = inferUruguayCity(neighborhood, data.city, text);
  const extras = Array.isArray(data.extras) ? data.extras.filter((item) => item.value && !/preg[uú]ntale/i.test(item.value)) : [];
  return {
    ...data,
    neighborhood,
    city,
    commonFees: normalizeCommonFees(data.commonFees, text),
    extras,
  };
}

function mergeServerExtras(primary = [], secondary = []) {
  const byLabel = new Map();
  [...primary, ...secondary].forEach((item) => {
    if (!item?.label || !item?.value) return;
    const key = normalizeLabelText(item.label);
    if (!byLabel.has(key)) byLabel.set(key, item);
  });
  return [...byLabel.values()];
}

function inferUruguayCity(neighborhood, city, text) {
  const montevideo = ["Carrasco", "Pocitos", "Punta Carretas", "Malvín", "Malvin", "Buceo", "Parque Rodó", "Parque Rodo", "Cordón", "Centro", "Ciudad Vieja", "Prado", "La Blanqueada", "Tres Cruces", "Punta Gorda"];
  const canelones = ["Colinas de Carrasco", "Barra de Carrasco", "Lagomar", "Solymar", "Shangrila", "El Pinar", "Pinar"];
  const maldonado = ["Punta del Este", "La Barra", "Manantiales"];
  if (montevideo.includes(neighborhood)) return "Montevideo";
  if (canelones.includes(neighborhood)) return "Canelones";
  if (maldonado.includes(neighborhood)) return "Maldonado";
  if (city && !/uruguay/i.test(city)) return city;
  if (/montevideo/i.test(text)) return "Montevideo";
  if (/canelones/i.test(text)) return "Canelones";
  if (/maldonado|punta del este/i.test(text)) return "Maldonado";
  return city || "";
}

function normalizeCommonFees(value, text) {
  if (!value) return null;
  const match = text.match(/gastos\s+comunes[^0-9]*(USD|U\$S|US\$|\$)?/i);
  if (!match) return value;
  return value;
}

function readCity(jsonLd, metadata, text) {
  const address = jsonLd.address;
  if (address && typeof address === "object") {
    const region = address.addressRegion || address.addressCountry;
    if (region && !/uruguay/i.test(region)) return region;
  }
  const explicit = readAfterLabel(text, "Ciudad") || readAfterLabel(text, "Departamento");
  if (explicit) return explicit;
  if (/montevideo/i.test(text)) return "Montevideo";
  if (/canelones/i.test(text)) return "Canelones";
  if (/maldonado|punta del este/i.test(text)) return "Maldonado";
  return readFromTitle(metadata, 1);
}

function readAfterLabel(text, label) {
  const match = new RegExp(`${escapeReg(label)}\\s*:?\\s*([^•|,]{2,40})`, "i").exec(text);
  return match ? cleanLocationValue(match[1]) : null;
}

function readFromTitle(metadata, index) {
  const title = metadata["og:title"] || metadata.title || "";
  const parts = title.split(/[|-]/).map((part) => cleanLocationValue(part)).filter(Boolean);
  return parts[index + 1] || null;
}

function readKnownNeighborhood(text) {
  const known = [
    "Colinas de Carrasco", "Barra de Carrasco", "Punta Carretas", "Punta Gorda", "Parque Rodo", "Parque Rodó",
    "Ciudad Vieja", "La Blanqueada", "Tres Cruces", "Punta del Este", "El Pinar",
    "Carrasco", "Pocitos", "Malvin", "Malvín", "Buceo",
    "Cordón", "Centro", "Ciudad Vieja", "Prado", "Atahualpa", "Aguada", "La Blanqueada", "Tres Cruces",
    "Maroñas", "Unión", "Goes", "Lagomar", "Solymar", "Shangrila", "Pinar", "La Barra", "Manantiales",
  ];
  return known.find((name) => new RegExp(`\\b${escapeReg(name)}\\b`, "i").test(text)) || null;
}

function cleanLocationValue(value) {
  return String(value || "")
    .replace(/(Venta|Alquiler|Apartamento|Casa|Propiedad|Inmueble|en)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readPropertyType(text) {
  const value = text.toLowerCase();
  if (value.includes("apartamento")) return "Apartamento";
  if (value.includes("terreno")) return "Terreno";
  if (value.includes("chacra")) return "Chacra";
  if (value.includes("local comercial")) return "Local";
  if (value.includes("casa")) return "Casa";
  return null;
}

function readExtraDetails(text) {
  const labels = [
    "Estado",
    "Antigüedad",
    "Antiguedad",
    "Distancia al Mar",
    "Vista al Mar",
    "Financiación",
    "Financiacion",
    "M² edificados",
    "M2 edificados",
    "M² de terraza",
    "M2 de terraza",
    "Barrio Privado",
    "Referencia",
    "Zona",
    "Sobre",
    "Disposición",
    "Disposicion",
    "Gastos Comunes",
    "Planta",
    "Cantidad de Plantas",
    "Acepta permuta",
    "Vivienda Social",
    "Apto para Oficina",
    "Penthouse",
    "Orientación",
    "Orientacion",
    "Garajes",
    "Superficie total",
    "Área privada",
    "Area privada",
    "Ambientes",
    "Cantidad de pisos",
    "Tipo de casa",
    "Jardín",
    "Jardin",
    "Parrillero",
    "Piscina",
    "Antigüedad",
    "Antiguedad",
    "Bodegas",
  ];
  return labels
    .map((label) => ({ label: normalizeLabel(label), value: readLooseValue(text, label) }))
    .filter((item, index, items) => item.value && items.findIndex((other) => other.label === item.label) === index)
    .slice(0, 28);
}

function readLooseValue(text, label) {
  const escaped = escapeReg(label).replace(/\\ /g, "\\s+");
  const match = new RegExp(`${escaped}\\s+([^•|]{1,45})`, "i").exec(text);
  if (!match) return null;
  const value = match[1]
    .replace(/\s{2,}/g, " ")
    .replace(/\b(Tipo de Propiedad|Estado|Baños|Dormitorios|Garajes|Zona)\b.*$/i, "")
    .trim();
  if (!value || value === "¡Pregúntale!" || value === "Preguntale") return null;
  return value;
}

function normalizeLabel(label) {
  return label
    .replace("Antiguedad", "Antigüedad")
    .replace("Financiacion", "Financiación")
    .replace("Disposicion", "Disposición")
    .replace("Orientacion", "Orientación")
    .replace("M2", "M²");
}

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") || null;
}

function firstNumber(...values) {
  const value = first(...values);
  return value ? numberFrom(value) : null;
}

function numberFrom(value) {
  const cleaned = String(value).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function decode(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function labelPattern(value) {
  return escapeReg(value)
    .replace(/a/g, "[aá]")
    .replace(/A/g, "[AÁ]")
    .replace(/e/g, "[eé]")
    .replace(/E/g, "[EÉ]")
    .replace(/i/g, "[ií]")
    .replace(/I/g, "[IÍ]")
    .replace(/o/g, "[oó]")
    .replace(/O/g, "[OÓ]")
    .replace(/u/g, "[uúü]")
    .replace(/U/g, "[UÚÜ]")
    .replace(/\s+/g, "\\s+");
}

function escapeReg(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}
