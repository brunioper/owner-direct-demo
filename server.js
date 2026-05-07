const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;

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
    if (req.method === "GET" && parsed.pathname === "/api/config") {
      sendJson(res, 200, {
        openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
        defaultModel: process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free",
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
  const safePath = pathname === "/" ? "/index.html" : pathname;
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

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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
  const { apiKey, model, messages, temperature = 0.2, responseFormat = true } = JSON.parse(body || "{}");
  const effectiveApiKey = apiKey || process.env.OPENROUTER_API_KEY;
  const effectiveModel = model || process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free";
  if (!effectiveApiKey) {
    sendJson(res, 401, { error: "Falta API key de OpenRouter." });
    return;
  }
  if (!effectiveModel) {
    sendJson(res, 400, { error: "Falta modelo de OpenRouter." });
    return;
  }

  const payload = {
    model: effectiveModel,
    messages,
    temperature,
  };
  if (responseFormat) payload.response_format = { type: "json_object" };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${effectiveApiKey}`,
      "HTTP-Referer": req.headers.origin || process.env.PUBLIC_URL || "http://127.0.0.1:4173",
      "X-Title": "Owner Direct Demo",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  res.writeHead(response.status, {
    "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(text);
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
  const bad = /logo|avatar|profile|perfil|mapa|map|staticmap|icon|sprite|placeholder|blank|default|favicon|watermark|marker|pin|agency|agencia|banner|facebook|instagram|whatsapp|youtube|google/i;
  const goodHost = /infocasas|mercadolibre|mlstatic|cloudfront|cdn|img|image|photos|fotos|static/i;
  return unique(urls)
    .map((url) => url.replace(/&amp;/g, "&"))
    .filter((url) => /^https?:\/\//i.test(url))
    .filter((url) => /\.(jpe?g|png|webp)(\?|$)/i.test(url))
    .filter((url) => !bad.test(url))
    .filter((url) => goodHost.test(url) || /\/(properties|inmuebles|fotos|photos|uploads|items)\//i.test(url))
    .filter((url) => !/(\b16x16\b|\b32x32\b|\b48x48\b|\b64x64\b|\b80x80\b|\b100x100\b)/i.test(url));
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
