const STORAGE_KEY = "od-demo-state-v1";
const SETTINGS_KEY = "od-demo-settings-v1";
const AUTH_KEY = "od-demo-auth-v1";
const LOCAL_API_BASE = "http://127.0.0.1:4173";
const DEFAULT_MODEL = "google/gemma-4-31b-it:free";

const defaultState = {
  selectedId: "demo-casa-i08",
  editorMode: "edit",
  draftProperty: null,
  clientView: "list",
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
let authSession = loadAuthSession();
let serverConfig = {};
let remoteSaveTimer = null;
let loadingRemote = false;
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
  nextState.clientView ||= "list";
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
    if (!next.model || next.model.includes("gpt-oss")) next.model = DEFAULT_MODEL;
    if (!next.planModel || next.planModel.includes("gpt-oss")) next.planModel = next.model;
    return next;
  } catch {
    return { model: DEFAULT_MODEL, planModel: DEFAULT_MODEL };
  }
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
  $("#pageTitle").textContent = {
    properties: "Propiedades",
    marketplace: "Portal cliente",
    editor: "Cargar propiedad",
    settings: "OpenRouter",
  }[view];
  $("#newPropertyBtn").classList.toggle("hidden", view === "marketplace" || !canManageProperties());
  $("#chatBubbleBtn").classList.toggle("hidden", view !== "marketplace");
  if (view !== "marketplace") $("#chatWidget").classList.add("hidden");
  renderAll();
}

function emptyNode() {
  return $("#emptyTemplate").content.firstElementChild.cloneNode(true);
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

function statusText(status) {
  return { draft: "Borrador", review: "En revision", published: "Publicada" }[status] || status;
}

function renderAll() {
  renderAuth();
  renderSettings();
  renderMarketplace();
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
  $("#modelInput").value = settings.model || serverConfig.defaultModel || DEFAULT_MODEL;
  $("#planModelInput").value = settings.planModel || settings.model || serverConfig.defaultModel || DEFAULT_MODEL;
  const configured = Boolean(settings.apiKey || serverConfig.openRouterConfigured);
  $("#aiStatus").textContent = configured ? (settings.apiKey ? "OpenRouter configurado" : "OpenRouter en servidor") : "OpenRouter sin configurar";
  $("#aiStatus").className = configured ? "status-pill" : "status-pill warn";
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
  await loadRemoteProperties();
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
      renderAll();
    } else if (state.properties.length && canManageProperties()) {
      await syncRemoteProperties();
    }
  } catch (error) {
    console.warn("No se pudo cargar Supabase", error);
  } finally {
    loadingRemote = false;
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

function renderProperties() {
  const grid = $("#propertyGrid");
  const query = $("#searchInput").value.trim().toLowerCase();
  const status = $("#statusFilter").value;
  const properties = backofficeProperties().filter((property) => {
    const haystack = `${property.title} ${property.neighborhood} ${property.city}`.toLowerCase();
    return haystack.includes(query) && (status === "all" || property.status === status);
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

function renderMarketplace() {
  const grid = $("#clientPropertyGrid");
  const map = $("#mapCanvas");
  if (!grid || !map) return;
  $("#clientListPane").classList.toggle("hidden", state.clientView === "map");
  $("#clientMapPane").classList.toggle("hidden", state.clientView !== "map");
  $$("[data-client-view]").forEach((button) => button.classList.toggle("active", button.dataset.clientView === state.clientView));
  const properties = clientFilteredProperties();
  const aiOutput = $("#aiSearchOutput");
  if (aiOutput) {
    aiOutput.classList.toggle("hidden", !state.aiSearchExplanation);
    aiOutput.innerHTML = state.aiSearchExplanation ? `<strong>Búsqueda IA activa.</strong><br>${escapeHtml(state.aiSearchExplanation)}` : "";
  }
  $("#view-marketplace .client-layout")?.classList.toggle("map-mode", state.clientView === "map");
  grid.innerHTML = "";

  if (!properties.length) {
    grid.appendChild(emptyNode());
    renderLeafletMap([]);
    return;
  }

  properties.forEach((property, index) => {
    const card = document.createElement("article");
    card.className = "property-card";
    const cover = photoSrc(property.photos[0]);
    const score = property.score ? Number(property.score).toFixed(1) : "--";
    card.innerHTML = `
      <div class="property-media">${cover ? `<img src="${cover}" alt="">` : "Sin foto principal"}</div>
      <div class="property-body">
        <h3>${escapeHtml(property.title || "Propiedad sin titulo")}</h3>
        <div class="meta">
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

function renderEditorTabs() {
  $$("[data-editor-tab]").forEach((button) => button.classList.toggle("active", button.dataset.editorTab === state.editorTab));
  $$("[data-editor-panel]").forEach((panel) => panel.classList.toggle("hidden", panel.dataset.editorPanel !== state.editorTab));
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
  const property = selectedProperty();
  const content = $("#propertyModalContent");
  if (!property || !content) return;
  const cover = photoSrc(property.photos[0]);
  const docs = verifiedDocumentTypes(property);
  $("#modalTitle").textContent = property.title || "Propiedad";
  const photos = property.photos.filter((photo) => photoSrc(photo)).slice(0, 12);
  content.innerHTML = `
    <div class="modal-layout">
      <div>
        <div class="modal-gallery">
          ${photos.length ? photos.map((photo) => `<img src="${photoSrc(photo)}" alt="">`).join("") : `<div class="placeholder">Sin fotos cargadas</div>`}
        </div>
        ${property.videos.length ? `<div class="modal-section"><h3>Videos</h3><div class="video-links">${property.videos.map((url, index) => `<a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">Video ${index + 1}</a>`).join(" ")}</div></div>` : ""}
        ${property.description ? `<div class="modal-section"><h3>Descripción</h3><p class="public-description">${escapeHtml(property.description)}</p></div>` : ""}
        <div class="modal-section">
          <h3>Información de la propiedad</h3>
          <div class="extra-list">
            ${propertyInfoRows(property)}
            ${renderPublicExtrasRows(property)}
          </div>
        </div>
      </div>

      <div>
        <div class="modal-section">
          <p class="eyebrow">Resumen</p>
          <h2>${escapeHtml(property.title || "Propiedad sin titulo")}</h2>
          <div class="meta">${escapeHtml(property.address || property.neighborhood || "Ubicación pendiente")} · ${escapeHtml(property.city || "")}</div>
        <div class="price-row">
          <span>${formatUsd(Number(property.price))}</span>
          <span class="status-pill">${property.score ? Number(property.score).toFixed(1) : "--"} OD</span>
        </div>
        <div class="detail-stats">
          <span class="status-pill">${property.bedrooms || 0} dorm.</span>
          <span class="status-pill">${property.bathrooms || 0} banos</span>
          <span class="status-pill">${builtAreaForValue(property) || "--"} m² edif.</span>
          <span class="status-pill">${property.landArea || "--"} m² terreno</span>
          <span class="status-pill">${pricePerM2Label(property)}</span>
        </div>
        <div class="doc-badges">
          ${docs.length ? docs.map((doc) => `<span class="status-pill">${escapeHtml(doc)}</span>`).join("") : `<span class="status-pill warn">Costos sin verificar</span>`}
        </div>
        ${property.mapUrl ? `<a class="source-map-link" href="${escapeAttr(property.mapUrl)}" target="_blank" rel="noreferrer">Abrir mapa fuente</a>` : ""}
        </div>

        <div class="modal-section score-public">
          <h3>Score OD</h3>
          <div class="score-value">${property.score ? Number(property.score).toFixed(1) : "--"}</div>
          ${property.analysis?.summary ? `<p>${escapeHtml(property.analysis.summary)}</p>` : `<p class="public-description">Score pendiente o sin explicación cargada.</p>`}
          ${property.analysis?.categories ? `<div class="score-bars">${Object.entries(property.analysis.categories).map(([key, value]) => `
            <div class="bar-row">
              <span>${escapeHtml(labelize(key))}</span>
              <div class="bar"><span style="width:${Math.max(0, Math.min(100, Number(value) * 10))}%"></span></div>
              <span>${Number(value).toFixed(1)}</span>
            </div>
          `).join("")}</div>` : ""}
        </div>

        <div class="modal-section">
          <h3>Documentación y costos</h3>
          <div class="extra-list">
            ${costRows(property)}
          </div>
        </div>
      </div>
    </div>
  `;
  renderChat();
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
  $("#scoreValue").textContent = property.score ? Number(property.score).toFixed(1) : "--";
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

async function callOpenRouter({ model, messages, temperature = 0.2 }) {
  const response = await fetch(apiUrl("/api/openrouter"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiKey: settings.apiKey || "",
      model: model || settings.model || serverConfig.defaultModel || DEFAULT_MODEL,
      temperature,
      messages,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(humanAiError(response.status, text));
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter no devolvio contenido.");
  return JSON.parse(content);
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
  return ["gpt-4o", "o4", "vision", "claude", "gemini", "gemma", "qwen-vl", "llava"].some((token) => value.includes(token));
}

async function runPhotoAnalysis() {
  const property = selectedProperty();
  if (!property.photos.length) {
    alert("Subi al menos una foto antes de calcular el score.");
    return;
  }
  $("#runAiBtn").disabled = true;
  $("#runAiBtn").textContent = "Analizando fotos...";
  try {
    const limitedPhotos = property.photos.slice(0, 8);
    const chosenModel = settings.model || DEFAULT_MODEL;
    const canSeeImages = modelSupportsVision(chosenModel);
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

    const analysis = await callOpenRouter({
      model: chosenModel,
      messages: [{ role: "user", content }],
    });
    property.analysis = analysis;
    property.score = Number(analysis.global_score || 0);
    saveState();
    renderAll();
  } catch (error) {
    alert(error.message);
  } finally {
    $("#runAiBtn").disabled = false;
    $("#runAiBtn").textContent = "Analizar fotos con IA";
  }
}

async function runPlanAnalysis() {
  const property = selectedProperty();
  const imagePlans = property.plans.filter((plan) => plan.dataUrl?.startsWith("data:image"));
  const chosenModel = settings.planModel || settings.model || DEFAULT_MODEL;
  if (!modelSupportsVision(chosenModel)) {
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
      model: chosenModel,
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
  state.editorTab = "data";
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
  $("#scrapeOutput").textContent = "Leyendo la publicación y extrayendo datos...";
  try {
    preparePropertyForScrape(url);
    const response = await fetch(apiUrl("/api/scrape"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) throw new Error(await response.text());
    const scraped = await response.json();
    $("#scrapeOutput").textContent = "Datos scrapeados. Guardando fotos y atributos...";
    applyScrapedData(scraped);
    $("#scrapeOutput").textContent = "Filtrando fotos importadas automáticamente...";
    const filterReport = await filterImportedPhotos({ silent: true });
    const property = selectedProperty();
    $("#scrapeOutput").textContent = "Validando coherencia con IA...";
    const review = await validateScrapedProperty(property);
    const missing = missingFields(property);
    $("#scrapeOutput").innerHTML = `
      <strong>Importación lista desde ${escapeHtml(scraped.platform || "link externo")}.</strong><br>
      Se cargaron título, descripción, precio, ubicación, atributos, ${scraped.photos?.length || 0} fotos y ${scraped.videos?.length || 0} videos detectados.
      ${filterReport ? `<br>${escapeHtml(filterReport)}` : ""}
      ${review ? `<br><br><strong>Chequeo IA/coherencia:</strong><br>${escapeHtml(review)}` : ""}
      ${missing.length ? `<br><br><strong>Faltantes para pedir al propietario:</strong><br>${missing.map((item) => `- ${escapeHtml(item)}`).join("<br>")}` : "<br><br>La ficha básica quedó completa."}
    `;
    renderAll();
  } catch (error) {
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
    const chosenModel = settings.model || serverConfig.defaultModel || DEFAULT_MODEL;
    const canSeeImages = modelSupportsVision(chosenModel);
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
      model: chosenModel,
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
  settings.model = $("#modelInput").value.trim() || DEFAULT_MODEL;
  settings.planModel = $("#planModelInput").value.trim() || settings.model;
  saveSettings();

  $("#testAiBtn").disabled = true;
  $("#testAiBtn").textContent = "Probando...";
  $("#aiTestOutput").classList.remove("hidden");
  $("#aiTestOutput").textContent = "Conectando con OpenRouter...";
  try {
    const result = await callOpenRouter({
      model: settings.model,
      messages: [{
        role: "user",
        content: `Respondé solo JSON válido: {"ok":true,"message":"conexion lista","model":"${settings.model}"}`,
      }],
    });
    $("#aiTestOutput").innerHTML = `<strong>IA conectada.</strong><br>${escapeHtml(result.message || "OpenRouter respondió correctamente.")}`;
  } catch (error) {
    $("#aiTestOutput").innerHTML = `<strong>No conectó todavía.</strong><br>${escapeHtml(error.message)}`;
  } finally {
    $("#testAiBtn").disabled = false;
    $("#testAiBtn").textContent = "Probar IA";
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
      model: settings.model || DEFAULT_MODEL,
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

async function runAiPropertySearch() {
  const query = $("#aiSearchInput").value.trim();
  if (!query && !aiSearchImageDataUrl) return;
  $("#aiSearchBtn").disabled = true;
  $("#aiSearchBtn").textContent = "Buscando...";
  try {
    const source = state.properties.filter((property) => property.status === "published");
    const summaries = source.map((property) => ({
      id: property.id,
      title: property.title,
      type: property.type,
      neighborhood: property.neighborhood,
      city: property.city,
      price_usd: property.price,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      built_m2: builtAreaForValue(property),
      usd_m2: pricePerM2(property),
      description: property.description,
      score: property.score,
      cover_photo_name: property.photos[0]?.name || null,
      cover_photo_url: photoSrc(property.photos[0]) || null,
      photo_count: property.photos.length,
      extras: property.extras,
    }));
    const model = settings.model || serverConfig.defaultModel || DEFAULT_MODEL;
    const visualCandidates = source
      .filter((property) => photoSrc(property.photos[0]))
      .slice(0, 10)
      .map((property) => ({ id: property.id, title: property.title, image: photoSrc(property.photos[0]) }));
    const prompt = `Sos un buscador inmobiliario IA para Uruguay. Tenés que filtrar propiedades reales para el portal cliente.

Reglas:
- Devolvé SOLO IDs de propiedades existentes.
- Si la búsqueda tiene texto, interpretá intención, zona, precio, tipo, dormitorios, estilo y amenities.
- Si hay imagen de referencia, compará estilo visual, tipo de ambiente, luminosidad, terraza/vista/pileta/fachada/materiales con las fotos candidatas.
- Si ninguna propiedad sirve, devolvé matching_ids vacío.
- Ordená matching_ids de mejor a peor.

Devuelve JSON válido:
{
  "matching_ids": string[],
  "explanation": string,
  "visual_matches": [{"id": string, "reason": string}],
  "suggested_filters": {"max_price": number|null, "min_bedrooms": number|null, "type": string|null}
}

Búsqueda textual: ${query || "(sin texto, usar imagen)"}

Propiedades:
${JSON.stringify(summaries, null, 2)}

Fotos candidatas incluidas en este mensaje, en orden:
${JSON.stringify(visualCandidates.map((item, index) => ({ order: index + 1, id: item.id, title: item.title })), null, 2)}`;
    const content = (aiSearchImageDataUrl || visualCandidates.length) && modelSupportsVision(model)
      ? [
        { type: "text", text: prompt },
        ...(aiSearchImageDataUrl ? [{ type: "text", text: "Imagen de referencia del comprador:" }, { type: "image_url", image_url: { url: aiSearchImageDataUrl } }] : []),
        ...visualCandidates.flatMap((item, index) => [
          { type: "text", text: `Foto candidata ${index + 1}. property_id=${item.id}` },
          { type: "image_url", image_url: { url: item.image } },
        ]),
      ]
      : prompt;
    const result = await callOpenRouter({
      model,
      messages: [{ role: "user", content }],
    });
    const validIds = new Set(source.map((property) => property.id));
    state.aiSearchIds = (Array.isArray(result.matching_ids) ? result.matching_ids : []).filter((id) => validIds.has(id));
    state.aiSearchExplanation = result.explanation || `Filtro IA aplicado: ${query || "imagen de referencia"}`;
    saveState();
    renderMarketplace();
  } catch (error) {
    const fallback = query.toLowerCase();
    state.aiSearchIds = state.properties
      .filter((property) => `${property.title} ${property.neighborhood} ${property.city} ${property.description} ${JSON.stringify(property.extras || [])}`.toLowerCase().includes(fallback))
      .map((property) => property.id);
    state.aiSearchExplanation = `No pude usar IA (${error.message}). Apliqué búsqueda textual sobre las fichas.`;
    saveState();
    renderMarketplace();
  } finally {
    $("#aiSearchBtn").disabled = false;
    $("#aiSearchBtn").textContent = "Buscar con IA";
  }
}

function clearAiSearch() {
  state.aiSearchIds = null;
  state.aiSearchExplanation = "";
  aiSearchImageDataUrl = "";
  $("#aiSearchInput").value = "";
  $("#aiSearchImageInput").value = "";
  renderAiSearchPreview();
  saveState();
  renderMarketplace();
}

function renderAiSearchPreview() {
  const preview = $("#aiSearchImagePreview");
  if (!preview) return;
  preview.classList.toggle("hidden", !aiSearchImageDataUrl);
  preview.innerHTML = aiSearchImageDataUrl ? `<img src="${aiSearchImageDataUrl}" alt=""><span>Imagen usada como referencia visual</span>` : "";
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

  const modelForPhotos = settings.model || serverConfig.defaultModel || "";
  if ((settings.apiKey || serverConfig.openRouterConfigured) && modelSupportsVision(modelForPhotos)) {
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
        model: modelForPhotos,
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
        model: settings.model || DEFAULT_MODEL,
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
  $("#statusFilter").addEventListener("change", renderProperties);
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

  $("#propertyForm").addEventListener("submit", (event) => {
    event.preventDefault();
    savePropertyForm();
  });

  $("#propertyForm").addEventListener("change", updateSelectedFromForm);
  $("#propertyForm").addEventListener("input", updateSelectedFromForm);

  $$('input[name="publishedElsewhere"]').forEach((input) => {
    input.addEventListener("change", () => {
      $("#scrapeBox").classList.toggle("hidden", input.value !== "yes" || !input.checked);
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
    settings.model = $("#modelInput").value.trim() || DEFAULT_MODEL;
    settings.planModel = $("#planModelInput").value.trim() || settings.model;
    saveSettings();
  });
  $("#testAiBtn").addEventListener("click", testAiConnection);

  $("#runAiBtn").addEventListener("click", runPhotoAnalysis);
  $("#runPlanAiBtn").addEventListener("click", runPlanAnalysis);
  $("#generateReportBtn").addEventListener("click", generateReport);

  $("#chatBubbleBtn").addEventListener("click", () => {
    $("#chatWidget").classList.toggle("hidden");
    renderChat();
  });
  $("#closeChatBtn").addEventListener("click", () => $("#chatWidget").classList.add("hidden"));
  $("#closePropertyModalBtn").addEventListener("click", () => $("#propertyModal").close());
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
if (localStorage.getItem("od-sidebar-collapsed") === "1") document.body.classList.add("sidebar-collapsed");
setView("marketplace");
loadServerConfig();
