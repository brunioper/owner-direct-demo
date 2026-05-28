const STORAGE_KEY = "od-demo-state-v1";
const SETTINGS_KEY = "od-demo-settings-v1";
const AI_CONFIG_KEY = "od-demo-ai-config-v1";
const AI_USAGE_KEY = "od-demo-ai-usage-v1";
const AUTH_KEY = "od-demo-auth-v1";
const LOCAL_API_BASE = "http://127.0.0.1:4173";
const DEFAULT_MODEL = "openrouter/free";
const MODEL_PRESETS = [
  "openrouter/free",
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-31b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
];
const AI_FUNCTIONS = {
  search: { label: "Búsqueda IA", help: "Texto natural, imagen de referencia y ranking de propiedades.", speed: "rápido", quality: "media/alta" },
  vision: { label: "Fotos", help: "Análisis visual de fotos, ambientes y calidad de imagen.", speed: "medio", quality: "visual" },
  plan: { label: "Planos", help: "Lectura de planos, plantas, dormitorios y baños.", speed: "medio", quality: "espacial" },
  score: { label: "Score", help: "Evaluación comercial, riesgos y reporte de valor.", speed: "medio", quality: "razonamiento" },
};
const EDITOR_STEPS = ["import", "data", "media", "analysis", "publish"];
const EDITOR_STEP_LABELS = {
  import: "Importar",
  data: "Datos básicos",
  media: "Fotos",
  analysis: "Análisis",
  publish: "Publicar",
};
const MODEL_PROFILES = {
  fast: {
    label: "Rápido y económico",
    description: "Prioriza modelos free/livianos para demos rápidas.",
    functions: {
      search: ["openrouter/free", "openai/gpt-oss-120b:free", "meta-llama/llama-3.2-3b-instruct:free"],
      vision: ["openrouter/free", "google/gemma-4-31b-it:free", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"],
      plan: ["openrouter/free", "google/gemma-4-31b-it:free", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"],
      score: ["openrouter/free", "openai/gpt-oss-120b:free", "meta-llama/llama-3.2-3b-instruct:free"],
    },
  },
  balanced: {
    label: "Equilibrado",
    description: "Default: buen balance para búsqueda, fotos, planos y scoring.",
    functions: {
      search: ["openrouter/free", "openai/gpt-oss-120b:free", "google/gemma-4-31b-it:free"],
      vision: ["openrouter/free", "google/gemma-4-31b-it:free", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"],
      plan: ["openrouter/free", "google/gemma-4-31b-it:free", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"],
      score: ["openrouter/free", "openai/gpt-oss-120b:free", "google/gemma-4-31b-it:free"],
    },
  },
  quality: {
    label: "Máxima calidad",
    description: "Prueba primero modelos más pesados/omni para mejor análisis.",
    functions: {
      search: ["openrouter/free", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "openai/gpt-oss-120b:free"],
      vision: ["openrouter/free", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "google/gemma-4-31b-it:free"],
      plan: ["openrouter/free", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "google/gemma-4-31b-it:free"],
      score: ["openrouter/free", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "openai/gpt-oss-120b:free"],
    },
  },
};

const defaultState = {
  selectedId: "demo-casa-i08",
  editorMode: "edit",
  draftProperty: null,
  clientView: "grid",
  searchMode: "ai",
  recentSearches: [],
  favoriteIds: [],
  editorTab: "data",
  aiSearchIds: null,
  aiSearchExplanation: "",
  chatMessages: [
    {
      role: "assistant",
      content: "Contame presupuesto, tipo de propiedad, rutina diaria, si tenes hijos, donde trabajas y que valoras mas: seguridad, colegios, verde, vida social, playa o conexion. Con eso te recomiendo zonas y tradeoffs.",
    },
  ],
  properties: [
    {
      id: "demo-casa-i08",
      title: "Casa I08 - Colinas de Carrasco",
      type: "Casa",
      status: "published",
      price: 398000,
      neighborhood: "Colinas de Carrasco",
      city: "Canelones",
      address: "Colinas de Carrasco",
      lat: -34.8339,
      lng: -56.0308,
      bedrooms: 4,
      bathrooms: 3.5,
      suites: 2,
      parking: 2,
      landArea: 1496,
      builtArea: 188,
      semiArea: 78.5,
      yearBuilt: "",
      architect: "Daniel Fernandez Arquitectos",
      commonFees: "",
      uteAvg: "",
      oseAvg: "",
      antelAvg: "",
      contribucionAnnual: "",
      primariaAnnual: "",
      insuranceAvg: "",
      description: "Casa owner-direct con ficha tecnica, fotos, planos y score IA.",
      rooms: [
        room("suite-principal", "Dormitorio principal", "Dormitorio", "PB", 18, "Suite principal + walking closet"),
        room("banio-suite", "Bano suite principal", "Bano", "PB", 4.9, "Bano completo con vanitory doble"),
        room("cocina", "Cocina + isla", "Cocina", "PB", 18.5, "Open plan integrada"),
        room("living-comedor", "Living + comedor", "Living", "PB", 53, "Sector social abierto"),
      ],
      photos: [],
      videos: [],
      plans: [],
      documents: [],
      extras: [],
      report: null,
      score: null,
      analysis: null,
      chatMessages: null,
    },
  ],
};

let state = loadState();
let settings = loadSettings();
let aiModelConfig = loadAiModelConfig();
let authSession = loadAuthSession();
let serverConfig = {};
let remoteSaveTimer = null;
let loadingRemote = false;
let initialLoadComplete = false;
let aiSearchDebounceTimer = null;
let aiSearchImageDataUrl = "";
let leafletMap = null;
let leafletMarkerLayer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function room(id, name, type, floor, area, notes) {
  return { id, name, type, floor, area, notes, score: null, confirmed: true };
}

function loadState() {
  try {
    return migrateState(JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(defaultState));
  } catch {
    return migrateState(structuredClone(defaultState));
  }
}

function migrateState(nextState) {
  nextState.properties = nextState.properties || [];
  nextState.clientView ||= "grid";
  nextState.searchMode ||= "ai";
  nextState.recentSearches ??= [];
  nextState.favoriteIds ??= [];
  nextState.editorTab ||= "data";
  nextState.aiSearchIds ??= null;
  nextState.aiSearchExplanation ??= "";
  nextState.editorMode ||= "edit";
  if (nextState.draftProperty) ensurePropertyDefaults(nextState.draftProperty);
  nextState.properties.forEach((property) => ensurePropertyDefaults(property));
  if (!nextState.selectedId && nextState.properties[0]) nextState.selectedId = nextState.properties[0].id;
  return nextState;
}

function ensurePropertyDefaults(property) {
  property.ownerId ??= "";
  property.ownerEmail ??= "";
  property.address ??= "";
  property.lat ??= "";
  property.lng ??= "";
  property.mapUrl ??= "";
  property.uteAvg ??= "";
  property.oseAvg ??= "";
  property.antelAvg ??= "";
  property.contribucionAnnual ??= "";
  property.primariaAnnual ??= "";
  property.insuranceAvg ??= "";
  property.documents ??= [];
  property.extras ??= [];
  property.report ??= null;
  property.scrapeReview ??= null;
  property.chatMessages ??= null;
  property.rooms ??= [];
  property.photos ??= [];
  property.videos ??= [];
  property.plans ??= [];
}

function loadSettings() {
  try {
    const next = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    if (!next.model) next.model = DEFAULT_MODEL;
    if (!next.planModel) next.planModel = next.model;
    return next;
  } catch {
    return { model: DEFAULT_MODEL, planModel: DEFAULT_MODEL };
  }
}

function defaultAiModelConfig(profile = "balanced") {
  const base = MODEL_PROFILES[profile] || MODEL_PROFILES.balanced;
  const functions = {};
  Object.keys(AI_FUNCTIONS).forEach((key) => {
    const queue = base.functions[key] || [DEFAULT_MODEL];
    functions[key] = {
      activeModel: queue[0] || DEFAULT_MODEL,
      fallbacks: queue.slice(1),
      lastSuccessfulModel: "",
      lastSuccessAt: "",
      status: "unknown",
      averageMs: null,
    };
  });
  return { profile, functions };
}

function loadAiModelConfig() {
  try {
    return normalizeAiModelConfig(JSON.parse(localStorage.getItem(AI_CONFIG_KEY)));
  } catch {
    return defaultAiModelConfig();
  }
}

function normalizeAiModelConfig(config) {
  const fallback = defaultAiModelConfig(config?.profile || "balanced");
  const next = config && typeof config === "object" ? config : fallback;
  const result = { profile: next.profile || fallback.profile, functions: {} };
  Object.keys(AI_FUNCTIONS).forEach((key) => {
    const item = next.functions?.[key] || fallback.functions[key];
    const activeModel = normalizeModelName(item.activeModel || fallback.functions[key].activeModel);
    result.functions[key] = {
      activeModel,
      fallbacks: uniqueStrings(Array.isArray(item.fallbacks) ? item.fallbacks.map(normalizeModelName) : fallback.functions[key].fallbacks).filter((model) => model !== activeModel),
      lastSuccessfulModel: item.lastSuccessfulModel || "",
      lastSuccessAt: item.lastSuccessAt || "",
      status: item.status || "unknown",
      averageMs: item.averageMs || null,
    };
  });
  return result;
}

function normalizeModelName(model = "") {
  const value = String(model || "").trim();
  if (!value) return DEFAULT_MODEL;
  if (value === "minimax/minimax-m2.5-20260211:free") return "openrouter/free";
  return value;
}

function saveAiModelConfig({ remote = true } = {}) {
  aiModelConfig = normalizeAiModelConfig(aiModelConfig);
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(aiModelConfig));
  if (remote) syncAiConfigRemote();
  renderSettings();
}

function loadAuthSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY)) || null;
  } catch {
    return null;
  }
}

function saveAuthSession(session) {
  authSession = session;
  if (session) localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  else localStorage.removeItem(AUTH_KEY);
}

function currentUser() {
  return authSession?.user || null;
}

function currentRole() {
  return currentUser()?.role || "anonymous";
}

function canManageProperties() {
  return ["admin", "vendedor"].includes(currentRole());
}

function canAccessView(view) {
  if (view === "marketplace") return true;
  if (view === "settings") return currentRole() === "admin";
  return canManageProperties();
}

function propertyOwnedByCurrentUser(property) {
  const user = currentUser();
  if (!user) return false;
  if (user.role === "admin") return true;
  return property.ownerId === user.id || property.ownerEmail === user.email;
}

function backofficeProperties() {
  if (currentRole() === "admin") return state.properties;
  if (currentRole() === "vendedor") return state.properties.filter(propertyOwnedByCurrentUser);
  return [];
}

function authHeaders(extra = {}) {
  return {
    ...extra,
    ...(authSession?.access_token ? { Authorization: `Bearer ${authSession.access_token}` } : {}),
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleRemoteSave();
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  renderSettings();
}

function selectedProperty() {
  if (state.editorMode === "create" && state.draftProperty) {
    ensurePropertyDefaults(state.draftProperty);
    return state.draftProperty;
  }
  const property = state.properties.find((item) => item.id === state.selectedId) || state.properties[0];
  if (property) ensurePropertyDefaults(property);
  return property;
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setView(view) {
  if (!canAccessView(view)) {
    view = "marketplace";
    state.editorMode = "edit";
  }
  $$(".view").forEach((element) => element.classList.remove("active"));
  $$(".nav-btn").forEach((element) => element.classList.toggle("active", element.dataset.view === view));
  $(`#view-${view}`).classList.add("active");
  document.body.dataset.view = view;
  $("#pageTitle").textContent = {
    properties: "Propiedades",
    marketplace: "Portal cliente",
    editor: "Cargar propiedad",
    settings: "Admin IA",
  }[view];
  $("#newPropertyBtn").classList.toggle("hidden", view === "marketplace" || !canManageProperties());
  $("#chatBubbleBtn").classList.toggle("hidden", view !== "marketplace");
  if (view !== "marketplace") $("#chatWidget").classList.add("hidden");
  renderAll();
}

function emptyNode() {
  return $("#emptyTemplate").content.firstElementChild.cloneNode(true);
}

function showToast(message) {
  let toast = $("#autosaveToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "autosaveToast";
    toast.className = "autosave-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1300);
}

function setOperationProgress(selector, { title, detail = "", percent = 0, status = "active" } = {}) {
  const element = $(selector);
  if (!element) return;
  const value = Math.max(0, Math.min(100, Number(percent || 0)));
  element.classList.remove("hidden", "done", "error");
  if (status === "done") element.classList.add("done");
  if (status === "error") element.classList.add("error");
  element.style.setProperty("--progress", `${value}%`);
  element.innerHTML = `
    <div class="operation-progress-head">
      <strong>${escapeHtml(title || "Procesando...")}</strong>
      <span>${value}%</span>
    </div>
    <div class="operation-progress-track"><div class="operation-progress-bar"></div></div>
    ${detail ? `<p class="operation-progress-detail">${escapeHtml(detail)}</p>` : ""}
  `;
}

function clearOperationProgress(selector) {
  const element = $(selector);
  if (!element) return;
  element.classList.add("hidden");
  element.innerHTML = "";
}

function formatUsd(value) {
  if (!value) return "USD --";
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function pricePerM2(property) {
  const price = Number(property.price || 0);
  const built = builtAreaForValue(property);
  return price && built ? Math.round(price / built) : null;
}

function builtAreaForValue(property) {
  const direct = Number(property.builtArea || 0);
  if (direct) return direct;
  return numberFromExtra(property, [
    "m² edificados",
    "m2 edificados",
    "área privada",
    "area privada",
    "superficie cubierta",
    "cubiertos",
    "edificados",
  ]);
}

function numberFromExtra(property, labels) {
  const targetLabels = labels.map(normalizeText);
  const extra = (property.extras || []).find((item) => targetLabels.includes(normalizeText(item.label)));
  if (!extra) return 0;
  const match = String(extra.value || "").replace(/\./g, "").replace(",", ".").match(/[0-9]+(?:\.[0-9]+)?/);
  return match ? Number(match[0]) : 0;
}

function normalizeText(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function pricePerM2Label(property) {
  const value = pricePerM2(property);
  const built = builtAreaForValue(property);
  return value ? `USD ${value.toLocaleString("es-UY")} / m² edificado (${built.toLocaleString("es-UY")} m²)` : "USD/m² pendiente";
}

function scoreDial(score, size = "mini") {
  const value = Number(score || 0);
  if (!value) return "";
  const radius = size === "large" ? 34 : 13;
  const stroke = size === "large" ? 7 : 4;
  const box = (radius + stroke) * 2;
  const dash = Math.max(0, Math.min(1, value / 10));
  return `
    <span class="score-dial ${size}" title="Score OD: ${value.toFixed(1)} sobre 10">
      <svg viewBox="0 0 ${box} ${box}" aria-hidden="true">
        <circle class="track" cx="${box / 2}" cy="${box / 2}" r="${radius}"></circle>
        <circle class="value" cx="${box / 2}" cy="${box / 2}" r="${radius}" pathLength="1" style="stroke-dasharray:${dash} 1"></circle>
      </svg>
      <strong>${value.toFixed(1)}</strong>
    </span>
  `;
}

function statusText(status) {
  return { draft: "Borrador", review: "En revision", published: "Publicada" }[status] || status;
}

function propertyCompleteness(property) {
  const missing = missingFields(property);
  const coreChecks = [
    property.title,
    property.price,
    property.neighborhood,
    property.city,
    property.bedrooms !== "",
    property.bathrooms !== "",
    builtAreaForValue(property),
    property.photos.length >= 8,
    property.score || property.analysis,
    verifiedDocumentTypes(property).length || property.uteAvg || property.oseAvg || property.commonFees,
  ];
  const completed = coreChecks.filter(Boolean).length;
  return {
    percent: Math.round((completed / coreChecks.length) * 100),
    missing,
    photosOk: property.photos.length >= 8,
    dataOk: Boolean(property.title && property.price && property.neighborhood && property.city && builtAreaForValue(property)),
    analysisOk: Boolean(property.score || property.analysis),
    docsOk: Boolean(verifiedDocumentTypes(property).length || property.uteAvg || property.oseAvg || property.commonFees),
  };
}

function listingCompleteness(property) {
  const hasCosts = Number(property.uteAvg) > 0 || Number(property.oseAvg) > 0 || Number(property.commonFees) > 0;
  const hasAmenities = (property.extras || []).some((e) => e.label && e.value);
  const hasRoomDescriptions = (property.rooms || []).some((r) => r.notes && String(r.notes).trim());
  const hasLegalDocs = (property.documents || []).length > 0;
  const checks = [
    { label: "Foto principal", weight: 15, done: (property.photos || []).length >= 1, icon: "📷", why: "Sin foto principal tu listing no aparece en búsquedas", tab: "media" },
    { label: "Precio USD", weight: 15, done: Number(property.price) > 0, icon: "💵", why: "El precio es el primer filtro de búsqueda del comprador", tab: "data" },
    { label: "m² cubiertos", weight: 15, done: Boolean(builtAreaForValue(property)), icon: "📐", why: "El precio por m² es la métrica clave para comparar propiedades", tab: "data" },
    { label: "Dormitorios y baños", weight: 15, done: Number(property.bedrooms) > 0 && property.bathrooms !== "" && property.bathrooms !== null, icon: "🛏", why: "El primer filtro que usan los compradores al buscar", tab: "data" },
    { label: "Agregá 6 fotos o más", weight: 8, done: (property.photos || []).length >= 6, icon: "🖼", why: "Los listings con 10+ fotos reciben 3× más consultas", tab: "media" },
    { label: "Costos mensuales (UTE, OSE, gastos)", weight: 8, done: hasCosts, icon: "💰", why: "Los compradores lo exigen antes de visitar", tab: "data" },
    { label: "Amenities (parrillero, pileta, cochera…)", weight: 8, done: hasAmenities, icon: "✅", why: "Filtran a compradores calificados con ese requisito", tab: "data" },
    { label: "Plano subido", weight: 8, done: (property.plans || []).length >= 1, icon: "🏠", why: "Aumenta los guardados en un 30%", tab: "media" },
    { label: "Descripción por ambiente", weight: 4, done: hasRoomDescriptions, icon: "📝", why: "Los compradores comparan ambientes antes de visitar", tab: "data" },
    { label: "Datos legales o documentos", weight: 4, done: hasLegalDocs, icon: "📋", why: "Genera confianza en compradores con financiamiento", tab: "data" },
    { label: "Año de construcción", weight: 4, done: Boolean(property.yearBuilt), icon: "🏗", why: "Permite comparar con el mercado por antigüedad", tab: "data" },
    { label: "Arquitecto / estudio", weight: 4, done: Boolean(property.architect && String(property.architect).trim()), icon: "🏛", why: "Las propiedades firmadas por estudios reconocidos se valorizan más", tab: "data" },
  ];
  const earned = checks.reduce((sum, c) => sum + (c.done ? c.weight : 0), 0);
  const score = Math.min(100, earned);
  const missing = checks.filter((c) => !c.done).sort((a, b) => b.weight - a.weight);
  return { score, checks, missing };
}

function costCompleteness(property) {
  const fields = [property.uteAvg, property.oseAvg, property.antelAvg, property.contribucionAnnual, property.primariaAnnual, property.insuranceAvg];
  const filled = fields.filter((v) => v !== "" && v !== null && v !== undefined && Number(v) > 0).length;
  return filled / fields.length;
}

function renderAll() {
  renderAuth();
  renderSettings();
  renderMarketplace();
  renderBackofficeDashboard();
  renderProperties();
  renderForm();
  renderRooms();
  renderPhotos();
  renderPlans();
  renderScore();
  renderChat();
  renderDocuments();
  renderReport();
  renderEditorTabs();
  renderEditorProgress();
  renderPublishChecklist();
  renderWizardControls();
  renderSellerCompleteness();
  renderCostsBanner();
  renderActivePropertySelectors();
}

function renderAuth() {
  const user = currentUser();
  const roleLabel = {
    admin: "Admin",
    vendedor: "Vendedor",
    user: "Cliente",
    anonymous: "Visitante",
  }[currentRole()] || "Visitante";
  const status = $("#authStatus");
  if (status) status.textContent = user ? `${roleLabel}: ${user.email}` : "Portal público";
  const topRoleNav = $("#topRoleNav");
  if (topRoleNav) {
    const items = [
      { view: "marketplace", label: "Portal" },
      ...(canManageProperties() ? [
        { view: "properties", label: "Backoffice" },
        { view: "editor", label: "Cargar" },
      ] : []),
      ...(currentRole() === "admin" ? [{ view: "settings", label: "Admin IA" }] : []),
    ];
    topRoleNav.innerHTML = items.map((item) => `
      <button type="button" data-top-view="${item.view}" class="${$(`#view-${item.view}`)?.classList.contains("active") ? "active" : ""}">${item.label}</button>
    `).join("");
  }
  const marketplaceActive = $("#view-marketplace")?.classList.contains("active");
  $("#aiStatus")?.classList.toggle("hidden", marketplaceActive || currentRole() !== "admin");
  status?.classList.toggle("hidden", marketplaceActive);
  $(".sidebar-card")?.classList.toggle("hidden", currentRole() !== "admin");
  $("#loginBtn")?.classList.toggle("hidden", Boolean(user));
  $("#logoutBtn")?.classList.toggle("hidden", !user);
  $$(".nav-btn").forEach((button) => {
    button.classList.toggle("hidden", !canAccessView(button.dataset.view));
  });
  $("#newPropertyBtn")?.classList.toggle("hidden", !canManageProperties() || $("#view-marketplace")?.classList.contains("active"));
  const sidebarText = $("#storageModeText");
  if (sidebarText) {
    sidebarText.textContent = serverConfig.supabaseConfigured
      ? "Las propiedades se sincronizan con Supabase por usuario."
      : "Modo demo local: login y propiedades viven en este navegador.";
  }
}

async function loginWithCredentials(email, password) {
  const response = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "No se pudo iniciar sesión.");
  saveAuthSession(data);
  await loadRemoteProperties();
  renderAll();
}

async function logout() {
  saveAuthSession(null);
  state.editorMode = "edit";
  state.draftProperty = null;
  if (serverConfig.supabaseConfigured) await loadRemoteProperties();
  setView("marketplace");
}

function renderSettings() {
  $("#apiKeyInput").value = settings.apiKey || "";
  const profile = $("#modelProfileSelect");
  if (profile) profile.value = aiModelConfig.profile || "balanced";
  const configured = Boolean(settings.apiKey || serverConfig.openRouterConfigured);
  $("#aiStatus").textContent = configured ? (settings.apiKey ? "OpenRouter configurado" : "OpenRouter en servidor") : "OpenRouter sin configurar";
  $("#aiStatus").className = configured ? "status-pill" : "status-pill warn";
  renderModelManager();
  renderAiUsage();
}

function renderModelManager() {
  const summary = $("#modelSummaryGrid");
  const grid = $("#modelManagerGrid");
  if (!summary || !grid) return;
  const systemStatus = Object.values(aiModelConfig.functions || {}).some((item) => item.status === "failed")
    ? "error"
    : Object.values(aiModelConfig.functions || {}).some((item) => item.status === "fallback")
      ? "fallback"
      : "ok";
  summary.innerHTML = `
    <div class="model-summary-card system ${systemStatus}">
      <span class="model-status ${systemStatus === "ok" ? "ok" : systemStatus === "fallback" ? "warn" : "bad"}">${systemStatus === "ok" ? "Sistema OK" : systemStatus === "fallback" ? "Fallback activo" : "Revisar IA"}</span>
      <strong>Routing IA</strong>
      <small>${serverConfig.openRouterConfigured ? "Server key configurada" : "Server key pendiente"}</small>
      <em>${settings.apiKey ? "Override del browser activo" : `Storage: ${escapeHtml(serverConfig.aiRoutingStorage || "auto")}`}</em>
    </div>
    ${Object.entries(AI_FUNCTIONS).map(([key, info]) => {
    const item = aiModelConfig.functions[key];
    return `
      <div class="model-summary-card">
        <span class="model-status ${statusClass(item.status)}">${statusTextModel(item.status)}</span>
        <strong>${escapeHtml(info.label)}</strong>
        <small>${escapeHtml(item.activeModel)}</small>
        <em>${item.averageMs ? `${Math.round(item.averageMs)} ms promedio` : "Sin telemetría"}</em>
      </div>
    `;
  }).join("")}`;

  grid.innerHTML = Object.entries(AI_FUNCTIONS).map(([key, info]) => {
    const item = aiModelConfig.functions[key];
    const queue = uniqueStrings([item.activeModel, ...(item.fallbacks || []), ...MODEL_PRESETS]);
    const fallbackRows = (item.fallbacks || []).map((model, index) => `
      <div class="fallback-row" draggable="true" data-fallback-index="${index}" data-fallback-function="${key}">
        <span>${index + 1}</span>
        <code>${escapeHtml(model)}</code>
        <button data-remove-fallback="${key}" data-model="${escapeAttr(model)}">Quitar</button>
      </div>
    `).join("");
    return `
      <article class="model-manager-card" data-function="${key}">
        <div class="model-card-head">
          <div>
            <p class="eyebrow">${escapeHtml(key)}</p>
            <h3>${escapeHtml(info.label)}</h3>
            <span>${escapeHtml(info.help)}</span>
          </div>
          <span class="model-status ${statusClass(item.status)}">${statusTextModel(item.status)}</span>
        </div>
        <div class="model-traits">
          <span>Velocidad: ${escapeHtml(info.speed)}</span>
          <span>Calidad: ${escapeHtml(info.quality)}</span>
        </div>
        <label>Modelo activo
          <select data-ai-active-model="${key}">
            ${queue.map((model) => `<option value="${escapeAttr(model)}" ${model === item.activeModel ? "selected" : ""}>${escapeHtml(model)}</option>`).join("")}
          </select>
        </label>
        <label>Custom / agregar a fallback
          <div class="inline-control">
            <input data-ai-custom-model="${key}" placeholder="provider/model-name" />
            <button data-add-fallback="${key}">Agregar</button>
          </div>
        </label>
        <div class="fallback-list">
          <strong>Fallback queue</strong>
          ${fallbackRows || `<span class="muted-light">Sin fallbacks configurados</span>`}
        </div>
        <div class="model-meta">
          <span>Último OK: ${escapeHtml(item.lastSuccessAt ? new Date(item.lastSuccessAt).toLocaleString("es-UY") : "pendiente")}</span>
          <span>Router/modelo: ${escapeHtml(item.lastSuccessfulModel || item.activeModel || "pendiente")}</span>
        </div>
        <button class="primary" data-test-model="${key}">Test Now</button>
      </article>
    `;
  }).join("");
}

function loadAiUsage() {
  try {
    return JSON.parse(localStorage.getItem(AI_USAGE_KEY)) || { total: 0, byFunction: {}, last: null };
  } catch {
    return { total: 0, byFunction: {}, last: null };
  }
}

function recordAiUsage(functionType, meta = {}) {
  const usage = loadAiUsage();
  usage.total = Number(usage.total || 0) + 1;
  usage.byFunction ||= {};
  usage.byFunction[functionType] ||= { count: 0, totalMs: 0 };
  usage.byFunction[functionType].count += 1;
  usage.byFunction[functionType].totalMs += Number(meta.durationMs || 0);
  usage.last = {
    functionType,
    usedModel: meta.usedModel || modelForFunction(functionType),
    fallbackUsed: Boolean(meta.fallbackUsed),
    durationMs: Number(meta.durationMs || 0),
    at: new Date().toISOString(),
  };
  localStorage.setItem(AI_USAGE_KEY, JSON.stringify(usage));
  renderAiUsage();
}

function renderAiUsage() {
  const panel = $("#aiUsagePanel");
  if (!panel) return;
  const usage = loadAiUsage();
  const rows = Object.entries(AI_FUNCTIONS).map(([key, info]) => {
    const item = usage.byFunction?.[key] || { count: 0, totalMs: 0 };
    const avg = item.count ? Math.round(item.totalMs / item.count) : 0;
    return `
      <div>
        <strong>${escapeHtml(info.label)}</strong>
        <span>${item.count} usos</span>
        <em>${avg ? `${avg} ms promedio` : "sin datos"}</em>
      </div>
    `;
  }).join("");
  panel.innerHTML = `
    <div class="ai-usage-head">
      <div>
        <p class="eyebrow">Uso IA</p>
        <h3>Telemetría local</h3>
      </div>
      <span class="status-pill">${Number(usage.total || 0)} operaciones</span>
    </div>
    <div class="ai-usage-grid">${rows}</div>
    ${usage.last ? `<p class="ai-usage-last">Último uso: ${escapeHtml(AI_FUNCTIONS[usage.last.functionType]?.label || usage.last.functionType)} con ${escapeHtml(usage.last.usedModel)}${usage.last.fallbackUsed ? " (fallback)" : ""}.</p>` : ""}
  `;
}

function statusTextModel(status) {
  return { active: "Activo", testing: "Probando", failed: "Falló", fallback: "Fallback activo", unknown: "Sin probar" }[status] || "Sin probar";
}

function statusClass(status) {
  return { active: "ok", testing: "testing", failed: "bad", fallback: "warn" }[status] || "neutral";
}

function apiUrl(path) {
  return location.protocol === "file:" ? `${LOCAL_API_BASE}${path}` : path;
}

async function loadServerConfig() {
  try {
    const response = await fetch(apiUrl("/api/config"));
    if (response.ok) serverConfig = await response.json();
  } catch {
    serverConfig = {};
  }
  await validateAuthSession();
  renderSettings();
  await loadRemoteAiConfig();
  await loadRemoteProperties();
  initialLoadComplete = true;
  renderMarketplace();
}

async function loadRemoteAiConfig() {
  try {
    const response = await fetch(apiUrl("/api/ai-config"), { headers: authHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    if (data.config) {
      aiModelConfig = normalizeAiModelConfig(data.config);
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(aiModelConfig));
      renderSettings();
    }
  } catch (error) {
    console.warn("No se pudo cargar configuración IA", error);
  }
}

async function syncAiConfigRemote() {
  if (!currentUser() || currentRole() !== "admin") return;
  try {
    await fetch(apiUrl("/api/ai-config"), {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config: aiModelConfig }),
    });
  } catch (error) {
    console.warn("No se pudo guardar configuración IA", error);
  }
}

async function validateAuthSession() {
  if (!authSession?.access_token || !serverConfig.authConfigured) return;
  try {
    const response = await fetch(apiUrl("/api/auth/me"), { headers: authHeaders() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.user) saveAuthSession(null);
    else saveAuthSession({ ...authSession, user: data.user });
  } catch {
    saveAuthSession(null);
  }
}

async function loadRemoteProperties() {
  if (!serverConfig.supabaseConfigured) return;
  loadingRemote = true;
  try {
    const response = await fetch(apiUrl("/api/properties"), { headers: authHeaders() });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    if (Array.isArray(data.properties) && data.properties.length) {
      state.properties = data.properties;
      state.properties.forEach(ensurePropertyDefaults);
      state.selectedId = state.properties[0]?.id || state.selectedId;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      initialLoadComplete = true;
      renderAll();
    } else if (state.properties.length && canManageProperties()) {
      await syncRemoteProperties();
    }
  } catch (error) {
    console.warn("No se pudo cargar Supabase", error);
  } finally {
    loadingRemote = false;
    initialLoadComplete = true;
  }
}

function scheduleRemoteSave() {
  if (!serverConfig.supabaseConfigured || loadingRemote || !canManageProperties()) return;
  clearTimeout(remoteSaveTimer);
  remoteSaveTimer = setTimeout(syncRemoteProperties, 650);
}

async function syncRemoteProperties() {
  if (!serverConfig.supabaseConfigured || !canManageProperties()) return;
  try {
    await fetch(apiUrl("/api/properties"), {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ properties: manageablePropertiesForSync() }),
    });
  } catch (error) {
    console.warn("No se pudo guardar en Supabase", error);
  }
}

function manageablePropertiesForSync() {
  if (currentRole() === "admin") return state.properties;
  return state.properties.filter(propertyOwnedByCurrentUser);
}

function renderBackofficeDashboard() {
  const dashboard = $("#backofficeDashboard");
  if (!dashboard) return;
  const properties = backofficeProperties();
  const published = properties.filter((property) => property.status === "published").length;
  const drafts = properties.filter((property) => property.status !== "published").length;
  const scored = properties.filter((property) => Number(property.score || 0) > 0);
  const avgScore = scored.length ? (scored.reduce((sum, property) => sum + Number(property.score || 0), 0) / scored.length).toFixed(1) : "--";
  const avgCompletion = properties.length
    ? Math.round(properties.reduce((sum, property) => sum + propertyCompleteness(property).percent, 0) / properties.length)
    : 0;
  const smartActions = properties.flatMap((property) => {
    const complete = propertyCompleteness(property);
    const actions = [];
    if (!complete.docsOk) actions.push({ level: "warn", text: `"${property.title || "Propiedad"}" necesita costos/documentos verificables.` });
    if (property.photos.length < 8) actions.push({ level: "warn", text: `"${property.title || "Propiedad"}" tiene ${property.photos.length} fotos; recomendadas 8+.` });
    if (!complete.analysisOk) actions.push({ level: "info", text: `"${property.title || "Propiedad"}" todavía no tiene análisis IA.` });
    if (complete.percent >= 80 && property.status !== "published") actions.push({ level: "ok", text: `"${property.title || "Propiedad"}" está lista para publicar.` });
    return actions;
  }).slice(0, 4);

  dashboard.innerHTML = `
    <div class="dashboard-hero">
      <div>
        <p class="eyebrow">Backoffice</p>
        <h2>Mis propiedades</h2>
        <span>${properties.length} fichas cargadas · ${published} publicadas · ${drafts} borradores/revisión</span>
      </div>
      <div class="dashboard-kpis">
        <div><strong>${published}</strong><span>Publicadas</span></div>
        <div><strong>${avgScore}</strong><span>Score promedio</span></div>
        <div><strong>${avgCompletion}%</strong><span>Completitud</span></div>
      </div>
    </div>
    <div class="smart-actions">
      <div class="smart-actions-head">
        <strong>Acciones recomendadas</strong>
        <span>Calidad de publicación</span>
      </div>
      ${smartActions.length ? smartActions.map((action) => `<div class="smart-action ${action.level}">${escapeHtml(action.text)}</div>`).join("") : `<div class="smart-action ok">Todo lo cargado está razonablemente completo.</div>`}
    </div>
  `;
}

function renderProperties() {
  const grid = $("#propertyGrid");
  const query = $("#searchInput").value.trim().toLowerCase();
  const status = $("#statusFilter").value;
  const scoreFilter = $("#scoreFilter")?.value || "all";
  const completionFilter = $("#completionFilter")?.value || "all";
  const properties = backofficeProperties().filter((property) => {
    const haystack = `${property.title} ${property.neighborhood} ${property.city}`.toLowerCase();
    const score = Number(property.score || 0);
    const complete = propertyCompleteness(property);
    const scoreOk = scoreFilter === "all"
      || (scoreFilter === "high" && score > 8)
      || (scoreFilter === "medium" && score >= 5 && score <= 8)
      || (scoreFilter === "low" && score < 5);
    const completionOk = completionFilter === "all"
      || (completionFilter === "complete" && complete.percent >= 80)
      || (completionFilter === "missing" && complete.percent < 80)
      || (completionFilter === "photos" && !complete.photosOk);
    return haystack.includes(query) && (status === "all" || property.status === status) && scoreOk && completionOk;
  });

  grid.innerHTML = "";
  if (!properties.length) {
    grid.appendChild(emptyNode());
    return;
  }

  properties.forEach((property) => {
    const card = document.createElement("article");
    card.className = "property-card";
    const cover = photoSrc(property.photos[0]);
    const score = property.score ? Number(property.score).toFixed(1) : "--";
    const complete = propertyCompleteness(property);
    card.innerHTML = `
      <div class="property-media">${cover ? `<img src="${cover}" alt="">` : "Sin foto principal"}</div>
      <div class="property-body">
        <h3>${escapeHtml(property.title || "Propiedad sin titulo")}</h3>
        <div class="meta">
          <span>${escapeHtml(property.type || "Propiedad")}</span>
          <span>${escapeHtml(property.neighborhood || "Barrio pendiente")}</span>
          <span>${property.bedrooms || 0} dorm.</span>
          <span>${property.bathrooms || 0} banos</span>
        </div>
        <div class="price-row">
          <span>${formatUsd(Number(property.price))}</span>
          <span class="status-pill">${score} OD</span>
        </div>
        <div class="meta" style="margin-top:8px">
          <span>${pricePerM2Label(property)}</span>
        </div>
        <div class="meta" style="margin-top:10px">
          <span>${statusText(property.status)}</span>
          <span>${property.photos.length} fotos</span>
          <span>${property.videos.length} videos</span>
          <span>${property.plans.length} planos</span>
        </div>
        <div class="quality-meter" aria-label="Completitud ${complete.percent}%">
          <span style="width:${complete.percent}%"></span>
        </div>
        <div class="meta quality-meta">
          <span>${complete.percent}% completa</span>
          <span>${complete.missing.slice(0, 2).join(", ") || "Sin pendientes críticos"}</span>
        </div>
        <div class="card-actions">
          ${property.status === "published"
            ? `<button class="published-action" data-unpublish-property="${property.id}">Publicado</button>`
            : `<button class="primary" data-publish-property="${property.id}">Publicar</button>`}
          <button data-edit-property="${property.id}">Editar</button>
          <button data-delete-property="${property.id}">Borrar</button>
        </div>
      </div>
    `;
    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      state.selectedId = property.id;
      state.editorMode = "edit";
      state.draftProperty = null;
      saveState();
      setView("editor");
    });
    grid.appendChild(card);
  });
}

function clientFilteredProperties() {
  const query = $("#clientSearchInput")?.value.trim().toLowerCase() || "";
  const type = $("#clientTypeFilter")?.value || "all";
  const maxPrice = Number($("#clientMaxPriceInput")?.value || 0);
  const minBedrooms = Number($("#clientBedroomsFilter")?.value || 0);
  const source = state.properties.filter((property) => property.status === "published");
  return source.filter((property) => {
    ensurePropertyDefaults(property);
    const haystack = `${property.title} ${property.neighborhood} ${property.city} ${property.description}`.toLowerCase();
    return haystack.includes(query)
      && (type === "all" || property.type === type)
      && (!maxPrice || Number(property.price || 0) <= maxPrice)
      && (Number(property.bedrooms || 0) >= minBedrooms)
      && (!state.aiSearchIds || state.aiSearchIds.includes(property.id));
  });
}

function skeletonCard() {
  const article = document.createElement("article");
  article.className = "property-card public-card skeleton-card";
  article.innerHTML = `
    <div class="property-media"></div>
    <div class="property-body">
      <span class="skeleton-line" style="height:20px;width:75%;margin-bottom:10px"></span>
      <span class="skeleton-line" style="height:16px;width:44%;margin-bottom:10px"></span>
      <span class="skeleton-line" style="height:13px;width:58%;margin-bottom:14px"></span>
      <span class="skeleton-line" style="height:13px;width:80%;margin-bottom:14px"></span>
      <span class="skeleton-line" style="height:36px;width:100%;border-radius:10px"></span>
    </div>
  `;
  return article;
}

function renderMarketplace() {
  const grid = $("#clientPropertyGrid");
  const map = $("#mapCanvas");
  if (!grid || !map) return;
  $("#clientListPane").classList.toggle("hidden", state.clientView === "map");
  $("#clientMapPane").classList.toggle("hidden", state.clientView !== "map");
  $$("[data-client-view]").forEach((button) => button.classList.toggle("active", button.dataset.clientView === state.clientView));
  renderSearchUi();
  const properties = clientFilteredProperties();
  // AI search output — keep in search hero AND show above grid
  const aiOutput = $("#aiSearchOutput");
  const aiSummary = $("#aiResultSummary");
  const publicExplanation = publicAiExplanation(state.aiSearchExplanation);
  if (aiOutput) {
    aiOutput.classList.toggle("hidden", !publicExplanation);
    aiOutput.innerHTML = publicExplanation ? `<strong>Búsqueda IA activa.</strong><br>${escapeHtml(publicExplanation)}` : "";
  }
  if (aiSummary) {
    const showSummary = Boolean(publicExplanation && state.aiSearchIds);
    aiSummary.classList.toggle("hidden", !showSummary);
    aiSummary.textContent = showSummary ? publicExplanation : "";
  }

  // Neighborhood context line
  const ctxEl = $("#neighborhoodContext");
  if (ctxEl) {
    const publishedForCtx = state.properties.filter((p) => p.status === "published");
    const m2List = publishedForCtx.map((p) => pricePerM2(p)).filter(Boolean);
    const avgM2 = m2List.length ? Math.round(m2List.reduce((s, v) => s + v, 0) / m2List.length) : null;
    const count = properties.length;
    ctxEl.textContent = `Colinas de Carrasco · Precio promedio del barrio: ${avgM2 ? `USD ${avgM2.toLocaleString("es-UY")}/m²` : "—"} · ${count} ${count === 1 ? "propiedad disponible" : "propiedades disponibles"}`;
  }

  $("#view-marketplace .client-layout")?.classList.toggle("map-mode", state.clientView === "map");
  grid.classList.toggle("list-mode", state.clientView === "list");
  grid.innerHTML = "";

  if (!initialLoadComplete) {
    for (let i = 0; i < 6; i++) grid.appendChild(skeletonCard());
    return;
  }

  if (!properties.length) {
    const publishedCount = state.properties.filter((property) => property.status === "published").length;
    const empty = emptyNode();
    if (publishedCount) {
      empty.querySelector("strong").textContent = "No encontramos propiedades con esos criterios.";
      empty.querySelector("span").textContent = "Intentá una búsqueda diferente o ampliá los filtros.";
      const clearBtn = document.createElement("button");
      clearBtn.className = "empty-clear-btn";
      clearBtn.textContent = "Modificá tu búsqueda";
      clearBtn.addEventListener("click", clearAiSearch);
      empty.appendChild(clearBtn);
    }
    grid.appendChild(empty);
    renderLeafletMap([]);
    return;
  }

  properties.forEach((property, index) => {
    const card = document.createElement("article");
    const isListMode = state.clientView === "list";
    card.className = `property-card public-card${isListMode ? " list-card" : " animate-in"}`;
    if (!isListMode) card.style.animationDelay = (index * 0.05) + "s";

    const cover = photoSrc(property.photos[0]);
    const scoreNum = Number(property.score);
    const scoreCls = property.score
      ? (scoreNum >= 7.5 ? "score-gold" : scoreNum >= 6 ? "score-amber" : "score-gray")
      : "";
    const statusLabel = { published: "En venta", reserved: "Reservado", sold: "Vendido" }[property.status] || "En venta";
    const statusCls = { published: "status-venta", reserved: "status-reservado", sold: "status-vendido" }[property.status] || "status-venta";
    const photos = property.photos.filter(photoSrc);
    const photoPct = Math.min(100, Math.round(photos.length / 10 * 100));
    const pillCls = photoPct > 80 ? "photo-pill-green" : photoPct >= 50 ? "photo-pill-amber" : "photo-pill-red";

    card.innerHTML = `
      <div class="property-media">
        ${cover ? `<img loading="lazy" src="${cover}" alt="${escapeAttr(property.title || "Propiedad")}">` : ""}
        <span class="card-badge-status ${statusCls}">${escapeHtml(statusLabel)}</span>
        ${property.score ? `<span class="card-badge-score ${scoreCls}">${scoreNum.toFixed(1)}★</span>` : ""}
      </div>
      <div class="property-body">
        <h3>${escapeHtml(property.title || "Propiedad sin titulo")}</h3>
        <p class="card-neighborhood">${escapeHtml(property.neighborhood || "")}, ${escapeHtml(property.city || "Uruguay")}</p>
        <strong class="public-price">${formatUsd(Number(property.price))}</strong>
        <p class="card-usd-m2">${pricePerM2Label(property)}</p>
        <div class="card-stats-row">
          <span>${property.bedrooms || 0} dorm.</span>
          <span>${property.bathrooms || 0} baños</span>
          <span>${builtAreaForValue(property) || "--"} m²</span>
          ${property.landArea ? `<span>${property.landArea} m² terreno</span>` : ""}
        </div>
        <div class="card-footer-row">
          <span class="photo-pill ${pillCls}">${photoPct}% fotos</span>
        </div>
      </div>
    `;
    card.addEventListener("click", () => openPropertyModal(property.id));
    grid.appendChild(card);
  });
  renderLeafletMap(properties);

  if (!properties.some((property) => property.id === state.selectedId)) {
    state.selectedId = properties[0].id;
    saveState();
  }
}

function publicAiExplanation(text = "") {
  const clean = String(text || "")
    .replace(/\s*Modelo usado:.*$/i, "")
    .replace(/OpenRouter/gi, "IA")
    .replace(/Falta API key de IA\./gi, "La IA no está configurada todavía.")
    .replace(/\s*\(fallback\)\.?/gi, "")
    .trim();
  if (/No pude usar IA|No endpoints|Failed to fetch|Provider returned|rate-limited|API key|401|402|429|500|502|503|504/i.test(clean)) {
    return "La IA no pudo completar el análisis esta vez. Dejé visibles las propiedades publicadas para que puedas seguir explorando.";
  }
  return clean;
}

function renderSearchUi() {
  $$("[data-search-mode]").forEach((button) => button.classList.toggle("active", button.dataset.searchMode === state.searchMode));
  $("#classicFilters")?.classList.toggle("hidden", state.searchMode !== "filters");
  const queryValue = $("#aiSearchInput")?.value || "";
  if (queryValue || aiSearchImageDataUrl || state.aiSearchIds || state.aiSearchExplanation) setSearchPanelOpen(true);
  const filterCount = activeFilterCount();
  if ($("#activeFilterCount")) $("#activeFilterCount").textContent = filterCount;
  const applied = $("#appliedSearchChips");
  if (applied) {
    const chips = extractedSearchChips(queryValue);
    applied.innerHTML = chips.map((chip) => `<span class="search-chip">${escapeHtml(chip)}</span>`).join("");
  }
  const recent = $("#recentSearches");
  if (recent) {
    recent.innerHTML = state.recentSearches.length
      ? `<span>Búsquedas recientes</span>${state.recentSearches.map((query) => `<button type="button" data-recent-search="${escapeAttr(query)}">${escapeHtml(query)}</button>`).join("")}`
      : "";
  }
  renderSearchImageIdeas();
  $("#refinementChips")?.classList.toggle("hidden", !state.aiSearchIds && !state.aiSearchExplanation);
}

function setSearchPanelOpen(open) {
  $(".ai-search-hero")?.classList.toggle("search-panel-open", Boolean(open));
}

function activeFilterCount() {
  let count = 0;
  if (($("#clientSearchInput")?.value || "").trim()) count += 1;
  if (($("#clientTypeFilter")?.value || "all") !== "all") count += 1;
  if (Number($("#clientMaxPriceInput")?.value || 0)) count += 1;
  if (Number($("#clientBedroomsFilter")?.value || 0)) count += 1;
  return count;
}

function renderSearchImageIdeas() {
  const target = $("#searchImageIdeas");
  if (!target) return;
  const ideas = state.properties
    .filter((property) => property.status === "published" && photoSrc(property.photos[0]))
    .slice(0, 5)
    .map((property) => ({ id: property.id, title: property.title, src: photoSrc(property.photos[0]) }));
  target.innerHTML = `
    ${ideas.map((item) => `
      <button type="button" class="image-idea ${aiSearchImageDataUrl === item.src ? "selected" : ""}" data-search-image-idea="${escapeAttr(item.id)}" title="${escapeAttr(item.title)}">
        <img src="${escapeAttr(item.src)}" alt="${escapeAttr(item.title)}">
      </button>
    `).join("")}
    <label class="image-idea-upload" title="Subir imagen">
      + IMG
      <input id="aiSearchImageInputMirror" type="file" accept="image/*" hidden>
    </label>
  `;
}

function extractedSearchChips(query) {
  const value = normalizeText(query);
  const chips = [];
  if (value.includes("casa")) chips.push("Casa");
  if (value.includes("apartamento") || value.includes("depto")) chips.push("Apartamento");
  if (value.includes("jardin")) chips.push("Jardín");
  if (value.includes("piscina") || value.includes("pileta")) chips.push("Piscina");
  if (value.includes("familia") || value.includes("colegio")) chips.push("Familia");
  if (value.includes("terraza")) chips.push("Terraza");
  if (value.includes("carrasco")) chips.push("Carrasco");
  if (value.includes("pocitos")) chips.push("Pocitos");
  return chips.slice(0, 6);
}

function propertyBadges(property) {
  const badges = [];
  const currentYear = new Date().getFullYear();
  if (Number(property.yearBuilt) && Number(property.yearBuilt) >= currentYear - 2) badges.push({ label: "Estrenar", kind: "new" });
  if (property.score && Number(property.score) >= 8) badges.push({ label: "Score Alto", kind: "score" });
  if (property.analysis || property.score) badges.push({ label: "Análisis IA", kind: "ai" });
  if (verifiedDocumentTypes(property).length >= 3) badges.push({ label: "Docs OK", kind: "docs" });
  const usdM2 = pricePerM2(property);
  if (usdM2 && usdM2 < 2200) badges.push({ label: "Oportunidad", kind: "deal" });
  if (!badges.length) badges.push({ label: "Nueva", kind: "new" });
  return badges.slice(0, 3);
}

function rememberSearch(query) {
  const value = query.trim();
  if (!value) return;
  state.recentSearches = uniqueStrings([value, ...(state.recentSearches || [])]).slice(0, 5);
}

function renderEditorTabs() {
  if (!["import", "data", "media", "analysis", "publish"].includes(state.editorTab)) state.editorTab = "import";
  $$("[data-editor-tab]").forEach((button) => button.classList.toggle("active", button.dataset.editorTab === state.editorTab));
  $$(".import-step").forEach((panel) => panel.classList.toggle("hidden", state.editorTab !== "import"));
  $$(".data-step, .rooms-step").forEach((panel) => panel.classList.toggle("hidden", state.editorTab !== "data"));
  $$(".media-step").forEach((panel) => panel.classList.toggle("hidden", state.editorTab !== "media"));
  $$(".analysis-step").forEach((panel) => panel.classList.toggle("hidden", state.editorTab !== "analysis"));
  $$(".publish-step").forEach((panel) => panel.classList.toggle("hidden", state.editorTab !== "publish"));
}

function renderEditorProgress() {
  const el = $("#editorProgress");
  const property = selectedProperty();
  if (!el || !property) return;
  const complete = propertyCompleteness(property);
  const listScore = listingCompleteness(property).score;
  const steps = [
    { label: "Importar", tab: "import", done: Boolean(property.sourceUrl || state.editorMode === "edit"), active: state.editorTab === "import" },
    { label: "Datos básicos", tab: "data", done: complete.dataOk, active: state.editorTab === "data" },
    { label: "Fotos", tab: "media", done: complete.photosOk, active: state.editorTab === "media" },
    { label: "Análisis", tab: "analysis", done: complete.analysisOk, active: state.editorTab === "analysis" },
    { label: "Publicar", tab: "publish", done: property.status === "published", active: state.editorTab === "publish" },
  ];
  el.innerHTML = `
    <div class="editor-progress-head">
      <strong>${escapeHtml(property.title || "Nueva propiedad")}</strong>
      <span>${listScore}% completa</span>
    </div>
    <div class="progress-rail">
      ${steps.map((step, index) => `
        <button class="progress-step ${step.done ? "done" : ""} ${step.active ? "active" : ""}" data-progress-tab="${step.tab}" type="button">
          <span>${step.done ? "✓" : index + 1}</span>
          ${escapeHtml(step.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function renderSellerCompleteness() {
  const el = $("#sellerCompleteness");
  const property = selectedProperty();
  if (!el) return;
  if (!property || !canManageProperties()) { el.innerHTML = ""; return; }
  const { score, missing } = listingCompleteness(property);
  const [label, colorVar] =
    score < 50 ? ["Tu listing no está listo para publicar", "var(--red)"] :
    score < 75 ? ["Buen comienzo — completá los datos clave", "var(--warning)"] :
    score < 90 ? ["Casi listo — unos detalles más", "var(--warning)"] :
               ["Listing completo — listo para publicar", "var(--green)"];
  el.innerHTML = `
    <div class="seller-completeness-panel">
      <div class="completeness-header">
        <div class="completeness-title-row">
          <span class="completeness-label" style="color:${colorVar}">${escapeHtml(label)}</span>
          <strong class="completeness-pct" style="color:${colorVar}">${score}%</strong>
        </div>
        <div class="completeness-track">
          <div class="completeness-fill" style="width:${score}%;background:${colorVar}"></div>
        </div>
      </div>
      ${missing.length ? `
        <div class="completeness-checklist">
          ${missing.slice(0, 6).map((item) => `
            <div class="completeness-item ${item.weight >= 15 ? "item-critical" : item.weight >= 8 ? "item-important" : "item-nice"}">
              <span class="item-icon">${item.icon}</span>
              <div class="item-body">
                <strong>${escapeHtml(item.label)}</strong>
                <span>${escapeHtml(item.why)}</span>
              </div>
              <span class="item-gain">+${item.weight}%</span>
            </div>
          `).join("")}
        </div>
      ` : `<p class="completeness-done">✓ Todos los datos recomendados están completos.</p>`}
    </div>
  `;
}

function renderCostsBanner() {
  const banner = $("#costsBanner");
  const property = selectedProperty();
  if (!banner || !property) return;
  banner.classList.toggle("hidden", costCompleteness(property) >= 0.6);
}

function renderPublishChecklist() {
  const el = $("#publishChecklist");
  const property = selectedProperty();
  if (!el || !property) return;
  const complete = propertyCompleteness(property);
  const rows = [
    ["Datos básicos completos", complete.dataOk],
    ["Al menos 8 fotos", complete.photosOk],
    ["Score o análisis IA", complete.analysisOk],
    ["Costos/documentos cargados", complete.docsOk],
    ["Publicada en portal cliente", property.status === "published"],
  ];
  el.innerHTML = `
    <div class="checklist-head">
      <div>
        <p class="eyebrow">Revisión final</p>
        <h3>Checklist de publicación</h3>
      </div>
      <span class="status-pill ${complete.percent >= 80 ? "" : "warn"}">${complete.percent}% completa</span>
    </div>
    <div class="checklist-grid">
      ${rows.map(([label, done]) => `<div class="${done ? "done" : "pending"}"><span>${done ? "✓" : "!"}</span>${escapeHtml(label)}</div>`).join("")}
    </div>
    ${complete.missing.length ? `<p class="checklist-missing">Pendientes: ${escapeHtml(complete.missing.slice(0, 6).join(", "))}</p>` : ""}
  `;
}

function renderWizardControls() {
  const el = $("#wizardControls");
  const property = selectedProperty();
  if (!el || !property) return;
  const index = Math.max(0, EDITOR_STEPS.indexOf(state.editorTab));
  const previous = EDITOR_STEPS[index - 1];
  const next = EDITOR_STEPS[index + 1];
  const complete = propertyCompleteness(property);
  const canPublish = complete.percent >= 80 || property.status === "published";
  el.innerHTML = `
    <div class="wizard-controls-meta">
      <strong>Paso ${index + 1} de ${EDITOR_STEPS.length}: ${escapeHtml(EDITOR_STEP_LABELS[state.editorTab] || "Carga")}</strong>
      <span>${stepHelperText(state.editorTab, property, complete)}</span>
    </div>
    <div class="wizard-controls-actions">
      <button type="button" data-wizard-prev ${previous ? "" : "disabled"}>Atrás</button>
      ${next
        ? `<button type="button" class="primary" data-wizard-next>Siguiente</button>`
        : `<button type="button" class="primary" data-wizard-publish ${canPublish ? "" : "disabled"}>${property.status === "published" ? "Publicado" : "Publicar ahora"}</button>`}
    </div>
  `;
}

function stepHelperText(step, property, complete) {
  if (step === "import") return "Importá desde un link o empezá manualmente.";
  if (step === "data") return complete.dataOk ? "Los datos base están completos." : `Te falta: ${complete.missing.slice(0, 3).join(", ") || "datos básicos"}.`;
  if (step === "media") return property.photos.length >= 8 ? `${property.photos.length} fotos cargadas.` : `Subí ${Math.max(0, 8 - property.photos.length)} fotos más para un análisis sólido.`;
  if (step === "analysis") return complete.analysisOk ? "Análisis listo para revisar." : "Corré el análisis IA o ajustá el score manual.";
  return complete.percent >= 80 ? "La ficha está lista para publicar." : "Completá los pendientes antes de publicar.";
}

function goWizard(delta) {
  const index = Math.max(0, EDITOR_STEPS.indexOf(state.editorTab));
  const nextIndex = Math.max(0, Math.min(EDITOR_STEPS.length - 1, index + delta));
  state.editorTab = EDITOR_STEPS[nextIndex];
  saveState();
  renderAll();
  $("#view-editor")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

function renderActivePropertySelectors() {
  ["#activePropertySelect"].forEach((selector) => {
    const select = $(selector);
    if (!select) return;
    const draftOption = state.editorMode === "create" ? `<option value="__draft">Nueva propiedad sin guardar</option>` : "";
    const editable = backofficeProperties();
    select.innerHTML = draftOption + editable.map((property) => `<option value="${property.id}">${escapeHtml(property.title || "Propiedad sin titulo")} · ${escapeHtml(property.neighborhood || "sin barrio")}</option>`).join("");
    select.value = state.editorMode === "create" ? "__draft" : state.selectedId;
  });
}

function renderLeafletMap(properties) {
  const mapEl = $("#mapCanvas");
  if (!mapEl || typeof L === "undefined") {
    renderFallbackMap(properties);
    return;
  }
  if (!leafletMap) {
    leafletMap = L.map(mapEl, {
      center: [-34.9011, -56.1645],
      zoom: 11,
      worldCopyJump: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(leafletMap);
    leafletMarkerLayer = L.layerGroup().addTo(leafletMap);
  }

  leafletMarkerLayer.clearLayers();
  const coords = [];
  properties.forEach((property, index) => {
    const latLng = propertyLatLng(property, index);
    coords.push(latLng);
    const marker = L.marker(latLng).addTo(leafletMarkerLayer);
    marker.bindPopup(`
      <div class="map-popup">
        <strong>${escapeHtml(property.title || "Propiedad")}</strong>
        <div>${escapeHtml(property.neighborhood || property.city || "Montevideo")}</div>
        <div>${formatUsd(Number(property.price))}</div>
        <button onclick="window.selectClientPropertyFromMap('${property.id}')">Ver propiedad</button>
      </div>
    `);
  });

  setTimeout(() => {
    leafletMap.invalidateSize();
    if (state.clientView === "map" && coords.length > 1) {
      leafletMap.fitBounds(coords, { padding: [40, 40], maxZoom: 13 });
    } else if (state.clientView === "map" && coords.length === 1) {
      leafletMap.setView(coords[0], 13);
    } else {
      leafletMap.setView([-34.9011, -56.1645], 11);
    }
  }, 80);
}

function renderFallbackMap(properties) {
  const mapEl = $("#mapCanvas");
  if (!mapEl) return;
  const center = [-34.9011, -56.1645];
  mapEl.innerHTML = `
    <div class="fallback-map">
      <div class="fallback-map-label">
        <strong>Montevideo</strong>
        <span>Vista demo sin tiles externos</span>
      </div>
      ${properties.map((property, index) => {
        const [lat, lng] = propertyLatLng(property, index);
        const x = Math.max(6, Math.min(94, 50 + ((lng - center[1]) * 8)));
        const y = Math.max(6, Math.min(94, 50 - ((lat - center[0]) * 10)));
        return `
          <button class="fallback-pin" style="left:${x}%;top:${y}%" onclick="window.selectClientPropertyFromMap('${property.id}')" title="${escapeAttr(property.title || "Propiedad")}">
            <span>${escapeHtml(property.neighborhood || property.city || "OD")}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function propertyLatLng(property, index = 0) {
  const lat = roundCoord(property.lat);
  const lng = roundCoord(property.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) {
    return [lat, lng];
  }
  const offsets = [
    [0, 0],
    [0.018, 0.025],
    [-0.015, -0.02],
    [0.026, -0.018],
    [-0.024, 0.021],
  ];
  const offset = offsets[index % offsets.length];
  return [-34.9011 + offset[0], -56.1645 + offset[1]];
}

function selectClientProperty(id) {
  state.selectedId = id;
  saveState();
  renderMarketplace();
}

window.selectClientPropertyFromMap = (id) => openPropertyModal(id);

function openPropertyModal(id) {
  state.selectedId = id;
  saveState();
  renderPropertyModal();
  $("#propertyModal").showModal();
}

function renderPropertyModal() {
  const property = state.properties.find((item) => item.id === state.selectedId) || selectedProperty();
  const content = $("#propertyModalContent");
  if (!property || !content) return;

  const MODAL_TABS = ["ficha", "ambientes", "checklist", "datos", "costos"];
  const TAB_LABELS = { ficha: "Ficha", ambientes: "Ambientes", checklist: "Checklist", datos: "Datos", costos: "Costos" };
  const hashTab = location.hash.slice(1);
  const initialTab = MODAL_TABS.includes(hashTab) ? hashTab : "ficha";

  const photos = property.photos.filter((photo) => photoSrc(photo));
  const score = property.score ? Number(property.score).toFixed(1) : "--";
  const docs = verifiedDocumentTypes(property);
  const monthlyCosts = [
    ["UTE", Number(property.uteAvg || 0)],
    ["OSE", Number(property.oseAvg || 0)],
    ["Antel", Number(property.antelAvg || 0)],
    ["Gastos comunes", Number(property.commonFees || 0)],
    ["Seguro hogar", Number(property.insuranceAvg || 0)],
  ].filter(([, v]) => v);
  const monthlyTotal = monthlyCosts.reduce((sum, [, v]) => sum + v, 0);
  const yearlyCosts = [
    ["Contribución", Number(property.contribucionAnnual || 0)],
    ["Primaria", Number(property.primariaAnnual || 0)],
  ].filter(([, v]) => v);

  $("#modalTitle").textContent = property.title || "Propiedad";

  content.innerHTML = `
    <div class="modal-sticky-summary">
      <div>
        <h2>${escapeHtml(property.title || "Propiedad sin titulo")}</h2>
        <span>${escapeHtml(property.neighborhood || "Barrio pendiente")}, ${escapeHtml(property.city || "Uruguay")}</span>
      </div>
      <div class="summary-pills">
        <span>${formatUsd(Number(property.price))}</span>
        ${property.score ? `<span>${scoreDial(property.score)} Score OD</span>` : ""}
        <span>${property.bedrooms || 0} dorm.</span>
        <span>${property.bathrooms || 0} baños</span>
        <span>${builtAreaForValue(property) || "--"} m²</span>
      </div>
    </div>
    <div class="modal-tabs">
      ${MODAL_TABS.map((slug) => `<button class="${slug === initialTab ? "active" : ""}" data-modal-tab="${slug}" type="button">${TAB_LABELS[slug]}</button>`).join("")}
    </div>
    <section class="modal-tab-panel ${initialTab === "ficha" ? "active" : ""}" data-modal-panel="ficha">
      ${renderFichaPanel(property, photos, score)}
    </section>
    <section class="modal-tab-panel ${initialTab === "ambientes" ? "active" : ""}" data-modal-panel="ambientes">
      ${renderAmbientesPanel(property)}
    </section>
    <section class="modal-tab-panel ${initialTab === "checklist" ? "active" : ""}" data-modal-panel="checklist">
      ${renderChecklistPanel(property, photos)}
    </section>
    <section class="modal-tab-panel ${initialTab === "datos" ? "active" : ""}" data-modal-panel="datos">
      ${renderDatosPanel(property)}
    </section>
    <section class="modal-tab-panel ${initialTab === "costos" ? "active" : ""}" data-modal-panel="costos">
      ${renderCostosPanel(property, monthlyCosts, monthlyTotal, yearlyCosts, docs)}
    </section>
  `;

  startScoreBarAnimations(content);
  renderChat();
}

function renderFichaPanel(property, photos, score) {
  const roomsById = new Map((property.rooms || []).map((r) => [r.id, r]));
  const strengths = (property.analysis?.strengths || []).slice(0, 5);
  const warnings = [...(property.analysis?.risks || []), ...(property.analysis?.inconsistencies || [])].slice(0, 5);
  return `
    <div class="modal-gallery modern">
      ${photos.length ? photos.slice(0, 12).map((photo, i) => {
        const room = roomsById.get(photo.roomId);
        return `<figure class="${i === 0 ? "featured" : ""}">
          <img src="${photoSrc(photo)}" alt="${escapeAttr(room?.name || property.title || "Foto")}">
          <figcaption>${escapeHtml(room?.name || photo.name || "Foto de propiedad")}</figcaption>
        </figure>`;
      }).join("") : `<div class="placeholder">Sin fotos cargadas</div>`}
    </div>
    ${property.videos?.length ? `<div class="modal-section"><h3>Videos</h3><div class="video-links">${property.videos.map((url, i) => `<a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">Video ${i + 1}</a>`).join(" ")}</div></div>` : ""}
    ${property.score ? `
      <div class="modal-section score-public">
        <h3>Score OD</h3>
        <div class="score-value">${score}</div>
        ${property.analysis?.summary ? `<p>${escapeHtml(property.analysis.summary)}</p>` : ""}
        ${property.analysis?.categories ? `
          <div class="score-bars">
            ${Object.entries(property.analysis.categories).map(([key, val]) => `
              <div class="bar-row">
                <span>${escapeHtml(labelize(key))}</span>
                <div class="bar bar-score"><div class="bar-fill" data-val="${Math.max(0, Math.min(100, Number(val) * 10))}"></div></div>
                <span>${Number(val).toFixed(1)}</span>
              </div>
            `).join("")}
          </div>
        ` : ""}
        ${(strengths.length || warnings.length) ? `
          <div class="ficha-two-col">
            ${strengths.length ? `<div><h4>Fortalezas</h4><ul>${strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul></div>` : ""}
            ${warnings.length ? `<div><h4>Puntos a considerar</h4><ul>${warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul></div>` : ""}
          </div>
        ` : ""}
      </div>
    ` : `<p class="public-description" style="padding:22px 0">Sin análisis disponible todavía.</p>`}
  `;
}

function renderAmbientesPanel(property) {
  const rooms = property.rooms || [];
  const improvements = property.analysis?.improvements || [];
  const vi = property.analysis?.value_impact;

  const roomCardsHtml = rooms.length ? `
    <div class="room-cards-grid">
      ${rooms.map((room) => {
        const sv = room.score ? Number(room.score) : null;
        const cls = sv === null ? "none" : sv >= 8 ? "hi" : sv >= 6.5 ? "mid" : "lo";
        return `<div class="room-card" data-room-id="${escapeAttr(room.id)}" role="button" tabindex="0">
          <div class="room-card-head">
            <span class="room-card-name">${escapeHtml(room.name)}</span>
            <span class="room-score-bubble score-${cls}" data-room-score="${sv !== null ? sv : ""}">${sv !== null ? "0.0" : "–"}</span>
          </div>
          <div class="room-card-meta">${[room.type, room.floor ? `Planta ${room.floor}` : "", room.area ? `${room.area} m²` : ""].filter(Boolean).join(" · ")}</div>
        </div>`;
      }).join("")}
    </div>
    <div id="roomDetailInline" class="room-detail-panel hidden"></div>
  ` : "";

  const viNote = vi && (vi.estimated_value_delta_usd || vi.estimated_value_delta_percent) ? `
    <div class="potential-note">
      ▲ Impacto estimado con mejoras:
      ${vi.estimated_value_delta_usd ? `<strong>${formatUsd(vi.estimated_value_delta_usd)}</strong>` : ""}
      ${vi.estimated_value_delta_percent ? `<strong>(+${Number(vi.estimated_value_delta_percent).toFixed(0)}%)</strong>` : ""}
      ${vi.notes ? `· ${escapeHtml(vi.notes)}` : ""}
    </div>
  ` : "";

  const mejoras = improvements.length ? `
    <div class="modal-section" style="margin-top:20px">
      <h3>Mejoras sugeridas</h3>
      <div class="mejoras-list">
        ${improvements.map((item) => `<div class="mejora-item">${escapeHtml(item)}</div>`).join("")}
      </div>
      ${viNote}
    </div>
  ` : `<p class="public-description" style="padding-top:16px;padding-bottom:4px">Sin mejoras IA sugeridas todavía.</p>`;

  if (!rooms.length && !improvements.length) {
    return `<p class="public-description" style="padding:22px 0">Sin datos de ambientes disponibles.</p>`;
  }
  return roomCardsHtml + mejoras;
}

function renderChecklistPanel(property, photos) {
  const rooms = property.rooms || [];
  const photosByRoom = new Map();
  photos.forEach((p) => {
    if (p.roomId) {
      if (!photosByRoom.has(p.roomId)) photosByRoom.set(p.roomId, []);
      photosByRoom.get(p.roomId).push(p);
    }
  });

  const roomsWithPhoto = rooms.filter((r) => photosByRoom.has(r.id)).length;
  const completePct = rooms.length > 0 ? Math.round((roomsWithPhoto / rooms.length) * 100) : 0;
  const pctColor = completePct >= 80 ? "var(--green)" : completePct >= 50 ? "var(--gold)" : "var(--red)";

  const infraItems = [
    "Tablero eléctrico",
    "Medidor de agua / pozo",
    "Tanque de agua",
    "Conexiones de servicios (UTE, OSE, Gas)",
    "Planos aprobados",
    "Fachada exterior",
  ];

  const roomRows = rooms.length ? rooms.map((room) => {
    const has = photosByRoom.has(room.id);
    return `<div class="checklist-row">
      <span class="check-icon">${has ? "✅" : "⚠️"}</span>
      <span class="check-label">${escapeHtml(room.name)}${room.area ? ` <span style="color:var(--muted);font-size:11px">· ${room.area} m²</span>` : ""}</span>
      <span class="check-status ${has ? "done" : "pending"}">${has ? "Con foto" : "Pendiente"}</span>
    </div>`;
  }).join("") : `<p class="public-description">Sin ambientes cargados.</p>`;

  const infraRows = infraItems.map((item) => `
    <div class="checklist-row">
      <span class="check-icon">⚠️</span>
      <span class="check-label">${escapeHtml(item)}</span>
      <span class="check-status pending">Pendiente</span>
    </div>
  `).join("");

  return `
    <div class="modal-section">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <h3 style="margin:0">Fotos por ambiente</h3>
        <span style="font-size:13px;font-weight:600;color:${pctColor}">${roomsWithPhoto}/${rooms.length} · ${completePct}%</span>
      </div>
      <div class="checklist-section">${roomRows}</div>
    </div>
    <div class="modal-section">
      <h3>Infraestructura y documentación</h3>
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Ítems bloqueantes para el comprador. Su ausencia reduce conversión.</p>
      <div class="checklist-section">${infraRows}</div>
    </div>
    ${(property.plans?.length) ? `
      <div class="modal-section">
        <h3>Planos</h3>
        <div class="doc-badges">${property.plans.map((_, i) => `<span class="status-pill">Plano ${i + 1}</span>`).join("")}</div>
      </div>
    ` : ""}
  `;
}

function renderDatosPanel(property) {
  return `
    <div class="detail-metrics">
      <div><strong>${formatUsd(Number(property.price))}</strong><span>Precio</span></div>
      <div><strong>${pricePerM2(property) ? `USD ${pricePerM2(property).toLocaleString("es-UY")}` : "--"}</strong><span>m² edificado</span></div>
      <div><strong>${builtAreaForValue(property) || "--"} m²</strong><span>Construidos</span></div>
      <div><strong>${property.landArea || "--"} m²</strong><span>Terreno</span></div>
    </div>
    ${property.description ? `<div class="modal-section"><h3>Descripción</h3><p class="public-description">${escapeHtml(property.description)}</p></div>` : ""}
    <div class="modal-section">
      <h3>Información</h3>
      <div class="extra-list">${propertyInfoRows(property)}${renderPublicExtrasRows(property)}</div>
    </div>
    <div class="modal-section">
      <h3>Ubicación</h3>
      <div class="extra-list">
        <div class="extra-row"><span>Dirección</span><strong>${escapeHtml(property.address || "Pendiente")}</strong></div>
        <div class="extra-row"><span>Barrio</span><strong>${escapeHtml(property.neighborhood || "Pendiente")}</strong></div>
        <div class="extra-row"><span>Ciudad</span><strong>${escapeHtml(property.city || "Uruguay")}</strong></div>
        ${property.lat && property.lng ? `<div class="extra-row"><span>Coordenadas</span><strong>${property.lat}, ${property.lng}</strong></div>` : ""}
      </div>
      ${property.mapUrl ? `<a class="source-map-link" href="${escapeAttr(property.mapUrl)}" target="_blank" rel="noreferrer">Abrir mapa fuente</a>` : ""}
    </div>
    <div class="modal-actions-row">
      <button class="primary" type="button">Contactar vendedor</button>
      <button type="button">Compartir propiedad</button>
    </div>
  `;
}

function renderCostosPanel(property, monthlyCosts, monthlyTotal, yearlyCosts, docs) {
  return `
    <div class="cost-layout">
      <div class="modal-section">
        <h3>Costos mensuales</h3>
        ${monthlyCosts.length ? `
          <div class="cost-bars">
            ${monthlyCosts.map(([label, value]) => `<div>
              <span>${escapeHtml(label)}</span>
              <div class="bar"><span style="width:${Math.max(8, Math.min(100, (value / Math.max(monthlyTotal, 1)) * 100))}%"></span></div>
              <strong>${formatUsd(value)}</strong>
            </div>`).join("")}
          </div>
          <div class="cost-total">Total estimado: <strong>${formatUsd(monthlyTotal)}</strong></div>
        ` : `<p class="public-description">No hay costos mensuales declarados todavía.</p>`}
      </div>
      <div class="modal-section">
        <h3>Documentación</h3>
        <div class="doc-badges">${docs.length ? docs.map((doc) => `<span class="status-pill">${escapeHtml(doc)}</span>`).join("") : `<span class="status-pill warn">Costos sin verificar</span>`}</div>
        ${yearlyCosts.length ? `<div class="extra-list">${yearlyCosts.map(([label, value]) => `<div class="extra-row"><span>${escapeHtml(label)}</span><strong>${formatUsd(value)} / año</strong></div>`).join("")}</div>` : ""}
      </div>
    </div>
  `;
}

function startScoreBarAnimations(container) {
  const fills = container.querySelectorAll(".bar-fill[data-val]");
  if (!fills.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const fill = entry.target;
      const val = Math.max(0, Math.min(100, Number(fill.dataset.val)));
      requestAnimationFrame(() => { fill.style.width = val + "%"; });
      observer.unobserve(fill);
    });
  }, { threshold: 0.1 });
  fills.forEach((fill) => observer.observe(fill));
}

function animateRoomScore(el, targetValue) {
  if (el.dataset.animated) return;
  el.dataset.animated = "1";
  const duration = 600;
  const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = (eased * targetValue).toFixed(1);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = targetValue.toFixed(1);
  }
  requestAnimationFrame(step);
}

function openRoomSheet(room, property) {
  const sheet = $("#roomSheet");
  const body = $("#roomSheetBody");
  if (!sheet || !body) return;
  const improvements = (property.analysis?.improvements || []).slice(0, 3);
  body.innerHTML = `
    <h3 style="font-size:17px;margin-bottom:4px">${escapeHtml(room.name)}</h3>
    <p style="font-size:12px;color:var(--muted);margin-bottom:16px">
      ${[room.type, room.floor ? `Planta ${room.floor}` : "", room.area ? `${room.area} m²` : ""].filter(Boolean).join(" · ")}
    </p>
    ${room.score ? `<div style="margin-bottom:16px"><strong style="font-size:28px;color:${Number(room.score) >= 8 ? "var(--green)" : Number(room.score) >= 6.5 ? "var(--gold)" : "var(--red)"}">${Number(room.score).toFixed(1)}★</strong><span style="font-size:12px;color:var(--muted);margin-left:6px">Score OD</span></div>` : ""}
    ${room.notes ? `<p style="font-size:13px;line-height:1.6;margin-bottom:16px">${escapeHtml(room.notes)}</p>` : ""}
    ${improvements.length ? `<h4 style="font-size:13px;margin-bottom:8px">Mejoras sugeridas</h4><div class="mejoras-list">${improvements.map((item) => `<div class="mejora-item">${escapeHtml(item)}</div>`).join("")}</div>` : ""}
  `;
  sheet.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeRoomSheet() {
  const sheet = $("#roomSheet");
  if (!sheet) return;
  sheet.classList.remove("open");
  document.body.style.overflow = "";
}

function renderPublicExtras(property) {
  const extras = (property.extras || []).filter((item) => item.label && item.value);
  if (!extras.length) return "";
  return `
    <div class="extra-list">
      ${extras.map((item) => `
        <div class="extra-row">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderPublicExtrasRows(property) {
  return (property.extras || []).filter((item) => item.label && item.value).map((item) => `
    <div class="extra-row">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </div>
  `).join("");
}

function propertyInfoRows(property) {
  const rows = [
    ["Tipo", property.type],
    ["Dormitorios", property.bedrooms],
    ["Baños", property.bathrooms],
    ["Suites", property.suites],
    ["Cocheras", property.parking],
    ["m² edificados", builtAreaForValue(property)],
    ["m² terreno", property.landArea],
    ["Año", property.yearBuilt],
  ].filter(([, value]) => value !== "" && value !== null && value !== undefined);
  return rows.map(([label, value]) => `
    <div class="extra-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
  `).join("");
}

function costRows(property) {
  const rows = [
    ["Gastos comunes", property.commonFees],
    ["UTE promedio", property.uteAvg],
    ["OSE promedio", property.oseAvg],
    ["Antel", property.antelAvg],
    ["Contribución anual", property.contribucionAnnual],
    ["Primaria anual", property.primariaAnnual],
    ["Seguro hogar", property.insuranceAvg],
  ].filter(([, value]) => value !== "" && value !== null && value !== undefined);
  const base = rows.length ? rows.map(([label, value]) => `
    <div class="extra-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
  `).join("") : `<p class="public-description">No hay costos declarados todavía.</p>`;
  const docs = verifiedDocumentTypes(property);
  return `${base}${docs.length ? `<div class="doc-badges">${docs.map((doc) => `<span class="status-pill">${escapeHtml(doc)}</span>`).join("")}</div>` : ""}`;
}

function verifiedDocumentTypes(property) {
  return (property.documents || []).map((doc) => doc.kind).filter(Boolean);
}

function renderForm() {
  const property = selectedProperty();
  if (!property) return;
  const form = $("#propertyForm");
  Object.entries(property).forEach(([key, value]) => {
    const input = form.elements[key];
    if (input && typeof value !== "object") input.value = value ?? "";
  });
}

function renderRooms() {
  const property = selectedProperty();
  const list = $("#roomsList");
  list.innerHTML = "";
  if (!property.rooms.length) {
    list.appendChild(emptyNode());
    return;
  }
  property.rooms.forEach((item) => {
    const node = document.createElement("div");
    node.className = "room-item";
    node.innerHTML = `
      <div class="room-grid">
        <label>Nombre<input data-room="${item.id}" data-field="name" value="${escapeAttr(item.name)}"></label>
        <label>Tipo
          <select data-room="${item.id}" data-field="type">
            ${["Dormitorio", "Suite", "Bano", "Toilet", "Living", "Comedor", "Cocina", "Lavadero", "Barbacoa", "Escritorio", "Playroom", "Cochera", "Exterior", "Otro"].map((type) => `<option ${type === item.type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </label>
        <label>Planta<input data-room="${item.id}" data-field="floor" value="${escapeAttr(item.floor)}"></label>
        <label>Superficie m²<input type="number" min="0" step="0.1" data-room="${item.id}" data-field="area" value="${item.area ?? ""}"></label>
      </div>
      <label style="margin-top:10px">Notas<input data-room="${item.id}" data-field="notes" value="${escapeAttr(item.notes || "")}"></label>
      <div class="room-actions">
        <span class="status-pill ${item.confirmed ? "" : "warn"}">${item.confirmed ? "Confirmado manual" : "Sugerido por IA"}</span>
        <button data-remove-room="${item.id}">Eliminar</button>
      </div>
    `;
    list.appendChild(node);
  });
}

function renderPhotos() {
  const property = selectedProperty();
  const grid = $("#photoGrid");
  const summary = $("#photoSummary");
  grid.innerHTML = "";
  summary.innerHTML = "";
  const imported = property.photos.filter((photo) => photo.source && photo.source !== "manual").length;
  const manual = property.photos.length - imported;
  summary.innerHTML = `
    <span class="status-pill">${escapeHtml(property.title || "Propiedad sin título")}</span>
    <span class="status-pill">${property.photos.length} fotos</span>
    <span class="status-pill">${property.videos.length} videos</span>
    <span class="status-pill">${manual} manuales</span>
    <span class="status-pill warn">${imported} importadas</span>
    <span>Tip: InfoCasas y otros portales suelen traer logos, mapas o miniaturas. Seleccionalas y borralas antes del score.</span>
    ${property.videos.length ? `<span class="video-links">${property.videos.map((url, index) => `<a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">Video ${index + 1}</a>`).join(" ")}</span>` : ""}
  `;
  if (!property.photos.length) {
    grid.appendChild(emptyNode());
    return;
  }
  const roomOptions = property.rooms.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
  property.photos.forEach((photo) => {
    const card = document.createElement("div");
    card.className = "photo-card";
    card.draggable = true;
    card.dataset.photoCard = photo.id;
    card.innerHTML = `
      <span class="photo-origin">${escapeHtml(photo.source || "manual")}</span>
      <img src="${photoSrc(photo)}" alt="">
      <select data-photo-room="${photo.id}">
        <option value="">Sin ambiente asignado</option>
        ${roomOptions}
      </select>
      <div class="photo-tools">
        <label><input type="checkbox" data-photo-select="${photo.id}"> Seleccionar</label>
        <button data-delete-photo="${photo.id}">Borrar</button>
      </div>
    `;
    card.querySelector("select").value = photo.roomId || "";
    grid.appendChild(card);
  });
}

function renderChat() {
  const property = selectedProperty();
  if (!property) return;
  const messages = property.chatMessages || structuredClone(defaultState.chatMessages);
  property.chatMessages = messages;
  const list = $("#chatMessages");
  if (!list) return;
  list.innerHTML = "";
  messages.forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${message.role === "user" ? "user" : "assistant"}`;
    bubble.textContent = message.content;
    list.appendChild(bubble);
  });
  list.scrollTop = list.scrollHeight;
}

function renderDocuments() {
  const property = selectedProperty();
  const list = $("#documentsList");
  if (!property || !list) return;
  list.innerHTML = "";
  if (!property.documents.length) {
    const empty = emptyNode();
    empty.querySelector("strong").textContent = "Sin documentos cargados";
    empty.querySelector("span").textContent = "Subí facturas UTE/OSE, gastos comunes, contribución u otros respaldos.";
    list.appendChild(empty);
    return;
  }
  property.documents.forEach((documentItem) => {
    const row = document.createElement("div");
    row.className = "document-item";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(documentItem.name)}</strong>
        <div class="meta"><span>${escapeHtml(documentItem.type || "documento")}</span></div>
      </div>
      <select data-document-kind="${documentItem.id}">
        ${["Factura UTE", "Factura OSE", "Factura Antel", "Gastos comunes", "Contribucion", "Primaria", "Seguro hogar", "Plano aprobado", "Otro"].map((kind) => `<option ${kind === documentItem.kind ? "selected" : ""}>${kind}</option>`).join("")}
      </select>
      <button data-delete-document="${documentItem.id}">Borrar</button>
    `;
    list.appendChild(row);
  });
}

function renderReport() {
  const property = selectedProperty();
  const output = $("#reportOutput");
  if (!property || !output) return;
  if (!property.report) {
    output.innerHTML = `
      <div class="empty">
        <strong>Informe pendiente</strong>
        <span>Creá un informe cuando estén cargados datos, fotos, costos y score.</span>
      </div>
    `;
    return;
  }
  output.innerHTML = `
    <div class="report-card">
      <h3>${escapeHtml(property.report.title || "Informe de propiedad")}</h3>
      <p>${escapeHtml(property.report.summary || "")}</p>
    </div>
    ${(property.report.sections || []).map((section) => `
      <div class="report-card">
        <h3>${escapeHtml(section.title)}</h3>
        <p>${escapeHtml(section.body)}</p>
      </div>
    `).join("")}
  `;
}

function renderPlans() {
  const property = selectedProperty();
  const list = $("#planList");
  list.innerHTML = "";
  if (!property.plans.length) {
    list.appendChild(emptyNode());
    return;
  }
  property.plans.forEach((plan) => {
    const node = document.createElement("div");
    node.className = "plan-item";
    const preview = plan.dataUrl?.startsWith("data:image") ? `<img src="${plan.dataUrl}" alt="" style="width:120px;aspect-ratio:4/3;object-fit:cover;border-radius:8px">` : "";
    node.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;justify-content:space-between">
        <div style="display:flex;gap:12px;align-items:center">
          ${preview}
          <div>
            <strong>${escapeHtml(plan.name)}</strong>
            <div class="meta"><span>${escapeHtml(plan.floor || "Planta sin identificar")}</span><span>${escapeHtml(plan.type)}</span></div>
          </div>
        </div>
        <button data-remove-plan="${plan.id}">Eliminar</button>
      </div>
    `;
    list.appendChild(node);
  });
}

function renderScore() {
  const property = selectedProperty();
  $("#scorePropertyTitle").textContent = property?.title || "Propiedad seleccionada";
  $("#scoreValue").innerHTML = property.score ? scoreDial(property.score, "large") : "--";
  $("#scoreLabel").textContent = property.score ? "Score calculado" : "Sin calcular";
  $("#scoreLabel").className = property.score ? "status-pill" : "status-pill warn";
  $("#manualScoreInput").value = property.score || "";
  $("#manualNoteInput").value = property.manualScoreNote || "";

  const output = $("#analysisOutput");
  output.innerHTML = "";
  if (!property.analysis) {
    output.appendChild(emptyNode());
    return;
  }

  const analysis = property.analysis;
  const bars = document.createElement("div");
  bars.className = "analysis-item";
  bars.innerHTML = `
    <h3>Categorias</h3>
    <div class="score-bars">
      ${Object.entries(analysis.categories || {}).map(([key, value]) => `
        <div class="bar-row">
          <span>${escapeHtml(labelize(key))}</span>
          <div class="bar"><span style="width:${Math.max(0, Math.min(100, Number(value) * 10))}%"></span></div>
          <span>${Number(value).toFixed(1)}</span>
        </div>
      `).join("")}
    </div>
  `;
  output.appendChild(bars);

  [
    ["Resumen", analysis.summary],
    ["Fortalezas", asList(analysis.strengths)],
    ["Riesgos detectados", asList(analysis.risks)],
    ["Fotos faltantes", asList(analysis.missing_photos)],
    ["Fotos recomendadas", asList(analysis.recommended_photos)],
    ["Mejoras sugeridas", asList(analysis.improvements)],
    ["Inconsistencias", asList(analysis.inconsistencies)],
    ["Impacto estimado en valor", renderValueImpact(analysis.value_impact)],
  ].forEach(([title, content]) => {
    if (!content) return;
    const item = document.createElement("div");
    item.className = "analysis-item";
    item.innerHTML = `<h3>${title}</h3><p>${content}</p>`;
    output.appendChild(item);
  });

  if (property.planAnalysis) {
    const item = document.createElement("div");
    item.className = "analysis-item";
    item.innerHTML = `<h3>Analisis de planos</h3><p>${escapeHtml(property.planAnalysis.summary || "Plano analizado.")}</p>`;
    output.appendChild(item);
  }
}

function renderValueImpact(value) {
  if (!value || typeof value !== "object") return "";
  const delta = Number(value.estimated_value_delta_usd || 0);
  const percent = Number(value.estimated_value_delta_percent || 0);
  const confidence = Number(value.confidence || 0);
  const parts = [];
  if (value.current_value_comment) parts.push(escapeHtml(value.current_value_comment));
  if (delta || percent) {
    parts.push(`Movimiento estimado: ${delta ? formatUsd(delta) : "USD --"}${percent ? ` (${percent.toFixed(1)}%)` : ""}.`);
  }
  if (confidence) parts.push(`Confianza: ${(confidence > 1 ? confidence : confidence * 100).toFixed(0)}%.`);
  if (value.notes) parts.push(escapeHtml(value.notes));
  return parts.join("<br>");
}

function asList(value) {
  if (Array.isArray(value)) return value.map((item) => `- ${escapeHtml(String(item))}`).join("<br>");
  return value ? escapeHtml(String(value)) : "";
}

function labelize(key) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function updateSelectedFromForm() {
  const property = selectedProperty();
  const form = $("#propertyForm");
  const data = new FormData(form);
  for (const [key, value] of data.entries()) {
    const numeric = ["price", "bedrooms", "bathrooms", "suites", "parking", "landArea", "builtArea", "semiArea", "yearBuilt", "commonFees", "uteAvg", "oseAvg", "antelAvg", "contribucionAnnual", "primariaAnnual", "insuranceAvg", "lat", "lng"];
    property[key] = numeric.includes(key) ? (value === "" ? "" : Number(value)) : value;
  }
  property.lat = property.lat === "" ? "" : roundCoord(property.lat);
  property.lng = property.lng === "" ? "" : roundCoord(property.lng);
  hydrateCoordinatesFromMapUrl(property, form);
  saveState();
  renderSellerCompleteness();
  renderCostsBanner();
}

function roundCoord(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(4)) : "";
}

function hydrateCoordinatesFromMapUrl(property, form = null) {
  if (!property.mapUrl || (property.lat && property.lng)) return;
  const coords = extractCoordsFromMapUrl(property.mapUrl);
  if (!coords) return;
  property.lat = roundCoord(coords.lat);
  property.lng = roundCoord(coords.lng);
  if (form?.elements?.lat) form.elements.lat.value = property.lat;
  if (form?.elements?.lng) form.elements.lng.value = property.lng;
}

function extractCoordsFromMapUrl(mapUrl = "") {
  let decoded = String(mapUrl).replace(/&amp;/g, "&");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    decoded = String(mapUrl).replace(/&amp;/g, "&");
  }
  const patterns = [
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /[?&](?:q|ll|center)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(decoded);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat: roundCoord(lat), lng: roundCoord(lng) };
  }
  return null;
}

function savePropertyForm() {
  updateSelectedFromForm();
  if (state.editorMode === "create") {
    saveDraftProperty();
  } else {
    saveState();
    renderAll();
  }
}

async function filesToDataUrls(files) {
  return Promise.all(Array.from(files).map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ file, dataUrl: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  })));
}

async function callOpenRouter({ model, functionType = "search", messages, temperature = 0.2 }) {
  const selectedModel = model || modelForFunction(functionType);
  const started = Date.now();
  const response = await fetch(apiUrl("/api/openrouter"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.apiKey ? { "X-OpenRouter-Key": settings.apiKey } : {}),
    },
    body: JSON.stringify({
      functionType,
      ...(model ? { model: selectedModel, fallbackModels: modelFallbacksFor(functionType, selectedModel) } : {}),
      temperature,
      messages,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    updateModelStatus(functionType, { status: "failed" });
    throw new Error(humanAiError(response.status, text));
  }
  const data = await response.json();
  const parsed = parseAiResponsePayload(data);
  const usedModel = data.meta?.usedModel || selectedModel;
  recordAiUsage(functionType, data.meta || { usedModel, durationMs: Date.now() - started });
  updateModelStatus(functionType, {
    status: data.meta?.fallbackUsed ? "fallback" : "active",
    lastSuccessfulModel: data.meta?.routedModel || usedModel,
    lastSuccessAt: new Date().toISOString(),
    averageMs: averageMsFor(functionType, data.meta?.durationMs || Date.now() - started),
  });
  parsed.__meta = data.meta || { usedModel, attemptedModels: [selectedModel], fallbackUsed: false, durationMs: Date.now() - started };
  return parsed;
}

function parseAiResponsePayload(data) {
  if (!data || typeof data !== "object") throw new Error("OpenRouter no devolvió contenido.");
  if (data.choices?.[0]?.message?.content) {
    const content = data.choices[0].message.content;
    if (typeof content === "string") {
      return parseLooseJson(content);
    }
    return content;
  }
  const { meta, ...payload } = data;
  if (payload.raw_content && typeof payload.raw_content === "string") {
    return parseLooseJson(payload.raw_content);
  }
  if (!Object.keys(payload).length) throw new Error("OpenRouter no devolvió contenido.");
  return payload;
}

function parseLooseJson(content) {
  const cleaned = String(content || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const candidates = uniqueStrings([
    cleaned,
    extractJsonObject(cleaned),
    escapeJsonControlCharacters(cleaned),
    escapeJsonControlCharacters(extractJsonObject(cleaned)),
  ].filter(Boolean));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next repair candidate
    }
  }
  throw new Error("La IA respondió, pero no devolvió JSON válido.");
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : "";
}

function escapeJsonControlCharacters(text) {
  let output = "";
  let inString = false;
  let escaped = false;
  for (const char of String(text || "")) {
    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      output += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      output += char;
      continue;
    }
    if (inString) {
      if (char === "\n") {
        output += "\\n";
        continue;
      }
      if (char === "\r") {
        output += "\\r";
        continue;
      }
      if (char === "\t") {
        output += "\\t";
        continue;
      }
    }
    output += char;
  }
  return output;
}

function modelForFunction(functionType) {
  return aiModelConfig.functions?.[functionType]?.activeModel || settings.model || serverConfig.defaultModel || DEFAULT_MODEL;
}

function modelFallbacksFor(functionType, selectedModel) {
  const fallbacks = aiModelConfig.functions?.[functionType]?.fallbacks || [];
  return uniqueStrings([...fallbacks, ...MODEL_PRESETS]).filter((candidate) => candidate !== selectedModel);
}

function updateModelStatus(functionType, patch) {
  if (!aiModelConfig.functions?.[functionType]) return;
  aiModelConfig.functions[functionType] = { ...aiModelConfig.functions[functionType], ...patch };
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(aiModelConfig));
  renderSettings();
}

function averageMsFor(functionType, durationMs) {
  const current = Number(aiModelConfig.functions?.[functionType]?.averageMs || 0);
  return current ? Math.round((current * 0.7) + (durationMs * 0.3)) : Math.round(durationMs);
}

function humanAiError(status, text = "") {
  try {
    const data = JSON.parse(text);
    if (data.error && typeof data.error === "string") return data.error;
    if (data.error?.message) return data.error.message;
  } catch {
    // keep fallback below
  }
  if (status === 429) return "El modelo gratuito está temporalmente limitado. Probá de nuevo en unos minutos.";
  if (status === 401) return "La API key de OpenRouter no está configurada o no es válida.";
  if (status >= 500) return "El proveedor de IA tuvo un error temporal.";
  return `OpenRouter respondió ${status}.`;
}

function propertyPrompt(property) {
  return {
    title: property.title,
    type: property.type,
    neighborhood: property.neighborhood,
    city: property.city,
    address: property.address,
    lat: property.lat,
    lng: property.lng,
    map_url: property.mapUrl || null,
    price_usd: property.price,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    suites: property.suites,
    parking: property.parking,
    land_area_m2: property.landArea,
    built_area_m2: property.builtArea,
    semi_area_m2: property.semiArea,
    costs: {
      common_fees: property.commonFees,
      ute_avg: property.uteAvg,
      ose_avg: property.oseAvg,
      antel_avg: property.antelAvg,
      contribucion_annual: property.contribucionAnnual,
      primaria_annual: property.primariaAnnual,
      insurance_avg: property.insuranceAvg,
      verified_documents: verifiedDocumentTypes(property),
    },
    source_platform: property.sourcePlatform || null,
    source_url: property.sourceUrl || null,
    scraped_missing_fields: missingFields(property),
    photos: property.photos.map((photo) => ({
      name: photo.name,
      source: photo.source || "manual",
      assigned_room: property.rooms.find((roomItem) => roomItem.id === photo.roomId)?.name || null,
    })),
    videos: property.videos || [],
    extras: property.extras || [],
    rooms: property.rooms.map(({ name, type, floor, area, notes }) => ({ name, type, floor, area, notes })),
  };
}

function photoSrc(photo) {
  return photo?.dataUrl || photo?.url || "";
}

function modelSupportsVision(model = "") {
  const value = model.toLowerCase();
  return value === "openrouter/free" || ["gpt-4o", "o4", "vision", "claude", "gemini", "gemma", "qwen-vl", "llava", "omni"].some((token) => value.includes(token));
}

function modelQueueSupportsVision(functionType) {
  const active = modelForFunction(functionType);
  return [active, ...modelFallbacksFor(functionType, active)].some(modelSupportsVision);
}

async function runPhotoAnalysis() {
  const property = selectedProperty();
  if (!property.photos.length) {
    alert("Subi al menos una foto antes de calcular el score.");
    return;
  }
  $("#runAiBtn").disabled = true;
  $("#runAiBtn").textContent = "Analizando fotos...";
  setOperationProgress("#analysisProgress", {
    title: "Preparando análisis",
    detail: "Tomo datos principales, costos cargados y hasta 8 fotos representativas.",
    percent: 8,
  });
  try {
    await nextFrameDelay();
    const limitedPhotos = property.photos.slice(0, 8);
    const chosenModel = modelForFunction("vision");
    const canSeeImages = modelQueueSupportsVision("vision");
    setOperationProgress("#analysisProgress", {
      title: "Leyendo fotos",
      detail: canSeeImages ? `Analizando ${limitedPhotos.length} fotos con el modelo visual disponible.` : "El modelo actual no ve imágenes; uso metadata y datos cargados.",
      percent: 28,
    });
    const promptText = `Analiza esta propiedad owner-direct y calcula un score tecnico-comercial de 0 a 10 usando datos cargados ${canSeeImages ? "y fotos." : "y metadata de fotos. El modelo configurado no esta marcado como vision, por lo que este es un score basico sin inspeccion visual directa."}

Devuelve JSON valido con esta forma exacta:
{
  "global_score": number,
  "categories": {
    "distribucion": number,
    "terminaciones": number,
    "estado_general": number,
    "luminosidad": number,
    "exterior": number,
    "documentacion_visual": number
  },
  "summary": string,
  "strengths": string[],
  "risks": string[],
  "missing_photos": string[],
  "recommended_photos": string[],
  "improvements": string[],
  "inconsistencies": string[],
  "value_impact": {
    "current_value_comment": string,
    "estimated_value_delta_usd": number,
    "estimated_value_delta_percent": number,
    "confidence": number,
    "notes": string
  }
}

Se critico y util para vendedores. Si faltan fotos importantes, penaliza documentacion_visual. En recommended_photos indica que fotos conviene sumar para vender mejor, por ejemplo fachada, living con luz natural, cocina, baños, dormitorios, terraza, garaje, vistas, amenities, problemas de mantenimiento o plano. En value_impact estima de forma prudente cuanto podria mover el valor percibido de la propiedad si se corrigen fotos, documentacion y presentacion; usa baja confianza cuando no haya evidencia suficiente. Datos cargados:
${JSON.stringify(propertyPrompt(property), null, 2)}`;
    const content = canSeeImages ? [
      { type: "text", text: promptText },
      ...(canSeeImages ? limitedPhotos.map((photo) => ({
        type: "image_url",
        image_url: { url: photoSrc(photo) },
      })) : []),
    ] : promptText;

    setOperationProgress("#analysisProgress", {
      title: "Calculando score",
      detail: "Evaluando distribución, terminaciones, estado, luminosidad, exterior y documentación visual.",
      percent: 54,
    });
    let analysis;
    try {
      analysis = await callOpenRouter({
        functionType: "vision",
        messages: [{ role: "user", content }],
      });
    } catch (error) {
      if (!isImageInputError(error)) throw error;
      setOperationProgress("#analysisProgress", {
        title: "Reintentando análisis",
        detail: "El router gratuito no encontró endpoint visual. Sigo con datos y metadata para no cortar el flujo.",
        percent: 62,
      });
      analysis = await callOpenRouter({
        functionType: "score",
        messages: [{ role: "user", content: `${promptText}\n\nNo hubo endpoint visual disponible, así que este análisis debe aclarar que no inspeccionó las imágenes directamente y basarse en metadata, nombres de fotos y ficha cargada.` }],
      });
      analysis.summary = `${analysis.summary || "Análisis generado con metadata."} Nota: no hubo endpoint visual disponible; se usaron datos cargados y metadata de fotos.`;
    }
    setOperationProgress("#analysisProgress", {
      title: "Generando informe",
      detail: "Ordenando fortalezas, riesgos, fotos recomendadas e impacto estimado en valor.",
      percent: 86,
    });
    property.analysis = analysis;
    property.score = Number(analysis.global_score || 0);
    saveState();
    renderAll();
    setOperationProgress("#analysisProgress", {
      title: "Score generado",
      detail: `Análisis listo. Score OD ${property.score ? Number(property.score).toFixed(1) : "--"}. Podés revisar el informe o publicar.`,
      percent: 100,
      status: "done",
    });
    showToast("Análisis listo");
  } catch (error) {
    setOperationProgress("#analysisProgress", {
      title: "No se pudo analizar",
      detail: error.message,
      percent: 100,
      status: "error",
    });
    alert(error.message);
  } finally {
    $("#runAiBtn").disabled = false;
    $("#runAiBtn").textContent = "Analizar fotos con IA";
  }
}

function isImageInputError(error) {
  return /image input|soporten image|soporte real de input visual|input visual|endpoint visual/i.test(String(error?.message || error || ""));
}

async function runPlanAnalysis() {
  const property = selectedProperty();
  const imagePlans = property.plans.filter((plan) => plan.dataUrl?.startsWith("data:image"));
  const chosenModel = modelForFunction("plan");
  if (!modelQueueSupportsVision("plan")) {
    alert("El analisis de planos necesita un modelo con vision. Para esta demo cambia el modelo de planos a uno con vision, por ejemplo openai/gpt-4o-mini, o usa ajuste manual.");
    return;
  }
  if (!imagePlans.length) {
    alert("Para esta demo subi el plano como imagen. Los PDF se dejan cargados, pero en produccion se procesan en backend.");
    return;
  }
  $("#runPlanAiBtn").disabled = true;
  $("#runPlanAiBtn").textContent = "Analizando planos...";
  try {
    const content = [
      {
        type: "text",
        text: `Analiza estos planos de una propiedad. Detecta plantas, ambientes, dormitorios y banos. Devuelve JSON valido:
{
  "summary": string,
  "detected_bedrooms": number,
  "detected_bathrooms": number,
  "floors": [{"name": string, "rooms": [{"name": string, "type": string, "estimated_area_m2": number|null, "confidence": number}]}],
  "manual_review_needed": string[]
}

Si no podes leer algo con confianza, indicalo para ajuste manual. Datos cargados:
${JSON.stringify(propertyPrompt(property), null, 2)}`,
      },
      ...imagePlans.slice(0, 4).map((plan) => ({
        type: "image_url",
        image_url: { url: plan.dataUrl },
      })),
    ];

    const planAnalysis = await callOpenRouter({
      functionType: "plan",
      messages: [{ role: "user", content }],
    });
    property.planAnalysis = planAnalysis;
    if (Array.isArray(planAnalysis.floors)) {
      const suggested = [];
      planAnalysis.floors.forEach((floor) => {
        (floor.rooms || []).forEach((detectedRoom) => {
          suggested.push({
            id: uid("room-ai"),
            name: detectedRoom.name || detectedRoom.type || "Ambiente detectado",
            type: normalizeRoomType(detectedRoom.type),
            floor: floor.name || "Planta",
            area: detectedRoom.estimated_area_m2 || "",
            notes: `Sugerido por IA desde plano. Confianza: ${detectedRoom.confidence ?? "sin dato"}`,
            score: null,
            confirmed: false,
          });
        });
      });
      property.rooms = [...property.rooms, ...suggested.slice(0, 12)];
    }
    saveState();
    renderAll();
  } catch (error) {
    alert(error.message);
  } finally {
    $("#runPlanAiBtn").disabled = false;
    $("#runPlanAiBtn").textContent = "Analizar planos con IA";
  }
}

function normalizeRoomType(type = "") {
  const value = String(type).toLowerCase();
  if (value.includes("dorm")) return "Dormitorio";
  if (value.includes("suite")) return "Suite";
  if (value.includes("bano") || value.includes("baño") || value.includes("bath")) return "Bano";
  if (value.includes("cocina")) return "Cocina";
  if (value.includes("living")) return "Living";
  if (value.includes("comedor")) return "Comedor";
  if (value.includes("lav")) return "Lavadero";
  if (value.includes("barb") || value.includes("parr")) return "Barbacoa";
  if (value.includes("garage") || value.includes("coch")) return "Cochera";
  return "Otro";
}

function addProperty() {
  startCreateProperty();
}

function startCreateProperty() {
  if (!canManageProperties()) {
    setView("marketplace");
    return;
  }
  state.editorMode = "create";
  state.draftProperty = createBlankProperty("__draft");
  state.editorTab = "import";
  saveState();
  setView("editor");
}

function createBlankProperty(id = uid("property")) {
  const user = currentUser();
  return {
    id,
    ownerId: user?.id || "",
    ownerEmail: user?.email || "",
    title: "",
    type: "Casa",
    status: "draft",
    price: "",
    neighborhood: "",
    city: "",
    address: "",
    lat: "",
    lng: "",
    mapUrl: "",
    bedrooms: "",
    bathrooms: "",
    suites: "",
    parking: "",
    landArea: "",
    builtArea: "",
    semiArea: "",
    yearBuilt: "",
    architect: "",
    commonFees: "",
    uteAvg: "",
    oseAvg: "",
    antelAvg: "",
    contribucionAnnual: "",
    primariaAnnual: "",
    insuranceAvg: "",
    description: "",
    rooms: [],
    photos: [],
    videos: [],
    plans: [],
    documents: [],
    extras: [],
    report: null,
    score: null,
    analysis: null,
    chatMessages: null,
  };
}

function saveDraftProperty() {
  const draft = structuredClone(state.draftProperty || createBlankProperty());
  draft.id = uid("property");
  const user = currentUser();
  draft.ownerId = draft.ownerId || user?.id || "";
  draft.ownerEmail = draft.ownerEmail || user?.email || "";
  draft.title = draft.title || "Nueva propiedad owner-direct";
  ensurePropertyDefaults(draft);
  state.properties.unshift(draft);
  state.selectedId = draft.id;
  state.editorMode = "edit";
  state.draftProperty = null;
  saveState();
  renderAll();
  alert("Propiedad creada y agregada al listado.");
}

function duplicateProperty() {
  const current = selectedProperty();
  const copy = structuredClone(current);
  const user = currentUser();
  copy.id = uid("property");
  copy.ownerId = user?.id || copy.ownerId || "";
  copy.ownerEmail = user?.email || copy.ownerEmail || "";
  copy.title = `${copy.title || "Propiedad"} copia`;
  copy.status = "draft";
  copy.score = null;
  copy.analysis = null;
  copy.report = null;
  copy.chatMessages = null;
  state.properties.unshift(copy);
  state.selectedId = copy.id;
  saveState();
  setView("editor");
}

function deleteProperty(id) {
  const property = state.properties.find((item) => item.id === id);
  if (!property) return;
  if (!confirm(`¿Borrar "${property.title || "Propiedad sin título"}"? Esta acción quita fotos, análisis y documentos de esa ficha.`)) return;
  state.properties = state.properties.filter((item) => item.id !== id);
  if (state.selectedId === id) state.selectedId = state.properties[0]?.id || null;
  if (!state.properties.length) {
    state.properties.push(createBlankProperty(uid("property")));
    state.selectedId = state.properties[0].id;
  }
  saveState();
  renderAll();
}

function publishProperty(id, status = "published") {
  const property = state.properties.find((item) => item.id === id);
  if (!property) return;
  property.status = status;
  state.selectedId = id;
  saveState();
  renderAll();
  if (status === "published") {
    showToast("Publicada");
    launchConfetti();
  }
}

function launchConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const root = document.createElement("div");
  root.className = "confetti";
  root.innerHTML = Array.from({ length: 30 }).map((_, index) => `<i style="--x:${Math.random() * 100}vw;--d:${Math.random() * 1.2 + .4}s;--r:${Math.random() * 360}deg;--c:${index % 3}"></i>`).join("");
  document.body.appendChild(root);
  setTimeout(() => root.remove(), 1600);
}

async function runScrape() {
  const url = $("#scrapeUrlInput").value.trim();
  if (!url) {
    alert("Pegá el link de MercadoLibre, InfoCasas u otra publicación.");
    return;
  }
  $("#scrapeBtn").disabled = true;
  $("#scrapeBtn").textContent = "Scrapeando...";
  $("#scrapeOutput").classList.remove("hidden");
  $("#scrapeOutput").textContent = "Iniciando importación asistida...";
  setOperationProgress("#scrapeProgress", {
    title: "Leyendo publicación",
    detail: "Estoy abriendo el link y buscando título, precio, ubicación, atributos y galería.",
    percent: 12,
  });
  try {
    preparePropertyForScrape(url);
    setOperationProgress("#scrapeProgress", {
      title: "Extrayendo datos",
      detail: "Conectando con el scraper y detectando la plataforma de origen.",
      percent: 24,
    });
    const response = await fetch(apiUrl("/api/scrape"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) throw new Error(await response.text());
    const scraped = await response.json();
    $("#scrapeOutput").textContent = "Datos scrapeados. Guardando fotos y atributos...";
    setOperationProgress("#scrapeProgress", {
      title: "Guardando ficha",
      detail: "Ya se scrapeó la publicación. Ahora copio datos, fotos, videos y atributos a esta propiedad.",
      percent: 48,
    });
    applyScrapedData(scraped);
    $("#scrapeOutput").textContent = "Filtrando fotos importadas automáticamente...";
    setOperationProgress("#scrapeProgress", {
      title: "Filtrando fotos",
      detail: "Estoy quitando logos, mapas, banners y fotos que no parecen de la propiedad.",
      percent: 68,
    });
    const filterReport = await filterImportedPhotos({ silent: true });
    const property = selectedProperty();
    $("#scrapeOutput").textContent = "Validando coherencia con IA...";
    setOperationProgress("#scrapeProgress", {
      title: "Validando coherencia",
      detail: "Reviso que dormitorios, baños, m², barrio y fotos tengan sentido para Uruguay.",
      percent: 84,
    });
    const review = await validateScrapedProperty(property);
    const missing = missingFields(property);
    setOperationProgress("#scrapeProgress", {
      title: "Importación lista",
      detail: "Se completó el scraping. Podés avanzar a Datos básicos para revisar y corregir lo importado.",
      percent: 100,
      status: "done",
    });
    $("#scrapeOutput").innerHTML = `
      <strong>Importación lista desde ${escapeHtml(scraped.platform || "link externo")}.</strong><br>
      Se cargaron título, descripción, precio, ubicación, atributos, ${scraped.photos?.length || 0} fotos y ${scraped.videos?.length || 0} videos detectados.
      ${filterReport ? `<br>${escapeHtml(filterReport)}` : ""}
      ${review ? `<br><br><strong>Chequeo IA/coherencia:</strong><br>${escapeHtml(review)}` : ""}
      ${missing.length ? `<br><br><strong>Faltantes para pedir al propietario:</strong><br>${missing.map((item) => `- ${escapeHtml(item)}`).join("<br>")}` : "<br><br>La ficha básica quedó completa."}
    `;
    state.editorTab = "data";
    saveState();
    showToast("Importación lista. Revisá Datos básicos.");
    renderAll();
  } catch (error) {
    setOperationProgress("#scrapeProgress", {
      title: "No se pudo completar",
      detail: "El link no se pudo importar automáticamente. Podés intentar de nuevo o cargar la propiedad manualmente.",
      percent: 100,
      status: "error",
    });
    $("#scrapeOutput").innerHTML = `<strong>No se pudo scrapear automáticamente.</strong><br>${escapeHtml(error.message)}<br><br>Podés cargar manualmente o copiar/pegar datos desde la publicación.`;
  } finally {
    $("#scrapeBtn").disabled = false;
    $("#scrapeBtn").textContent = "Scrapear datos";
  }
}

function preparePropertyForScrape(url) {
  const current = selectedProperty();
  if (state.editorMode === "create") {
    current.sourceUrl = url;
    saveState();
    return;
  }
  const isBlank = !current.sourceUrl
    && !current.photos.length
    && (!current.title || current.title === "Nueva propiedad owner-direct")
    && !current.price
    && !current.description;
  const alreadyImportedDifferentUrl = current.sourceUrl && current.sourceUrl !== url;
  const hasMeaningfulData = current.photos.length || current.price || current.description || (current.title && current.title !== "Nueva propiedad owner-direct");
  if (!isBlank && (alreadyImportedDifferentUrl || hasMeaningfulData)) {
    const property = createBlankProperty(uid("property"));
    property.sourceUrl = url;
    state.properties.unshift(property);
    state.selectedId = property.id;
    state.editorMode = "edit";
    state.draftProperty = null;
    saveState();
    renderAll();
  }
}

async function validateScrapedProperty(property) {
  const local = localScrapeReview(property);
  const hasAi = Boolean(settings.apiKey || serverConfig.openRouterConfigured);
  if (!hasAi) {
    property.scrapeReview = local;
    saveState();
    return `Chequeo automático local: ${local.summary}`;
  }
  try {
    const chosenModel = modelForFunction("vision");
    const canSeeImages = modelQueueSupportsVision("vision");
    const photos = property.photos.slice(0, 12);
    const prompt = `Revisá una ficha scrapeada para una plataforma owner-direct en Uruguay. Validá coherencia de precio, m² edificados, m² terreno, dormitorios, baños, barrio, fotos y descripciones. Si podés, segmentá fotos por ambiente. Devuelve JSON válido:
{
  "coherence_score": number,
  "summary": string,
  "warnings": string[],
  "suggested_corrections": [{"field": string, "value": string, "reason": string}],
  "photo_room_segments": [{"photo_name": string, "room_name": string, "room_type": string}],
  "remove_photo_names": string[]
}

Datos:
${JSON.stringify(propertyPrompt(property), null, 2)}

Chequeo local:
${JSON.stringify(local, null, 2)}`;
    const content = canSeeImages ? [
      { type: "text", text: prompt },
      ...photos.map((photo) => ({ type: "image_url", image_url: { url: photoSrc(photo) } })),
    ] : prompt;
    const result = await callOpenRouter({
      functionType: "vision",
      messages: [{ role: "user", content }],
      temperature: 0.1,
    });
    applyScrapeReview(property, result);
    saveState();
    return `${canSeeImages ? "IA visual" : "IA metadata"}: ${result.summary || "Ficha revisada."}${Array.isArray(result.warnings) && result.warnings.length ? ` Alertas: ${result.warnings.join("; ")}` : ""}`;
  } catch (error) {
    property.scrapeReview = local;
    saveState();
    return `Chequeo local por fallback: ${local.summary} IA no disponible temporalmente.`;
  }
}

function localScrapeReview(property) {
  const warnings = [];
  const built = builtAreaForValue(property);
  if (!property.price) warnings.push("Falta precio.");
  if (!built) warnings.push("Faltan m² edificados/área privada para calcular USD/m².");
  if (Number(property.landArea || 0) && built && Number(property.landArea) < built) warnings.push("El terreno figura menor que el área edificada.");
  if (!property.bedrooms) warnings.push("Faltan dormitorios.");
  if (!property.bathrooms) warnings.push("Faltan baños.");
  if (property.photos.length < 8) warnings.push("Pocas fotos para una publicación completa.");
  return {
    coherence_score: Math.max(0, 10 - warnings.length * 1.2),
    summary: warnings.length ? warnings.join(" ") : "Datos básicos coherentes.",
    warnings,
  };
}

function applyScrapeReview(property, review) {
  property.scrapeReview = review;
  const remove = new Set((review.remove_photo_names || []).map((name) => normalizeText(name)));
  if (remove.size) property.photos = property.photos.filter((photo) => !remove.has(normalizeText(photo.name)));
  (review.photo_room_segments || []).forEach((segment) => {
    const photo = property.photos.find((item) => normalizeText(item.name) === normalizeText(segment.photo_name));
    if (!photo) return;
    let roomItem = property.rooms.find((item) => normalizeText(item.name) === normalizeText(segment.room_name));
    if (!roomItem) {
      roomItem = room(uid("room-ai"), segment.room_name || segment.room_type || "Ambiente detectado", normalizeRoomType(segment.room_type), "Sin planta", "", "Sugerido por IA desde fotos scrapeadas");
      roomItem.confirmed = false;
      property.rooms.push(roomItem);
    }
    photo.roomId = roomItem.id;
  });
}

async function testAiConnection() {
  settings.apiKey = $("#apiKeyInput").value.trim();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

  $("#testAiBtn").disabled = true;
  $("#testAiBtn").textContent = "Probando...";
  $("#aiTestOutput").classList.remove("hidden");
  $("#aiTestOutput").textContent = "Probando modelos activos...";
  try {
    const results = [];
    for (const key of Object.keys(AI_FUNCTIONS)) {
      results.push(await testModelFunction(key));
    }
    $("#aiTestOutput").innerHTML = `<strong>Chequeo terminado.</strong><br>${results.map((item) => `${escapeHtml(AI_FUNCTIONS[item.functionType].label)}: ${item.ok ? "OK" : "falló"} · ${escapeHtml(item.model || item.error || "")}`).join("<br>")}`;
  } catch (error) {
    $("#aiTestOutput").innerHTML = `<strong>No conectó todavía.</strong><br>${escapeHtml(error.message)}`;
  } finally {
    $("#testAiBtn").disabled = false;
    $("#testAiBtn").textContent = "Probar IA";
  }
}

async function testModelFunction(functionType, model = null) {
  const item = aiModelConfig.functions[functionType];
  const target = model || item.activeModel;
  updateModelStatus(functionType, { status: "testing" });
  const started = Date.now();
  try {
    const response = await fetch(apiUrl("/api/openrouter/test"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(settings.apiKey ? { "X-OpenRouter-Key": settings.apiKey } : {}) },
      body: JSON.stringify({ model: target, functionType }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "Modelo no disponible");
    updateModelStatus(functionType, {
      status: "active",
      activeModel: target,
      lastSuccessfulModel: data.meta?.routedModel || data.meta?.usedModel || target,
      lastSuccessAt: new Date().toISOString(),
      averageMs: averageMsFor(functionType, data.meta?.durationMs || Date.now() - started),
    });
    saveAiModelConfig();
    return { ok: true, functionType, model: data.meta?.routedModel || data.meta?.usedModel || target };
  } catch (error) {
    updateModelStatus(functionType, { status: "failed" });
    return { ok: false, functionType, model: target, error: error.message };
  }
}

async function sendChatMessage(text) {
  const message = text.trim();
  if (!message) return;
  const property = selectedProperty();
  property.chatMessages = property.chatMessages || structuredClone(defaultState.chatMessages);
  property.chatMessages.push({ role: "user", content: message });
  saveState();
  renderChat();

  $("#chatInput").value = "";
  const submit = $("#chatForm button");
  submit.disabled = true;
  submit.textContent = "Pensando...";
  try {
    const result = await callOpenRouter({
      functionType: "search",
      messages: [
        {
          role: "system",
          content: `Sos un asesor inmobiliario owner-direct para Uruguay. Tu trabajo es conversar con compradores y recomendar zonas segun estilo de vida, presupuesto, colegios, seguridad percibida, espacios verdes, servicios, movilidad, conexion con Montevideo/Canelones/Punta del Este y potencial de reventa.

No inventes datos hiperprecisos ni digas que consultaste mapas en tiempo real. Si falta informacion, hace 2 o 3 preguntas concretas. Responde siempre JSON valido:
{
  "answer": string,
  "recommended_zones": string[],
  "nearby_checks": string[],
  "follow_up_questions": string[]
}`,
        },
        {
          role: "user",
          content: `Contexto de propiedad seleccionada:
${JSON.stringify(propertyPrompt(property), null, 2)}

Historial reciente:
${JSON.stringify((property.chatMessages || []).slice(-8), null, 2)}

Mensaje actual del comprador:
${message}`,
        },
      ],
    });
    const answer = formatAssistantAnswer(result);
    property.chatMessages.push({ role: "assistant", content: answer });
  } catch (error) {
    property.chatMessages.push({
      role: "assistant",
      content: `No pude conectar con la IA todavía: ${error.message}\n\nRevisá OpenRouter > Guardar > Probar IA.`,
    });
  } finally {
    saveState();
    renderChat();
    submit.disabled = false;
    submit.textContent = "Enviar";
  }
}

function formatAssistantAnswer(result) {
  if (!result || typeof result !== "object") return String(result || "Sin respuesta.");
  const parts = [result.answer || ""];
  if (Array.isArray(result.recommended_zones) && result.recommended_zones.length) {
    parts.push(`Zonas a mirar:\n${result.recommended_zones.map((item) => `- ${item}`).join("\n")}`);
  }
  if (Array.isArray(result.nearby_checks) && result.nearby_checks.length) {
    parts.push(`Cosas para verificar cerca:\n${result.nearby_checks.map((item) => `- ${item}`).join("\n")}`);
  }
  if (Array.isArray(result.follow_up_questions) && result.follow_up_questions.length) {
    parts.push(`Para afinar:\n${result.follow_up_questions.map((item) => `- ${item}`).join("\n")}`);
  }
  return parts.filter(Boolean).join("\n\n");
}

function preFilterForSearch(properties, query) {
  if (!query) return properties;
  const q = query.toLowerCase();
  const milMatch = q.match(/(\d[\d.]*)[\s]*(?:mil|k)(?:\s|$)/);
  const plainMatch = q.match(/\busd?\s*(\d{4,})\b/);
  let maxPrice = Infinity;
  if (milMatch) maxPrice = parseFloat(milMatch[1]) * 1000;
  else if (plainMatch) maxPrice = parseInt(plainMatch[1]);
  const bedMatch = q.match(/(\d+)\s*(?:dorm(?:itorios?)?|hab(?:itaciones?)?|cuartos?)/);
  const minBeds = bedMatch ? parseInt(bedMatch[1]) : 0;
  const filtered = properties.filter((p) => {
    if (maxPrice < Infinity && p.price > maxPrice * 1.1) return false;
    if (minBeds > 0 && (p.bedrooms || 0) < minBeds) return false;
    return true;
  });
  return filtered.length >= 1 ? filtered : properties;
}

function buildSearchPrompt(query, summaries) {
  const lines = summaries.map((p) =>
    `${p.id}: ${p.title}, ${p.type}, ${p.neighborhood}, USD ${p.price_usd}, ${p.bedrooms}d/${p.bathrooms}b, ${p.built_m2}m²` +
    (p.extras?.length ? `, ${p.extras.join(", ")}` : "")
  );
  return `Buscador inmobiliario Uruguay. Filtrá propiedades según la búsqueda del comprador.

Devolvé SOLO JSON: {"matching_ids":["id1","id2"],"explanation":"frase corta en español"}

- Solo IDs de propiedades que coincidan con la búsqueda.
- Ordenar matching_ids de mejor a peor.
- Si ninguna coincide, devolvé matching_ids vacío.

Búsqueda: ${query || "(sin texto)"}

Propiedades:
${lines.join("\n")}`;
}

async function* streamSearchCall(messages) {
  const response = await fetch(apiUrl("/api/openrouter/stream"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(settings.apiKey ? { "X-OpenRouter-Key": settings.apiKey } : {}),
    },
    body: JSON.stringify({ messages, temperature: 0.1, max_tokens: 400 }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(humanAiError(response.status, text));
  }
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ") && line !== "data: [DONE]") {
        try {
          const data = JSON.parse(line.slice(6));
          const content = data.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {}
      }
    }
  }
}

function scheduleAiSearch() {
  clearTimeout(aiSearchDebounceTimer);
  aiSearchDebounceTimer = setTimeout(() => {
    if ($("#aiSearchInput")?.value.trim().length >= 3) runAiPropertySearch();
  }, 300);
}

async function runAiPropertySearch() {
  const query = $("#aiSearchInput").value.trim();
  if (!query && !aiSearchImageDataUrl) return;
  clearTimeout(aiSearchDebounceTimer);
  $("#aiSearchBtn").disabled = true;
  setAiSearchProgress(true);
  rememberSearch(query);
  try {
    await nextFrameDelay();
    const source = state.properties.filter((p) => p.status === "published");
    const preFiltered = preFilterForSearch(source, query);
    const summaries = preFiltered.map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      neighborhood: p.neighborhood,
      city: p.city,
      price_usd: p.price,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      built_m2: builtAreaForValue(p),
      extras: (p.extras || []).map((e) => e.name || e).filter(Boolean),
      description: p.description,
    }));
    const visualCandidates = source
      .filter((p) => photoSrc(p.photos[0]))
      .slice(0, 10)
      .map((p) => ({ id: p.id, title: p.title, image: photoSrc(p.photos[0]) }));
    const prompt = buildSearchPrompt(query, summaries);
    const content = (aiSearchImageDataUrl || visualCandidates.length) && modelQueueSupportsVision(aiSearchImageDataUrl ? "vision" : "search")
      ? [
        { type: "text", text: prompt },
        ...(aiSearchImageDataUrl ? [{ type: "text", text: "Imagen de referencia del comprador:" }, { type: "image_url", image_url: { url: aiSearchImageDataUrl } }] : []),
        ...visualCandidates.flatMap((item, i) => [
          { type: "text", text: `Foto candidata ${i + 1}. property_id=${item.id}` },
          { type: "image_url", image_url: { url: item.image } },
        ]),
      ]
      : prompt;
    let accumulated = "";
    for await (const token of streamSearchCall([{ role: "user", content }])) {
      accumulated += token;
      const expMatch = accumulated.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (expMatch) setStreamingText(expMatch[1].replace(/\\n/g, " ").trim());
    }
    const result = parseLooseJson(accumulated) || {};
    const validIds = new Set(source.map((p) => p.id));
    state.aiSearchIds = (Array.isArray(result.matching_ids) ? result.matching_ids : []).filter((id) => validIds.has(id));
    state.aiSearchExplanation = result.explanation || `Filtro IA aplicado: ${query || "imagen de referencia"}`;
    saveState();
    renderMarketplace();
  } catch (error) {
    const fallback = query.toLowerCase();
    const source = state.properties.filter((p) => p.status === "published");
    const fallbackIds = source
      .filter((p) => `${p.title} ${p.neighborhood} ${p.city} ${p.description} ${JSON.stringify(p.extras || [])}`.toLowerCase().includes(fallback))
      .map((p) => p.id);
    state.aiSearchIds = fallbackIds.length ? fallbackIds : null;
    state.aiSearchExplanation = fallbackIds.length
      ? `No pude usar IA (${error.message}). Apliqué búsqueda textual sobre las fichas publicadas.`
      : `No pude usar IA (${error.message}). No apliqué filtro para no ocultar las propiedades publicadas.`;
    saveState();
    renderMarketplace();
  } finally {
    setAiSearchProgress(false);
    setStreamingText("");
    $("#aiSearchBtn").disabled = false;
  }
}

function setAiSearchProgress(active) {
  const progress = $("#aiSearchProgress");
  if (!progress) return;
  document.body.classList.toggle("ai-searching", Boolean(active));
  progress.classList.toggle("hidden", !active);
}

function setStreamingText(text) {
  const el = $("#aiStreamingText");
  if (el) el.textContent = text;
}

function nextFrameDelay() {
  return new Promise((resolve) => setTimeout(resolve, 180));
}

function clearAiSearch() {
  state.aiSearchIds = null;
  state.aiSearchExplanation = "";
  aiSearchImageDataUrl = "";
  $("#aiSearchInput").value = "";
  $("#aiSearchImageInput").value = "";
  renderAiSearchPreview();
  saveState();
  setSearchPanelOpen(false);
  renderMarketplace();
}

function renderAiSearchPreview() {
  const preview = $("#aiSearchImagePreview");
  const thumb = $("#aiSearchThumb");
  if (preview) {
    preview.classList.toggle("hidden", !aiSearchImageDataUrl);
    preview.innerHTML = aiSearchImageDataUrl ? `<img src="${aiSearchImageDataUrl}" alt=""><span>Imagen usada como referencia visual</span>` : "";
  }
  if (thumb) {
    thumb.classList.toggle("hidden", !aiSearchImageDataUrl);
    thumb.innerHTML = aiSearchImageDataUrl ? `<img src="${aiSearchImageDataUrl}" alt="">` : "";
  }
  renderSearchImageIdeas();
}

function deletePhotosByIds(ids) {
  if (!ids.length) return;
  const property = selectedProperty();
  property.photos = property.photos.filter((photo) => !ids.includes(photo.id));
  if (property.analysis) {
    property.analysis.summary = `${property.analysis.summary || ""}\n\nSe modifico la galeria despues del ultimo score. Recalcular recomendado.`.trim();
  }
  saveState();
  renderAll();
}

function bindClientDetailEvents() {
  const form = $("#chatForm");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      sendChatMessage($("#chatInput").value);
    });
  }
  const reset = $("#resetChatBtn");
  if (reset) {
    reset.addEventListener("click", () => {
      const property = selectedProperty();
      property.chatMessages = structuredClone(defaultState.chatMessages);
      saveState();
      renderChat();
    });
  }
  $$(".quick-prompts button").forEach((button) => {
    button.addEventListener("click", () => sendChatMessage(button.dataset.prompt));
  });
}

function applyScrapedData(scraped) {
  const property = selectedProperty();
  const data = scraped.data || {};
  property.sourceUrl = scraped.url;
  property.sourcePlatform = scraped.platform;
  property.title = data.title || property.title;
  property.description = data.description || property.description;
  property.price = data.priceUsd || data.price || property.price;
  property.neighborhood = data.neighborhood || property.neighborhood;
  property.city = data.city || property.city;
  property.lat = data.lat ?? property.lat;
  property.lng = data.lng ?? property.lng;
  property.lat = property.lat === "" ? "" : roundCoord(property.lat);
  property.lng = property.lng === "" ? "" : roundCoord(property.lng);
  property.mapUrl = data.mapUrl || property.mapUrl;
  hydrateCoordinatesFromMapUrl(property);
  property.type = normalizePropertyType(data.type || property.type);
  property.bedrooms = data.bedrooms ?? property.bedrooms;
  property.bathrooms = data.bathrooms ?? property.bathrooms;
  property.parking = data.parking ?? property.parking;
  property.builtArea = data.builtArea ?? property.builtArea;
  property.landArea = data.landArea ?? property.landArea;
  property.commonFees = data.commonFees ?? property.commonFees;
  property.extras = mergeExtras(property.extras || [], data.extras || []);
  if (!property.builtArea) property.builtArea = builtAreaForValue(property) || "";

  property.photos = property.photos.filter((photo) => !photo.source || photo.source === "manual");
  const existingUrls = new Set(property.photos.map((photo) => photo.url || photo.dataUrl));
  const importedUrls = dedupePropertyPhotoUrls((scraped.photos || []).filter((url) => looksLikePropertyPhoto({ url, name: url }))).slice(0, 80);
  importedUrls.forEach((url, index) => {
    if (existingUrls.has(url)) return;
    property.photos.push({
      id: uid("photo-url"),
      name: `Foto importada ${index + 1}`,
      type: "image/url",
      url,
      roomId: "",
      sourceUrl: scraped.url,
      source: scraped.platform || "scrape",
    });
  });
  property.videos = uniqueStrings([...(property.videos || []), ...(scraped.videos || [])]).slice(0, 12);
  saveState();
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function dedupePropertyPhotoUrls(urls) {
  const seen = new Set();
  return urls.filter((url) => {
    const key = photoDedupeKey(url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function photoDedupeKey(url = "") {
  try {
    const parsed = new URL(url);
    return (parsed.pathname.split("/").pop() || parsed.pathname)
      .toLowerCase()
      .replace(/[_-](small|thumb|thumbnail|medium|large|original|webp|jpg|jpeg|png)/g, "")
      .replace(/[_-]?\d{2,4}x\d{2,4}/g, "")
      .replace(/\.(jpe?g|png|webp)$/i, "");
  } catch {
    return String(url).toLowerCase().split("?")[0];
  }
}

function mergeExtras(current, incoming) {
  const byLabel = new Map(current.filter((item) => item.label && item.value).map((item) => [item.label, item]));
  incoming.filter((item) => item.label && item.value).forEach((item) => {
    if (!byLabel.has(item.label)) byLabel.set(item.label, item);
  });
  return [...byLabel.values()];
}

async function filterImportedPhotos({ silent = false } = {}) {
  const property = selectedProperty();
  const imported = property.photos.filter((photo) => photo.source && photo.source !== "manual");
  if (!imported.length) {
    if (!silent) alert("No hay fotos importadas para filtrar.");
    return "";
  }

  let removeIds = [];
  let mode = "limpieza basica";
  removeIds = imported.filter((photo) => !looksLikePropertyPhoto(photo)).map((photo) => photo.id);

  const modelForPhotos = modelForFunction("vision");
  if ((settings.apiKey || serverConfig.openRouterConfigured) && modelQueueSupportsVision("vision")) {
    mode = "limpieza basica + IA vision";
    try {
      const candidates = imported.filter((photo) => !removeIds.includes(photo.id)).slice(0, 24);
      const content = [
        {
          type: "text",
          text: `Clasifica estas imagenes importadas de un portal inmobiliario. Queremos conservar solo fotos reales de la propiedad: fachada, ambientes, baños, cocina, terraza, jardín, amenities o plano util. Elimina logos, mapas, fotos de perfil, banners, placeholders, iconos, capturas de UI, fotos repetidas o imagenes que no ayudan a evaluar la casa.

Devuelve JSON valido:
{
  "keep_photo_ids": string[],
  "remove_photo_ids": string[],
  "reason": string
}

Fotos:
${JSON.stringify(candidates.map((photo) => ({ id: photo.id, name: photo.name, url: photo.url })), null, 2)}`,
        },
        ...candidates.map((photo) => ({
          type: "image_url",
          image_url: { url: photoSrc(photo) },
        })),
      ];
      const result = await callOpenRouter({
        functionType: "vision",
        messages: [{ role: "user", content }],
      });
      removeIds = uniqueStrings([...removeIds, ...(Array.isArray(result.remove_photo_ids) ? result.remove_photo_ids : [])]);
    } catch (error) {
      mode = "limpieza basica por fallo IA";
    }
  }

  const before = property.photos.length;
  const seen = new Set();
  property.photos = property.photos.filter((photo) => {
    if (removeIds.includes(photo.id)) return false;
    if (!photo.source || photo.source === "manual") return true;
    const key = photoDedupeKey(photo.url || photo.dataUrl || photo.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  saveState();
  renderAll();
  const removed = before - property.photos.length;
  const report = `Filtro de fotos: ${removed} removidas (${mode}).`;
  if (!silent) alert(report);
  return report;
}

function looksLikePropertyPhoto(photo) {
  const value = `${photo.name || ""} ${photo.url || ""}`.toLowerCase();
  const bad = [
    "logo", "avatar", "profile", "perfil", "map", "mapa", "staticmap", "icon", "sprite", "placeholder", "blank", "default", "favicon",
    "marker", "pin", "agency", "agencia", "banner", "facebook", "instagram", "whatsapp", "youtube", "google", "apple", "appstore",
    "app-store", "playstore", "googleplay", "google-play", "store", "disponible", "available", "download", "descarga", "flag", "flags",
    "bandera", "country", "countries", "pais", "país", "search", "lupa", "magnif", "qr", "badge", "award", "medal",
  ];
  if (bad.some((token) => value.includes(token))) return false;
  if (/\b(16x16|32x32|48x48|64x64|80x80|100x100|150x150|200x200)\b/i.test(value)) return false;
  if (!/\.(jpe?g|png|webp)(\?|$)/i.test(value)) return false;
  return true;
}

async function generateReport() {
  const property = selectedProperty();
  $("#generateReportBtn").disabled = true;
  $("#generateReportBtn").textContent = "Creando...";
  try {
    if (settings.apiKey || serverConfig.openRouterConfigured) {
      property.report = await callOpenRouter({
        functionType: "score",
        messages: [{
          role: "user",
          content: `Genera un informe comercial-tecnico breve para esta propiedad owner-direct. Devuelve JSON valido:
{
  "title": string,
  "summary": string,
  "sections": [{"title": string, "body": string}]
}

Datos:
${JSON.stringify(propertyPrompt(property), null, 2)}

Score:
${JSON.stringify(property.analysis || {}, null, 2)}`,
        }],
      });
    } else {
      property.report = buildLocalReport(property);
    }
    saveState();
    renderReport();
  } catch (error) {
    property.report = buildLocalReport(property, `No se pudo usar IA: ${error.message}`);
    saveState();
    renderReport();
  } finally {
    $("#generateReportBtn").disabled = false;
    $("#generateReportBtn").textContent = "Crear informe";
  }
}

function buildLocalReport(property, note = "") {
  const missing = missingFields(property);
  return {
    title: `Informe - ${property.title || "Propiedad"}`,
    summary: `${property.type || "Propiedad"} en ${property.neighborhood || "zona pendiente"} con precio ${formatUsd(Number(property.price))}. ${note}`.trim(),
    sections: [
      { title: "Datos principales", body: `${property.bedrooms || 0} dormitorios, ${property.bathrooms || 0} baños, ${property.builtArea || "--"} m² cubiertos y ${property.landArea || "--"} m² de terreno.` },
      { title: "Score", body: property.score ? `Score OD ${Number(property.score).toFixed(1)}. ${property.analysis?.summary || ""}` : "Score pendiente de cálculo." },
      { title: "Documentación", body: verifiedDocumentTypes(property).length ? `Documentos cargados: ${verifiedDocumentTypes(property).join(", ")}.` : "No hay documentación verificable cargada todavía." },
      { title: "Pendientes", body: missing.length ? missing.join(", ") : "Sin pendientes críticos en la ficha básica." },
    ],
  };
}

function normalizePropertyType(value = "") {
  const lower = String(value).toLowerCase();
  if (lower.includes("apart")) return "Apartamento";
  if (lower.includes("terreno")) return "Terreno";
  if (lower.includes("chacra")) return "Chacra";
  if (lower.includes("local")) return "Local";
  return "Casa";
}

function guessDocumentKind(name = "") {
  const value = name.toLowerCase();
  if (value.includes("ute")) return "Factura UTE";
  if (value.includes("ose")) return "Factura OSE";
  if (value.includes("antel") || value.includes("internet")) return "Factura Antel";
  if (value.includes("gasto")) return "Gastos comunes";
  if (value.includes("contrib")) return "Contribucion";
  if (value.includes("primaria")) return "Primaria";
  if (value.includes("seguro")) return "Seguro hogar";
  if (value.includes("plano")) return "Plano aprobado";
  return "Otro";
}

function missingFields(property) {
  const checks = [
    ["Precio", property.price],
    ["Barrio", property.neighborhood],
    ["Ciudad", property.city],
    ["Dormitorios", property.bedrooms],
    ["Banos", property.bathrooms],
    ["Cocheras", property.parking],
    ["m² cubiertos", property.builtArea],
    ["m² terreno", property.landArea],
    ["Gastos comunes", property.commonFees],
    ["Factura UTE", verifiedDocumentTypes(property).includes("Factura UTE") || property.uteAvg],
    ["Factura OSE", verifiedDocumentTypes(property).includes("Factura OSE") || property.oseAvg],
    ["Documento gastos comunes", verifiedDocumentTypes(property).includes("Gastos comunes") || property.commonFees],
    ["Año de construccion", property.yearBuilt],
    ["Coordenadas", property.lat && property.lng],
    ["Planos", property.plans.length],
    ["Fotos suficientes", property.photos.length >= 8],
  ];
  return checks.filter(([, value]) => value === "" || value === null || value === undefined || value === false || value === 0).map(([label]) => label);
}

function bindEvents() {
  $$(".nav-btn").forEach((button) => button.addEventListener("click", () => {
    if (!canAccessView(button.dataset.view)) {
      setView("marketplace");
      return;
    }
    if (button.dataset.view === "editor") {
      startCreateProperty();
      return;
    }
    state.editorMode = "edit";
    setView(button.dataset.view);
  }));
  $("#topRoleNav")?.addEventListener("click", (event) => {
    const view = event.target.dataset.topView;
    if (!view) return;
    if (!canAccessView(view)) {
      setView("marketplace");
      return;
    }
    if (view === "editor") {
      startCreateProperty();
      return;
    }
    state.editorMode = "edit";
    setView(view);
  });
  $("#sidebarToggle").addEventListener("click", () => {
    document.body.classList.toggle("sidebar-collapsed");
    localStorage.setItem("od-sidebar-collapsed", document.body.classList.contains("sidebar-collapsed") ? "1" : "0");
  });
  $("#loginBtn").addEventListener("click", () => {
    $("#loginOutput").classList.add("hidden");
    $("#loginDialog").showModal();
  });
  $("#logoutBtn").addEventListener("click", logout);
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const output = $("#loginOutput");
    output.classList.remove("hidden");
    output.textContent = "Ingresando...";
    try {
      await loginWithCredentials($("#loginEmailInput").value.trim(), $("#loginPasswordInput").value);
      $("#loginDialog").close();
      output.classList.add("hidden");
    } catch (error) {
      output.textContent = error.message;
    }
  });
  $("#newPropertyBtn").addEventListener("click", addProperty);
  $("#duplicatePropertyBtn").addEventListener("click", duplicateProperty);
  ["#activePropertySelect"].forEach((selector) => {
    const select = $(selector);
    if (!select) return;
    select.addEventListener("change", () => {
      if (select.value === "__draft") return;
      state.editorMode = "edit";
      state.draftProperty = null;
      state.selectedId = select.value;
      saveState();
      renderAll();
    });
  });
  $("#searchInput").addEventListener("input", renderProperties);
  ["#statusFilter", "#scoreFilter", "#completionFilter"].forEach((selector) => {
    const element = $(selector);
    if (element) element.addEventListener("change", renderProperties);
  });
  $("#propertyGrid").addEventListener("click", (event) => {
    const deleteId = event.target.dataset.deleteProperty;
    const editId = event.target.dataset.editProperty;
    const publishId = event.target.dataset.publishProperty;
    const unpublishId = event.target.dataset.unpublishProperty;
    if (publishId) {
      publishProperty(publishId, "published");
      return;
    }
    if (unpublishId) {
      publishProperty(unpublishId, "draft");
      return;
    }
    if (deleteId) {
      deleteProperty(deleteId);
      return;
    }
    if (editId) {
      state.selectedId = editId;
      state.editorMode = "edit";
      state.draftProperty = null;
      saveState();
      setView("editor");
    }
  });
  ["#clientSearchInput", "#clientTypeFilter", "#clientMaxPriceInput", "#clientBedroomsFilter"].forEach((selector) => {
    const element = $(selector);
    if (element) element.addEventListener("input", renderMarketplace);
    if (element) element.addEventListener("change", renderMarketplace);
  });
  $("#aiSearchBtn").addEventListener("click", runAiPropertySearch);
  $("#clearAiSearchBtn").addEventListener("click", clearAiSearch);
  $(".roomix-search-input")?.addEventListener("click", (event) => {
    setSearchPanelOpen(true);
    if (!event.target.closest("input, button, label")) $("#aiSearchInput")?.focus();
  });
  $("#aiSearchInput").addEventListener("focus", () => setSearchPanelOpen(true));
  $("#aiSearchInput").addEventListener("input", () => {
    setSearchPanelOpen(true);
    renderSearchUi();
    scheduleAiSearch();
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest(".ai-search-hero")) return;
    if ($("#aiSearchInput")?.value || aiSearchImageDataUrl || state.aiSearchExplanation) return;
    setSearchPanelOpen(false);
  });
  $("#clientPropertyGrid").addEventListener("click", (event) => {
    const openId = event.target.dataset.openPublicProperty;
    const favoriteId = event.target.dataset.favoriteProperty;
    if (openId) {
      openPropertyModal(openId);
      return;
    }
    if (favoriteId) {
      state.favoriteIds = state.favoriteIds.includes(favoriteId)
        ? state.favoriteIds.filter((id) => id !== favoriteId)
        : [...state.favoriteIds, favoriteId];
      saveState();
      renderMarketplace();
    }
  });
  $("#suggestionChips")?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-suggestion]");
    if (!chip) return;
    const input = $("#aiSearchInput");
    if (!input) return;
    input.value = chip.dataset.suggestion;
    setSearchPanelOpen(true);
    renderSearchUi();
    scheduleAiSearch();
    input.focus();
  });
  $("#searchModeToggle").addEventListener("click", (event) => {
    const button = event.target.closest("[data-search-mode]");
    const mode = button?.dataset.searchMode;
    if (!mode) return;
    state.searchMode = mode;
    saveState();
    renderMarketplace();
  });
  $("#recentSearches").addEventListener("click", (event) => {
    const query = event.target.dataset.recentSearch;
    if (!query) return;
    $("#aiSearchInput").value = query;
    runAiPropertySearch();
  });
  $("#refinementChips").addEventListener("click", (event) => {
    const refine = event.target.dataset.aiRefine;
    if (!refine) return;
    $("#aiSearchInput").value = `${$("#aiSearchInput").value.trim()} ${refine}`.trim();
    runAiPropertySearch();
  });
  $$("[data-ai-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#aiSearchInput").value = button.dataset.aiPrompt;
      runAiPropertySearch();
    });
  });
  $("#aiSearchInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") runAiPropertySearch();
  });
  $("#aiSearchImageInput").addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) {
      aiSearchImageDataUrl = "";
      renderAiSearchPreview();
      return;
    }
    const [{ dataUrl }] = await filesToDataUrls([file]);
    aiSearchImageDataUrl = dataUrl;
    renderAiSearchPreview();
  });
  $("#searchImageIdeas")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-search-image-idea]");
    if (!button) return;
    const property = state.properties.find((item) => item.id === button.dataset.searchImageIdea);
    const src = property ? photoSrc(property.photos[0]) : "";
    if (!src) return;
    aiSearchImageDataUrl = src;
    renderAiSearchPreview();
    runAiPropertySearch();
  });
  $("#searchImageIdeas")?.addEventListener("change", async (event) => {
    if (event.target.id !== "aiSearchImageInputMirror") return;
    const [file] = event.target.files;
    if (!file) return;
    const [{ dataUrl }] = await filesToDataUrls([file]);
    aiSearchImageDataUrl = dataUrl;
    renderAiSearchPreview();
    runAiPropertySearch();
  });
  $$("[data-client-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.clientView = button.dataset.clientView;
      saveState();
      renderMarketplace();
    });
  });
  $$("[data-editor-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editorTab = button.dataset.editorTab;
      saveState();
      setView("editor");
    });
  });
  $("#editorProgress")?.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-progress-tab]")?.dataset.progressTab;
    if (!tab) return;
    state.editorTab = tab;
    saveState();
    setView("editor");
  });
  $("#wizardControls")?.addEventListener("click", (event) => {
    if (event.target.dataset.wizardPrev !== undefined) {
      goWizard(-1);
      return;
    }
    if (event.target.dataset.wizardNext !== undefined) {
      goWizard(1);
      return;
    }
    if (event.target.dataset.wizardPublish !== undefined) {
      const property = selectedProperty();
      if (state.editorMode === "create") {
        saveDraftProperty();
        if (state.selectedId) publishProperty(state.selectedId, "published");
      } else {
        publishProperty(property.id, "published");
      }
    }
  });

  $("#propertyForm").addEventListener("submit", (event) => {
    event.preventDefault();
    savePropertyForm();
  });

  $("#propertyForm").addEventListener("change", updateSelectedFromForm);
  $("#propertyForm").addEventListener("input", updateSelectedFromForm);
  $("#propertyForm").addEventListener("focusout", () => showToast("Guardado"));

  $$('input[name="publishedElsewhere"]').forEach((input) => {
    input.addEventListener("change", () => {
      $("#scrapeBox").classList.toggle("hidden", input.value !== "yes" || !input.checked);
      if (input.value === "no" && input.checked && state.editorTab === "import") {
        state.editorTab = "data";
        saveState();
        renderEditorTabs();
        renderEditorProgress();
      }
    });
  });
  $("#scrapeBtn").addEventListener("click", runScrape);

  $("#addRoomBtn").addEventListener("click", () => {
    const property = selectedProperty();
    property.rooms.push(room(uid("room"), "Nuevo ambiente", "Dormitorio", "PB", "", ""));
    saveState();
    renderRooms();
  });

  $("#roomsList").addEventListener("input", updateRoomFromEvent);
  $("#roomsList").addEventListener("change", updateRoomFromEvent);
  $("#roomsList").addEventListener("click", (event) => {
    const id = event.target.dataset.removeRoom;
    if (!id) return;
    const property = selectedProperty();
    property.rooms = property.rooms.filter((item) => item.id !== id);
    saveState();
    renderRooms();
  });

  $("#photoInput").addEventListener("change", async (event) => {
    const property = selectedProperty();
    const files = await filesToDataUrls(event.target.files);
    property.photos.push(...files.map(({ file, dataUrl }) => ({ id: uid("photo"), name: file.name, type: file.type, dataUrl, roomId: "" })));
    event.target.value = "";
    saveState();
    renderAll();
  });

  $("#photoGrid").addEventListener("change", (event) => {
    const id = event.target.dataset.photoRoom;
    if (!id) return;
    const photo = selectedProperty().photos.find((item) => item.id === id);
    photo.roomId = event.target.value;
    saveState();
  });

  $("#photoGrid").addEventListener("click", (event) => {
    const id = event.target.dataset.deletePhoto;
    if (!id) return;
    deletePhotosByIds([id]);
  });

  $("#photoGrid").addEventListener("dragstart", (event) => {
    const id = event.target.closest("[data-photo-card]")?.dataset.photoCard;
    if (id) event.dataTransfer.setData("text/plain", id);
  });
  $("#photoGrid").addEventListener("dragover", (event) => {
    if (event.target.closest("[data-photo-card]")) event.preventDefault();
  });
  $("#photoGrid").addEventListener("drop", (event) => {
    const fromId = event.dataTransfer.getData("text/plain");
    const toId = event.target.closest("[data-photo-card]")?.dataset.photoCard;
    if (!fromId || !toId || fromId === toId) return;
    const property = selectedProperty();
    const fromIndex = property.photos.findIndex((photo) => photo.id === fromId);
    const toIndex = property.photos.findIndex((photo) => photo.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = property.photos.splice(fromIndex, 1);
    property.photos.splice(toIndex, 0, moved);
    saveState();
    renderPhotos();
  });

  $("#deleteSelectedPhotosBtn").addEventListener("click", () => {
    const ids = $$("[data-photo-select]:checked").map((input) => input.dataset.photoSelect);
    if (!ids.length) {
      alert("Seleccioná al menos una foto para borrar.");
      return;
    }
    deletePhotosByIds(ids);
  });

  $("#deleteImportedPhotosBtn").addEventListener("click", () => {
    const ids = selectedProperty().photos.filter((photo) => photo.source && photo.source !== "manual").map((photo) => photo.id);
    if (!ids.length) {
      alert("No hay fotos importadas para borrar.");
      return;
    }
    deletePhotosByIds(ids);
  });

  $("#filterImportedPhotosBtn").addEventListener("click", () => filterImportedPhotos());

  $("#keepFirstPhotosBtn").addEventListener("click", () => {
    const property = selectedProperty();
    property.photos = property.photos.slice(0, 12);
    saveState();
    renderAll();
  });

  $("#planInput").addEventListener("change", async (event) => {
    const property = selectedProperty();
    const files = await filesToDataUrls(event.target.files);
    property.plans.push(...files.map(({ file, dataUrl }, index) => ({
      id: uid("plan"),
      name: file.name,
      type: file.type || "application/pdf",
      floor: index === 0 ? "Planta baja" : `Planta ${index + 1}`,
      dataUrl,
    })));
    event.target.value = "";
    saveState();
    renderAll();
  });

  $("#planList").addEventListener("click", (event) => {
    const id = event.target.dataset.removePlan;
    if (!id) return;
    const property = selectedProperty();
    property.plans = property.plans.filter((item) => item.id !== id);
    saveState();
    renderPlans();
  });

  $("#documentInput").addEventListener("change", async (event) => {
    const property = selectedProperty();
    const files = await filesToDataUrls(event.target.files);
    property.documents.push(...files.map(({ file, dataUrl }) => ({
      id: uid("doc"),
      name: file.name,
      type: file.type || "documento",
      dataUrl,
      kind: guessDocumentKind(file.name),
    })));
    event.target.value = "";
    saveState();
    renderAll();
  });

  $("#documentsList").addEventListener("change", (event) => {
    const id = event.target.dataset.documentKind;
    if (!id) return;
    const documentItem = selectedProperty().documents.find((item) => item.id === id);
    documentItem.kind = event.target.value;
    saveState();
    renderDocuments();
  });

  $("#documentsList").addEventListener("click", (event) => {
    const id = event.target.dataset.deleteDocument;
    if (!id) return;
    const property = selectedProperty();
    property.documents = property.documents.filter((item) => item.id !== id);
    saveState();
    renderAll();
  });

  $("#saveSettingsBtn").addEventListener("click", () => {
    settings.apiKey = $("#apiKeyInput").value.trim();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    saveAiModelConfig();
  });
  $("#testAiBtn").addEventListener("click", testAiConnection);
  $("#resetAiConfigBtn").addEventListener("click", () => {
    aiModelConfig = defaultAiModelConfig("balanced");
    saveAiModelConfig();
  });
  $("#modelProfileSelect").addEventListener("change", (event) => {
    aiModelConfig = defaultAiModelConfig(event.target.value);
    saveAiModelConfig();
  });
  $("#modelManagerGrid").addEventListener("change", (event) => {
    const functionType = event.target.dataset.aiActiveModel;
    if (!functionType) return;
    aiModelConfig.functions[functionType].activeModel = event.target.value;
    aiModelConfig.functions[functionType].fallbacks = aiModelConfig.functions[functionType].fallbacks.filter((model) => model !== event.target.value);
    aiModelConfig.functions[functionType].status = "unknown";
    saveAiModelConfig();
  });
  $("#modelManagerGrid").addEventListener("click", async (event) => {
    const addKey = event.target.dataset.addFallback;
    const removeKey = event.target.dataset.removeFallback;
    const testKey = event.target.dataset.testModel;
    if (addKey) {
      const input = $(`[data-ai-custom-model="${addKey}"]`);
      const value = input.value.trim();
      if (!value) return;
      aiModelConfig.functions[addKey].fallbacks = uniqueStrings([...aiModelConfig.functions[addKey].fallbacks, value]).filter((model) => model !== aiModelConfig.functions[addKey].activeModel);
      input.value = "";
      saveAiModelConfig();
      return;
    }
    if (removeKey) {
      const model = event.target.dataset.model;
      aiModelConfig.functions[removeKey].fallbacks = aiModelConfig.functions[removeKey].fallbacks.filter((item) => item !== model);
      saveAiModelConfig();
      return;
    }
    if (testKey) {
      $("#aiTestOutput").classList.remove("hidden");
      $("#aiTestOutput").textContent = `Probando ${AI_FUNCTIONS[testKey].label}...`;
      const result = await testModelFunction(testKey);
      $("#aiTestOutput").innerHTML = result.ok
        ? `<strong>Modelo activo.</strong><br>${escapeHtml(AI_FUNCTIONS[testKey].label)} usando ${escapeHtml(result.model)}`
        : `<strong>Falló el test.</strong><br>${escapeHtml(result.error)}`;
    }
  });
  $("#modelManagerGrid").addEventListener("dragstart", (event) => {
    const row = event.target.closest("[data-fallback-function]");
    if (!row) return;
    event.dataTransfer.setData("text/plain", `${row.dataset.fallbackFunction}:${row.dataset.fallbackIndex}`);
  });
  $("#modelManagerGrid").addEventListener("dragover", (event) => {
    if (event.target.closest("[data-fallback-function]")) event.preventDefault();
  });
  $("#modelManagerGrid").addEventListener("drop", (event) => {
    const row = event.target.closest("[data-fallback-function]");
    if (!row) return;
    const [fromFunction, fromIndexRaw] = event.dataTransfer.getData("text/plain").split(":");
    const toFunction = row.dataset.fallbackFunction;
    const toIndex = Number(row.dataset.fallbackIndex);
    const fromIndex = Number(fromIndexRaw);
    if (!fromFunction || fromFunction !== toFunction || fromIndex === toIndex) return;
    const queue = aiModelConfig.functions[toFunction].fallbacks;
    const [moved] = queue.splice(fromIndex, 1);
    queue.splice(toIndex, 0, moved);
    saveAiModelConfig();
  });

  $("#runAiBtn").addEventListener("click", runPhotoAnalysis);
  $("#runPlanAiBtn").addEventListener("click", runPlanAnalysis);
  $("#generateReportBtn").addEventListener("click", generateReport);
  $("#publishFromEditorBtn")?.addEventListener("click", () => {
    const property = selectedProperty();
    if (state.editorMode === "create") {
      saveDraftProperty();
      if (state.selectedId) publishProperty(state.selectedId, "published");
      return;
    }
    publishProperty(property.id, "published");
  });

  $("#chatBubbleBtn").addEventListener("click", () => {
    $("#chatWidget").classList.toggle("hidden");
    renderChat();
  });
  $("#closeChatBtn").addEventListener("click", () => $("#chatWidget").classList.add("hidden"));
  $("#closePropertyModalBtn").addEventListener("click", () => {
    $("#propertyModal").close();
    closeRoomSheet();
    history.replaceState(null, "", location.pathname);
  });
  $("#propertyModalContent").addEventListener("click", (event) => {
    const tabBtn = event.target.closest("[data-modal-tab]");
    if (tabBtn) {
      const tab = tabBtn.dataset.modalTab;
      $$("#propertyModalContent [data-modal-tab]").forEach((btn) => btn.classList.toggle("active", btn.dataset.modalTab === tab));
      $$("#propertyModalContent [data-modal-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.modalPanel === tab));
      history.replaceState(null, "", "#" + tab);
      return;
    }
    const roomCard = event.target.closest("[data-room-id]");
    if (roomCard) {
      const property = state.properties.find((item) => item.id === state.selectedId) || selectedProperty();
      const room = (property?.rooms || []).find((r) => r.id === roomCard.dataset.roomId);
      if (!room || !property) return;
      const scoreBubble = roomCard.querySelector(".room-score-bubble");
      if (scoreBubble && room.score !== null && room.score !== undefined) {
        animateRoomScore(scoreBubble, Number(room.score));
      }
      if (window.innerWidth < 768) {
        openRoomSheet(room, property);
      } else {
        const inline = $("#roomDetailInline");
        if (!inline) return;
        const improvements = (property.analysis?.improvements || []).slice(0, 3);
        inline.classList.remove("hidden");
        inline.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div>
              <strong style="font-size:16px">${escapeHtml(room.name)}</strong>
              <p style="font-size:12px;color:var(--muted);margin-top:2px">${[room.type, room.floor ? `Planta ${room.floor}` : "", room.area ? `${room.area} m²` : ""].filter(Boolean).join(" · ")}</p>
            </div>
            ${room.score ? `<strong style="font-size:28px;color:var(--green)">${Number(room.score).toFixed(1)}★</strong>` : ""}
          </div>
          ${room.notes ? `<p style="font-size:13px;line-height:1.6;margin-bottom:14px">${escapeHtml(room.notes)}</p>` : ""}
          ${improvements.length ? `<h4 style="font-size:13px;margin-bottom:8px">Mejoras sugeridas</h4><div class="mejoras-list">${improvements.map((item) => `<div class="mejora-item">${escapeHtml(item)}</div>`).join("")}</div>` : ""}
        `;
        inline.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  });
  $("#chatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    sendChatMessage($("#chatInput").value);
  });
  $$(".quick-prompts button").forEach((button) => {
    button.addEventListener("click", () => sendChatMessage(button.dataset.prompt));
  });

  $("#manualScoreBtn").addEventListener("click", () => $("#manualDialog").showModal());
  $("#saveManualScoreBtn").addEventListener("click", () => {
    const property = selectedProperty();
    property.score = Number($("#manualScoreInput").value);
    property.manualScoreNote = $("#manualNoteInput").value;
    property.analysis = property.analysis || {};
    property.analysis.summary = `${property.analysis.summary || ""}\n\nAjuste manual: ${property.manualScoreNote || "sin nota"}`.trim();
    saveState();
    renderAll();
  });
}

function updateRoomFromEvent(event) {
  const id = event.target.dataset.room;
  const field = event.target.dataset.field;
  if (!id || !field) return;
  const item = selectedProperty().rooms.find((roomItem) => roomItem.id === id);
  item[field] = field === "area" ? (event.target.value === "" ? "" : Number(event.target.value)) : event.target.value;
  item.confirmed = true;
  saveState();
}

bindEvents();
$("#roomSheetOverlay")?.addEventListener("click", closeRoomSheet);
if (localStorage.getItem("od-sidebar-collapsed") === "1") document.body.classList.add("sidebar-collapsed");
setView(location.pathname === "/admin/ai" ? "settings" : "marketplace");
loadServerConfig();
