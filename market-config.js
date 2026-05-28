// market-config.js — market-agnostic configuration for Owner Direct
// Change these values to deploy to a different country or market.
const MARKET_CONFIG = {
  country: "Uruguay",
  currency: "USD",
  locale: "es-UY",
  neighborhoodLabel: "Barrio",
  defaultCity: "Montevideo",

  // Each entry maps to a property field and document kind.
  utilityProviders: [
    { name: "UTE",   field: "uteAvg",   label: "UTE promedio",        docKind: "Factura UTE"   },
    { name: "OSE",   field: "oseAvg",   label: "OSE promedio",        docKind: "Factura OSE"   },
    { name: "Antel", field: "antelAvg", label: "Antel / internet",    docKind: "Factura Antel" },
  ],

  legalFields: [
    { label: "Plano aprobado",    docKind: "Plano aprobado"  },
    { label: "Contribución anual",field: "contribucionAnnual", annual: true },
    { label: "Primaria anual",    field: "primariaAnnual",    annual: true },
    { label: "Seguro hogar",      field: "insuranceAvg",      docKind: "Seguro hogar" },
  ],

  documentKinds: [
    "Factura UTE",
    "Factura OSE",
    "Factura Antel",
    "Gastos comunes",
    "Contribucion",
    "Primaria",
    "Seguro hogar",
    "Plano aprobado",
    "Otro",
  ],

  // Map filename keywords → document kind for auto-detection.
  utilityKeywords: {
    "ute":      "Factura UTE",
    "ose":      "Factura OSE",
    "antel":    "Factura Antel",
    "internet": "Factura Antel",
    "gasto":    "Gastos comunes",
    "contrib":  "Contribucion",
    "primaria": "Primaria",
    "seguro":   "Seguro hogar",
    "plano":    "Plano aprobado",
  },

  // Infrastructure photo checklist items shown in the buyer report.
  infraChecklistItems: [
    "Tablero eléctrico",
    "Medidor de agua / pozo",
    "Tanque de agua",
    "Conexiones de servicios",
    "Planos aprobados",
    "Fachada exterior",
  ],
};
