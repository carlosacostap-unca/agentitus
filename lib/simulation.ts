export type Channel = "instagram" | "whatsapp";

export type MessageSender = "customer" | "business";

export type Intent =
  | "stock-inquiry"
  | "price-inquiry"
  | "service-inquiry"
  | "appointment-request"
  | "order-intent"
  | "greeting"
  | "unknown";

export type LifecycleStep =
  | "intake"
  | "intent-detection"
  | "erp-lookup"
  | "response-draft"
  | "approved"
  | "delivered";

export type ProcessingStatus = "draft-ready" | "delivered";

export type Customer = {
  id: string;
  name: string;
  handle: string;
  channel: Channel;
  avatar: string;
};

export type Message = {
  id: string;
  sender: MessageSender;
  body: string;
  timestamp: string;
};

export type Conversation = {
  id: string;
  channel: Channel;
  customerId: string;
  messages: Message[];
  status: ProcessingStatus;
  lastIntent: Intent;
  lastRequestedSize?: string;
  draft?: AgentResult;
  lifecycle: LifecycleEvent[];
};

export type Tire = {
  id: string;
  size: string;
  brand: string;
  model: string;
  price: number;
  stock: number;
  availability: "available" | "low-stock" | "out-of-stock";
};

export type Service = {
  id: string;
  name: string;
  priceRange: string;
  duration: string;
  availability: string;
  keywords: string[];
};

export type ErpEvidence = {
  type: "inventory" | "service" | "none";
  summary: string;
  records: Array<Tire | Service>;
};

export type AgentResult = {
  id: string;
  intent: Intent;
  requestedSize?: string;
  response: string;
  evidence: ErpEvidence;
};

export type LifecycleEvent = {
  id: string;
  step: LifecycleStep;
  label: string;
  detail: string;
  timestamp: string;
};

export type SimulationState = {
  customers: Customer[];
  conversations: Conversation[];
  inventory: Tire[];
  services: Service[];
  selectedConversationId: string;
};

const nowLabel = () =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

const makeId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

export const tireInventory: Tire[] = [
  {
    id: "tire-195-55-r16-pirelli",
    size: "195/55 R16",
    brand: "Pirelli",
    model: "Cinturato P1",
    price: 148000,
    stock: 6,
    availability: "available",
  },
  {
    id: "tire-205-55-r16-michelin",
    size: "205/55 R16",
    brand: "Michelin",
    model: "Primacy 4",
    price: 176500,
    stock: 3,
    availability: "low-stock",
  },
  {
    id: "tire-185-65-r15-fate",
    size: "185/65 R15",
    brand: "Fate",
    model: "AR-360",
    price: 108900,
    stock: 12,
    availability: "available",
  },
  {
    id: "tire-215-60-r17-bridgestone",
    size: "215/60 R17",
    brand: "Bridgestone",
    model: "Turanza T005",
    price: 221000,
    stock: 0,
    availability: "out-of-stock",
  },
  {
    id: "tire-175-70-r14-goodyear",
    size: "175/70 R14",
    brand: "Goodyear",
    model: "Assurance",
    price: 96700,
    stock: 8,
    availability: "available",
  },
];

export const tireShopServices: Service[] = [
  {
    id: "service-installation",
    name: "Colocacion de neumaticos",
    priceRange: "$12.000 a $18.000 por unidad",
    duration: "35 min",
    availability: "Turnos hoy 16:30 y 18:00",
    keywords: ["colocar", "colocacion", "instalar", "instalacion", "armar"],
  },
  {
    id: "service-balancing",
    name: "Balanceo",
    priceRange: "$8.500 por rueda",
    duration: "25 min",
    availability: "Disponible por orden de llegada",
    keywords: ["balanceo", "balancear", "vibra", "vibracion"],
  },
  {
    id: "service-alignment",
    name: "Alineacion",
    priceRange: "$24.000",
    duration: "45 min",
    availability: "Proximo turno libre manana 09:30",
    keywords: ["alineacion", "alinear", "direccion", "tira"],
  },
  {
    id: "service-repair",
    name: "Reparacion de pinchazo",
    priceRange: "$9.000 a $15.000",
    duration: "20 min",
    availability: "Disponible hoy",
    keywords: ["pinchazo", "parche", "reparar", "pierde aire"],
  },
];

export const customers: Customer[] = [
  {
    id: "customer-instagram",
    name: "Sofia Martinez",
    handle: "@sofi.martinez",
    channel: "instagram",
    avatar: "SM",
  },
  {
    id: "customer-whatsapp",
    name: "Lucas Herrera",
    handle: "+54 383 456-1188",
    channel: "whatsapp",
    avatar: "LH",
  },
];

export function queryTireAvailability(inventory: Tire[], size?: string) {
  if (!size) {
    return [];
  }

  const normalizedSize = normalizeSize(size);
  return inventory.filter((tire) => normalizeSize(tire.size) === normalizedSize);
}

export function queryService(services: Service[], message: string) {
  const normalizedMessage = normalizeText(message);
  return services.filter((service) =>
    service.keywords.some((keyword) => normalizedMessage.includes(normalizeText(keyword))),
  );
}

export function detectIntent(message: string, previousSize?: string) {
  const normalized = normalizeText(message);
  const requestedSize = extractTireSize(message) ?? previousSize;
  const mentionsService = tireShopServices.some((service) =>
    service.keywords.some((keyword) => normalized.includes(normalizeText(keyword))),
  );

  if (
    /\b(turno|reserva|reservar|cuando|podria|podrias|podemos|horario|horarios|agenda|disponibilidad|manana|ayudame)\b/.test(
      normalized,
    ) ||
    normalized.includes("me queda bien")
  ) {
    return { intent: "appointment-request" as const, requestedSize };
  }

  if (/\b(comprar|encargar|senar|señar|reservame|me llevo|quiero)\b/.test(normalized)) {
    return { intent: "order-intent" as const, requestedSize };
  }

  if (mentionsService) {
    return { intent: "service-inquiry" as const, requestedSize };
  }

  if (/\b(precio|cuanto|cuánto|vale|costo|sale)\b/.test(normalized)) {
    return { intent: "price-inquiry" as const, requestedSize };
  }

  if (requestedSize || /\b(stock|tenes|tenes|tienen|hay|disponible|neumatico|cubierta)\b/.test(normalized)) {
    return { intent: "stock-inquiry" as const, requestedSize };
  }

  if (/\b(hola|buenas|buen dia|buenas tardes|buenas noches)\b/.test(normalized)) {
    return { intent: "greeting" as const, requestedSize };
  }

  return { intent: "unknown" as const, requestedSize };
}

export function generateAgentResult(
  message: string,
  inventory: Tire[],
  services: Service[],
  previousSize?: string,
): AgentResult {
  const { intent, requestedSize } = detectIntent(message, previousSize);
  const tireMatches = queryTireAvailability(inventory, requestedSize);
  const serviceMatches = queryService(services, message);

  if ((intent === "stock-inquiry" || intent === "price-inquiry" || intent === "order-intent") && requestedSize) {
    if (tireMatches.length === 0) {
      return {
        id: makeId("agent"),
        intent,
        requestedSize,
        evidence: {
          type: "none",
          summary: `Sin coincidencias para ${requestedSize}`,
          records: [],
        },
        response: `Consulte en el ERP por ${requestedSize} y por ahora no figura stock disponible. Puedo ofrecerte revisar una medida equivalente o dejar la consulta tomada para avisarte cuando ingrese.`,
      };
    }

    const available = tireMatches.filter((tire) => tire.stock > 0);
    if (available.length === 0) {
      return {
        id: makeId("agent"),
        intent,
        requestedSize,
        evidence: {
          type: "inventory",
          summary: `Medida ${requestedSize} encontrada sin stock`,
          records: tireMatches,
        },
        response: `En el ERP figura ${requestedSize}, pero actualmente esta sin stock. Si queres, puedo tomar tus datos para avisarte cuando vuelva a ingresar.`,
      };
    }

    const lines = available
      .map(
        (tire) =>
          `${tire.brand} ${tire.model}: ${formatCurrency(tire.price)} por unidad, stock ${tire.stock}`,
      )
      .join("; ");

    return {
      id: makeId("agent"),
      intent,
      requestedSize,
      evidence: {
        type: "inventory",
        summary: `${available.length} coincidencia(s) para ${requestedSize}`,
        records: available,
      },
      response:
        intent === "order-intent"
          ? `Si, puedo avanzar con la reserva de ${requestedSize}. En el ERP tengo ${lines}. Decime cantidad y nombre para dejarlo preparado.`
          : `Si, tenemos ${requestedSize}. Opciones cargadas en ERP: ${lines}. Tambien podemos coordinar colocacion si queres.`,
    };
  }

  if (intent === "service-inquiry" || intent === "appointment-request") {
    const appointmentServices =
      intent === "appointment-request" && requestedSize
        ? services.filter((service) =>
            service.keywords.some((keyword) =>
              ["colocar", "colocacion", "instalar", "instalacion", "armar"].includes(
                normalizeText(keyword),
              ),
            ),
          )
        : [];
    const matches =
      serviceMatches.length > 0
        ? serviceMatches
        : appointmentServices.length > 0
          ? appointmentServices
          : services.slice(0, 3);
    const summary = matches
      .map((service) => `${service.name}: ${service.priceRange}, ${service.duration}, ${service.availability}`)
      .join("; ");

    return {
      id: makeId("agent"),
      intent,
      requestedSize,
      evidence: {
        type: "service",
        summary: `${matches.length} servicio(s) consultados`,
        records: matches,
      },
      response:
        intent === "appointment-request" && requestedSize
          ? normalizedFollowUpConfirmsTomorrow(message)
            ? `Perfecto, te puedo dejar encaminado el turno para manana por la colocacion de ${requestedSize}. En el ERP figura: ${summary}. Confirmame nombre y horario preferido y lo dejamos reservado.`
            : `Para ${requestedSize}, puedo coordinar colocacion. En el ERP figura: ${summary}. Decime cual horario te queda mejor y lo dejamos reservado.`
          : `Te paso lo que figura en el ERP: ${summary}. Si queres, te puedo ayudar a elegir un turno.`,
    };
  }

  if (intent === "greeting") {
    return {
      id: makeId("agent"),
      intent,
      requestedSize,
      evidence: {
        type: "none",
        summary: "Saludo detectado, no requiere consulta ERP",
        records: [],
      },
      response:
        "Hola, gracias por escribir a Gomeria Centro. Decime la medida del neumatico o el servicio que necesitas y reviso el ERP.",
    };
  }

  return {
    id: makeId("agent"),
    intent,
    requestedSize,
    evidence: {
      type: "none",
      summary: "Solicitud no clasificada",
      records: [],
    },
    response:
      "Puedo ayudarte con stock, precios, colocacion, balanceo, alineacion o turnos. Si me pasas la medida del neumatico, reviso el ERP.",
  };
}

export function createInitialState(): SimulationState {
  const timestamp = nowLabel();
  const conversations: Conversation[] = customers.map((customer) =>
    createConversationForCustomer(customer, timestamp),
  );

  return {
    customers,
    conversations,
    inventory: tireInventory,
    services: tireShopServices,
    selectedConversationId: conversations[0].id,
  };
}

export function addCustomer(
  state: SimulationState,
  channel: Channel,
  name: string,
  handle: string,
): SimulationState {
  const cleanName = name.trim();
  const cleanHandle = handle.trim();

  if (!cleanName || !cleanHandle) {
    return state;
  }

  const customer: Customer = {
    id: makeId(`customer-${channel}`),
    name: cleanName,
    handle: cleanHandle,
    channel,
    avatar: initialsFromName(cleanName),
  };
  const conversation = createConversationForCustomer(customer, nowLabel());

  return {
    ...state,
    customers: [...state.customers, customer],
    conversations: [...state.conversations, conversation],
    selectedConversationId: conversation.id,
  };
}

export function submitCustomerMessage(
  state: SimulationState,
  conversationId: string,
  body: string,
): SimulationState {
  const cleanBody = body.trim();
  if (!cleanBody) {
    return state;
  }

  const timestamp = nowLabel();
  const conversations = state.conversations.map((conversation) => {
    if (conversation.id !== conversationId) {
      return conversation;
    }

    const customerMessage: Message = {
      id: makeId("msg"),
      sender: "customer",
      body: cleanBody,
      timestamp,
    };
    const agentResult = generateAgentResult(
      cleanBody,
      state.inventory,
      state.services,
      conversation.lastRequestedSize,
    );
    const lifecycle = buildLifecycle(agentResult, timestamp, false);

    return {
      ...conversation,
      messages: [...conversation.messages, customerMessage],
      status: "draft-ready" as const,
      lastIntent: agentResult.intent,
      lastRequestedSize: agentResult.requestedSize ?? conversation.lastRequestedSize,
      draft: agentResult,
      lifecycle,
    };
  });

  return {
    ...state,
    selectedConversationId: conversationId,
    conversations,
  };
}

export function approveDraft(state: SimulationState, conversationId: string): SimulationState {
  const timestamp = nowLabel();
  const conversations = state.conversations.map((conversation) => {
    if (conversation.id !== conversationId || !conversation.draft) {
      return conversation;
    }

    const businessMessage: Message = {
      id: makeId("msg"),
      sender: "business",
      body: conversation.draft.response,
      timestamp,
    };
    const deliveryEvents: LifecycleEvent[] = [
      {
        id: makeId("life"),
        step: "approved",
        label: "Aprobado por operador",
        detail: "La respuesta fue revisada en el hub.",
        timestamp,
      },
      {
        id: makeId("life"),
        step: "delivered",
        label: "Entregado al canal",
        detail: `Respuesta enviada a ${channelLabel(conversation.channel)}.`,
        timestamp,
      },
    ];

    return {
      ...conversation,
      messages: [...conversation.messages, businessMessage],
      status: "delivered" as const,
      lifecycle: [...conversation.lifecycle, ...deliveryEvents],
    };
  });

  return {
    ...state,
    conversations,
  };
}

export function updateTireStock(
  state: SimulationState,
  tireId: string,
  nextStock: number,
): SimulationState {
  const inventory = state.inventory.map((tire) => {
    if (tire.id !== tireId) {
      return tire;
    }

    const stock = Math.max(0, nextStock);
    return {
      ...tire,
      stock,
      availability: stock === 0 ? "out-of-stock" : stock <= 3 ? "low-stock" : "available",
    } satisfies Tire;
  });

  return {
    ...state,
    inventory,
  };
}

export function channelLabel(channel: Channel) {
  return channel === "instagram" ? "Instagram" : "WhatsApp";
}

export function intentLabel(intent: Intent) {
  const labels: Record<Intent, string> = {
    "stock-inquiry": "Consulta stock",
    "price-inquiry": "Consulta precio",
    "service-inquiry": "Consulta servicio",
    "appointment-request": "Solicitud turno",
    "order-intent": "Intencion compra",
    greeting: "Saludo",
    unknown: "Sin clasificar",
  };

  return labels[intent];
}

export function availabilityLabel(availability: Tire["availability"]) {
  const labels: Record<Tire["availability"], string> = {
    available: "Disponible",
    "low-stock": "Stock bajo",
    "out-of-stock": "Sin stock",
  };

  return labels[availability];
}

function buildLifecycle(
  agentResult: AgentResult,
  timestamp: string,
  delivered: boolean,
): LifecycleEvent[] {
  const base: LifecycleEvent[] = [
    {
      id: makeId("life"),
      step: "intake",
      label: "Mensaje recibido",
      detail: "El hub recibio el mensaje desde el canal social.",
      timestamp,
    },
    {
      id: makeId("life"),
      step: "intent-detection",
      label: "Intencion detectada",
      detail: intentLabel(agentResult.intent),
      timestamp,
    },
    {
      id: makeId("life"),
      step: "erp-lookup",
      label: "Consulta ERP",
      detail: agentResult.evidence.summary,
      timestamp,
    },
    {
      id: makeId("life"),
      step: "response-draft",
      label: "Respuesta redactada",
      detail: "La respuesta quedo lista para aprobacion.",
      timestamp,
    },
  ];

  if (!delivered) {
    return base;
  }

  return [
    ...base,
    {
      id: makeId("life"),
      step: "delivered",
      label: "Entregado al canal",
      detail: "Respuesta entregada al cliente.",
      timestamp,
    },
  ];
}

function extractTireSize(message: string) {
  const match = message.match(/\b(\d{3})\s*[/-]?\s*(\d{2})\s*r?\s*(\d{2})\b/i);
  if (!match) {
    return undefined;
  }

  return `${match[1]}/${match[2]} R${match[3]}`;
}

function normalizeSize(size: string) {
  return size.toUpperCase().replace(/\s+/g, "").replace("-", "/");
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizedFollowUpConfirmsTomorrow(message: string) {
  const normalized = normalizeText(message);
  return normalized.includes("manana") || normalized.includes("me queda bien");
}

function createConversationForCustomer(customer: Customer, timestamp: string): Conversation {
  return {
    id: makeId(`conversation-${customer.channel}`),
    channel: customer.channel,
    customerId: customer.id,
    messages: [],
    status: "delivered",
    lastIntent: "unknown",
    lifecycle: [
      {
        id: makeId("life"),
        step: "delivered",
        label: "Canal listo",
        detail: `Conversacion de ${customer.name} preparada para simular ${channelLabel(customer.channel)}.`,
        timestamp,
      },
    ],
  };
}

function initialsFromName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return (parts.map((part) => part[0]).join("") || "CL").toUpperCase();
}
