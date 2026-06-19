import "server-only";

import { generateAgentReply } from "@/lib/openai-agent";
import {
  createInitialState,
  tireInventory,
  tireShopServices,
  type AgentResult,
  type Channel,
  type Conversation,
  type Customer,
  type Intent,
  type Message,
  type Service,
  type SimulationState,
  type Tire,
} from "@/lib/simulation";

type ListResponse<T> = {
  items: T[];
};

type PbRecord = {
  id: string;
  created?: string;
  updated?: string;
};

type PbCustomer = PbRecord & {
  full_name: string;
  phone?: string;
  email?: string;
  status: string;
  notes?: string;
};

type PbSocialAccount = PbRecord & {
  customer: string;
  channel: Channel;
  display_handle: string;
  profile_name?: string;
};

type PbConversation = PbRecord & {
  customer: string;
  social_account?: string;
  channel: Channel;
  status: string;
  last_message_at?: string;
  summary?: string;
};

type PbMessage = PbRecord & {
  conversation: string;
  customer?: string;
  channel: Channel;
  direction: "inbound" | "outbound" | "internal";
  sender_type: "customer" | "business" | "agent" | "operator" | "system";
  body: string;
  status: string;
  sent_at?: string;
  delivered_at?: string;
};

type PbProduct = PbRecord & {
  sku: string;
  brand: string;
  model: string;
  size: string;
  category: "tire" | "accessory";
  price: number;
  stock: number;
  min_stock?: number;
  active?: boolean;
};

type PbService = PbRecord & {
  code: string;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  appointment_required?: boolean;
  active?: boolean;
};

type PbAgentRun = PbRecord & {
  conversation: string;
  trigger_message?: string;
  status: "queued" | "running" | "needs_approval" | "completed" | "failed";
  intent?: PbIntent;
  model?: string;
  input_summary?: string;
  response_draft?: string;
  final_response?: string;
  error?: string;
  started_at?: string;
  finished_at?: string;
  metadata?: {
    requestedSize?: string;
    evidence?: AgentResult["evidence"];
    source?: "openai" | "deterministic-fallback";
    model?: string;
    fallbackError?: string;
  };
};

type PbIntent =
  | "stock_inquiry"
  | "price_inquiry"
  | "service_inquiry"
  | "appointment_request"
  | "order_intent"
  | "greeting"
  | "unknown";

const PB_URL = requiredEnv("NEXT_PUBLIC_POCKETBASE_URL").replace(/\/+$/, "");
const PB_EMAIL = requiredEnv("POCKETBASE_ADMIN_EMAIL");
const PB_PASSWORD = requiredEnv("POCKETBASE_ADMIN_PASSWORD");

let authToken: { token: string; expiresAt: number } | undefined;

export async function getSimulationStateFromPocketBase(
  selectedConversationId?: string,
): Promise<SimulationState> {
  await seedPocketBaseIfEmpty();

  const [customers, socialAccounts, conversations, messages, products, services, agentRuns] =
    await Promise.all([
      listAll<PbCustomer>("customers"),
      listAll<PbSocialAccount>("social_accounts"),
      listAll<PbConversation>("conversations", { sort: "last_message_at" }),
      listAll<PbMessage>("messages", { sort: "sent_at" }),
      listAll<PbProduct>("erp_products"),
      listAll<PbService>("erp_services"),
      listAll<PbAgentRun>("agent_runs", { sort: "started_at" }),
    ]);

  return mapPocketBaseState(
    {
      customers,
      socialAccounts,
      conversations,
      messages,
      products,
      services,
      agentRuns,
    },
    selectedConversationId,
  );
}

export async function createPocketBaseCustomer(
  channel: Channel,
  name: string,
  handle: string,
): Promise<SimulationState> {
  const cleanName = name.trim();
  const cleanHandle = handle.trim();
  if (!cleanName || !cleanHandle) return getSimulationStateFromPocketBase();

  const conversationId = await createCustomerConversation(channel, cleanName, cleanHandle);

  return getSimulationStateFromPocketBase(conversationId);
}

export async function submitPocketBaseCustomerMessage(
  conversationId: string,
  body: string,
): Promise<SimulationState> {
  const cleanBody = body.trim();
  if (!cleanBody) return getSimulationStateFromPocketBase();

  const [conversation, inventory, services, agentRuns, previousMessages] = await Promise.all([
    getRecord<PbConversation>("conversations", conversationId),
    listAll<PbProduct>("erp_products"),
    listAll<PbService>("erp_services"),
    listAll<PbAgentRun>("agent_runs", {
      filter: `conversation = "${conversationId}"`,
      sort: "-started_at",
    }),
    listAll<PbMessage>("messages", {
      filter: `conversation = "${conversationId}"`,
      sort: "sent_at",
    }),
  ]);
  const previousSize = agentRuns.find((run) => run.metadata?.requestedSize)?.metadata?.requestedSize;
  const timestamp = new Date().toISOString();

  const message = await createRecord<PbMessage>("messages", {
    conversation: conversation.id,
    customer: conversation.customer,
    channel: conversation.channel,
    direction: "inbound",
    sender_type: "customer",
    body: cleanBody,
    status: "received",
    sent_at: timestamp,
  });

  const agentReply = await generateAgentReply({
    message: cleanBody,
    history: [...previousMessages, message].map(mapMessage),
    inventory: inventory.map(mapProductToTire),
    services: services.map(mapService),
    previousSize,
  });
  const agentResult = agentReply.result;

  const agentRun = await createRecord<PbAgentRun>("agent_runs", {
    conversation: conversation.id,
    trigger_message: message.id,
    status: "needs_approval",
    intent: toPocketBaseIntent(agentResult.intent),
    model: agentReply.model,
    input_summary: cleanBody,
    response_draft: agentResult.response,
    started_at: timestamp,
    finished_at: timestamp,
    metadata: {
      requestedSize: agentResult.requestedSize,
      evidence: agentResult.evidence,
      source: agentReply.source,
      model: agentReply.model,
      fallbackError: agentReply.error,
    },
  });

  await createRecord("agent_tool_calls", {
    agent_run: agentRun.id,
    tool_name: agentResult.evidence.type === "service" ? "erp_services_lookup" : "erp_products_lookup",
    status: "completed",
    input: { message: cleanBody, previousSize },
    output: agentResult.evidence,
    started_at: timestamp,
    finished_at: timestamp,
  });

  await updateRecord<PbConversation>("conversations", conversation.id, {
    status: "pending_approval",
    last_message_at: timestamp,
    summary: cleanBody,
  });

  return getSimulationStateFromPocketBase(conversationId);
}

export async function approvePocketBaseDraft(
  conversationId: string,
  responseOverride?: string,
): Promise<SimulationState> {
  const runs = await listAll<PbAgentRun>("agent_runs", {
    filter: `conversation = "${conversationId}" && status = "needs_approval"`,
    sort: "-started_at",
  });
  const run = runs[0];
  const response = responseOverride?.trim() || run?.response_draft?.trim();
  if (!run || !response) return getSimulationStateFromPocketBase();

  const conversation = await getRecord<PbConversation>("conversations", conversationId);
  const timestamp = new Date().toISOString();

  await createRecord<PbMessage>("messages", {
    conversation: conversation.id,
    customer: conversation.customer,
    channel: conversation.channel,
    direction: "outbound",
    sender_type: "business",
    body: response,
    status: "delivered",
    sent_at: timestamp,
    delivered_at: timestamp,
  });

  await Promise.all([
    updateRecord<PbAgentRun>("agent_runs", run.id, {
      status: "completed",
      response_draft: response,
      final_response: response,
      finished_at: timestamp,
    }),
    updateRecord<PbConversation>("conversations", conversation.id, {
      status: "resolved",
      last_message_at: timestamp,
      summary: response,
    }),
  ]);

  return getSimulationStateFromPocketBase(conversationId);
}

export async function updatePocketBaseTireStock(
  tireId: string,
  nextStock: number,
): Promise<SimulationState> {
  await updateRecord<PbProduct>("erp_products", tireId, {
    stock: Math.max(0, nextStock),
  });

  return getSimulationStateFromPocketBase();
}

async function seedPocketBaseIfEmpty() {
  const [customersCount, productsCount, servicesCount] = await Promise.all([
    countRecords("customers"),
    countRecords("erp_products"),
    countRecords("erp_services"),
  ]);

  const existingProducts =
    productsCount > 0 ? await listAll<PbProduct>("erp_products") : [];
  const existingSkus = new Set(existingProducts.map((product) => product.sku));
  const missingTires = tireInventory.filter(
    (tire) => !existingSkus.has(tire.id.replace(/^tire-/, "").toUpperCase()),
  );

  if (missingTires.length > 0) {
    await Promise.all(
      missingTires.map((tire) =>
        createRecord("erp_products", {
          sku: tire.id.replace(/^tire-/, "").toUpperCase(),
          brand: tire.brand,
          model: tire.model,
          size: tire.size,
          category: "tire",
          price: tire.price,
          stock: tire.stock,
          min_stock: 3,
          active: true,
          notes: tire.availability,
        }),
      ),
    );
  }

  const existingServices =
    servicesCount > 0 ? await listAll<PbService>("erp_services") : [];
  const existingServiceCodes = new Set(existingServices.map((service) => service.code));
  const missingServices = tireShopServices.filter(
    (service) => !existingServiceCodes.has(service.id.replace(/^service-/, "")),
  );

  if (missingServices.length > 0) {
    await Promise.all(
      missingServices.map((service) =>
        createRecord("erp_services", {
          code: service.id.replace(/^service-/, ""),
          name: service.name,
          description: `${service.priceRange}. ${service.availability}. Keywords: ${service.keywords.join(", ")}`,
          price: parseServicePrice(service.priceRange),
          duration_minutes: parseInt(service.duration, 10) || 30,
          appointment_required: !service.availability.toLowerCase().includes("orden de llegada"),
          active: true,
        }),
      ),
    );
  }

  if (customersCount === 0) {
    const initialState = createInitialState();
    for (const customer of initialState.customers) {
      await createCustomerConversation(customer.channel, customer.name, customer.handle);
    }
  }
}

async function createCustomerConversation(channel: Channel, name: string, handle: string) {
  const customer = await createRecord<PbCustomer>("customers", {
    full_name: name,
    phone: channel === "whatsapp" ? handle : "",
    status: "prospect",
  });

  const socialAccount = await createRecord<PbSocialAccount>("social_accounts", {
    customer: customer.id,
    channel,
    display_handle: handle,
    profile_name: name,
    is_active: true,
  });

  const conversation = await createRecord<PbConversation>("conversations", {
    customer: customer.id,
    social_account: socialAccount.id,
    channel,
    status: "open",
    last_message_at: new Date().toISOString(),
    summary: `Conversacion de ${name} preparada para ${channel}.`,
  });

  return conversation.id;
}

function mapPocketBaseState({
  customers,
  socialAccounts,
  conversations,
  messages,
  products,
  services,
  agentRuns,
}: {
  customers: PbCustomer[];
  socialAccounts: PbSocialAccount[];
  conversations: PbConversation[];
  messages: PbMessage[];
  products: PbProduct[];
  services: PbService[];
  agentRuns: PbAgentRun[];
}, selectedConversationId?: string): SimulationState {
  const socialByCustomer = new Map<string, PbSocialAccount[]>();
  for (const account of socialAccounts) {
    const list = socialByCustomer.get(account.customer) ?? [];
    list.push(account);
    socialByCustomer.set(account.customer, list);
  }

  const stateCustomers: Customer[] = customers.map((customer) => {
    const account = socialByCustomer.get(customer.id)?.[0];
    return {
      id: customer.id,
      name: customer.full_name,
      handle: account?.display_handle ?? customer.phone ?? customer.email ?? customer.full_name,
      channel: account?.channel ?? "whatsapp",
      avatar: initialsFromName(customer.full_name),
    };
  });

  const messagesByConversation = groupBy(messages, (message) => message.conversation);
  const runsByConversation = groupBy(agentRuns, (run) => run.conversation);

  const stateConversations: Conversation[] = conversations.map((conversation) => {
    const latestRun = latestAgentRun(runsByConversation.get(conversation.id) ?? []);
    const draft = latestRun?.status === "needs_approval" ? mapAgentRun(latestRun) : undefined;
    const conversationMessages = (messagesByConversation.get(conversation.id) ?? []).map(mapMessage);

    return {
      id: conversation.id,
      channel: conversation.channel,
      customerId: conversation.customer,
      messages: conversationMessages,
      status: draft ? "draft-ready" : "delivered",
      lastIntent: latestRun?.intent ? fromPocketBaseIntent(latestRun.intent) : "unknown",
      lastRequestedSize: latestRun?.metadata?.requestedSize,
      draft,
      lifecycle: buildLifecycleFromRecords(conversation, latestRun),
    };
  });

  return {
    customers: stateCustomers,
    conversations: stateConversations,
    inventory: products.filter((product) => product.category === "tire").map(mapProductToTire),
    services: services.map(mapService),
    selectedConversationId: selectedConversationId ?? stateConversations[0]?.id ?? "",
  };
}

function mapProductToTire(product: PbProduct): Tire {
  const stock = Number(product.stock ?? 0);
  return {
    id: product.id,
    size: product.size,
    brand: product.brand,
    model: product.model,
    price: Number(product.price ?? 0),
    stock,
    availability: stock === 0 ? "out-of-stock" : stock <= 3 ? "low-stock" : "available",
  };
}

function mapService(service: PbService): Service {
  return {
    id: service.id,
    name: service.name,
    priceRange: service.price ? formatServicePrice(service.price) : "Consultar precio",
    duration: `${service.duration_minutes || 30} min`,
    availability: serviceAvailability(service),
    keywords: serviceKeywords(service),
  };
}

function mapMessage(message: PbMessage): Message {
  return {
    id: message.id,
    sender: message.direction === "inbound" ? "customer" : "business",
    body: message.body,
    timestamp: formatPocketBaseDate(message.sent_at ?? message.created),
  };
}

function mapAgentRun(run: PbAgentRun): AgentResult {
  return {
    id: run.id,
    intent: run.intent ? fromPocketBaseIntent(run.intent) : "unknown",
    requestedSize: run.metadata?.requestedSize,
    response: run.response_draft ?? "",
    evidence: run.metadata?.evidence ?? {
      type: "none",
      summary: "Sin evidencia registrada",
      records: [],
    },
  };
}

function buildLifecycleFromRecords(conversation: PbConversation, run: PbAgentRun | undefined) {
  const timestamp = formatPocketBaseDate(run?.created ?? conversation.created);

  if (!run) {
    return [
      {
        id: `${conversation.id}-ready`,
        step: "delivered" as const,
        label: "Canal listo",
        detail: `Conversacion preparada para ${conversation.channel}.`,
        timestamp,
      },
    ];
  }

  const intent = run.intent ? fromPocketBaseIntent(run.intent) : "unknown";
  const base = [
    {
      id: `${run.id}-intake`,
      step: "intake" as const,
      label: "Mensaje recibido",
      detail: "El hub recibio el mensaje desde el canal social.",
      timestamp,
    },
    {
      id: `${run.id}-intent`,
      step: "intent-detection" as const,
      label: "Intencion detectada",
      detail: intent,
      timestamp,
    },
    {
      id: `${run.id}-lookup`,
      step: "erp-lookup" as const,
      label: "Consulta ERP",
      detail: run.metadata?.evidence?.summary ?? "Consulta registrada en PocketBase.",
      timestamp,
    },
    {
      id: `${run.id}-draft`,
      step: "response-draft" as const,
      label: "Respuesta redactada",
      detail: run.status === "needs_approval" ? "La respuesta quedo lista para aprobacion." : "Respuesta registrada.",
      timestamp,
    },
  ];

  if (run.status !== "completed") return base;

  return [
    ...base,
    {
      id: `${run.id}-delivered`,
      step: "delivered" as const,
      label: "Entregado al canal",
      detail: "Respuesta entregada al cliente.",
      timestamp: formatPocketBaseDate(run.finished_at ?? run.updated),
    },
  ];
}

async function countRecords(collection: string) {
  const response = await listRecords<PbRecord>(collection, { page: 1, perPage: 1, skipTotal: false });
  return response.totalItems ?? 0;
}

async function listAll<T>(collection: string, options: Record<string, unknown> = {}) {
  const perPage = 200;
  const first = await listRecords<T>(collection, { ...options, page: 1, perPage });
  const items = [...(first.items ?? [])];
  const totalPages = first.totalPages ?? 1;

  for (let page = 2; page <= totalPages; page += 1) {
    const next = await listRecords<T>(collection, { ...options, page, perPage });
    items.push(...(next.items ?? []));
  }

  return items;
}

async function listRecords<T>(collection: string, options: Record<string, unknown> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  return pbRequest<ListResponse<T> & { totalItems?: number; totalPages?: number }>(
    `/api/collections/${encodeURIComponent(collection)}/records?${params.toString()}`,
  );
}

async function getRecord<T>(collection: string, id: string) {
  return pbRequest<T>(`/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`);
}

async function createRecord<T>(collection: string, data: Record<string, unknown>) {
  return pbRequest<T>(`/api/collections/${encodeURIComponent(collection)}/records`, {
    method: "POST",
    body: data,
  });
}

async function updateRecord<T>(collection: string, id: string, data: Record<string, unknown>) {
  return pbRequest<T>(`/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: data,
  });
}

async function pbRequest<T>(path: string, options: { method?: string; body?: Record<string, unknown> } = {}) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${await getAuthToken()}`,
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${PB_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const data = await readResponse(response);
  if (!response.ok) {
    throw new Error(`PocketBase ${options.method ?? "GET"} ${path} failed: ${JSON.stringify(data)}`);
  }

  return data as T;
}

async function getAuthToken() {
  if (authToken && authToken.expiresAt > Date.now() + 60_000) {
    return authToken.token;
  }

  const body = { identity: PB_EMAIL, password: PB_PASSWORD };
  const paths = ["/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"];

  for (const path of paths) {
    const response = await fetch(`${PB_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await readResponse(response);

    if (response.ok && typeof data?.token === "string") {
      authToken = {
        token: data.token,
        expiresAt: decodeJwtExpiry(data.token) ?? Date.now() + 20 * 60_000,
      };
      return authToken.token;
    }
  }

  throw new Error("PocketBase admin authentication failed");
}

async function readResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env value: ${name}`);
  return value;
}

function decodeJwtExpiry(token: string) {
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return groups;
}

function toPocketBaseIntent(intent: Intent): PbIntent {
  return intent.replaceAll("-", "_") as PbIntent;
}

function fromPocketBaseIntent(intent: PbIntent): Intent {
  return intent.replaceAll("_", "-") as Intent;
}

function formatPocketBaseDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function initialsFromName(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "CL"
  ).toUpperCase();
}

function parseServicePrice(value: string) {
  const match = value.replace(/\./g, "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function formatServicePrice(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function serviceKeywords(service: PbService) {
  const source = `${service.code} ${service.name} ${service.description ?? ""}`.toLowerCase();
  const defaults = [service.code, service.name, ...(service.description?.split(/[\s,.;:]+/) ?? [])];

  if (source.includes("balance")) defaults.push("balanceo", "balancear", "vibra", "vibracion");
  if (source.includes("aline")) defaults.push("alineacion", "alinear", "direccion", "tira");
  if (source.includes("coloc") || source.includes("instal")) {
    defaults.push("colocar", "colocacion", "instalar", "instalacion", "armar");
  }
  if (source.includes("pinch") || source.includes("repar")) {
    defaults.push("pinchazo", "parche", "reparar", "pierde aire");
  }

  return [...new Set(defaults.map((keyword) => keyword.trim()).filter(Boolean))];
}

function serviceAvailability(service: PbService) {
  const seededService = tireShopServices.find(
    (candidate) => candidate.id.replace(/^service-/, "") === service.code,
  );
  if (seededService) return seededService.availability;

  const descriptionParts = service.description
    ?.split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  const meaningfulParts = descriptionParts?.filter((part) => !part.toLowerCase().startsWith("keywords"));
  const availability = meaningfulParts?.[1] ?? meaningfulParts?.[0];

  return availability ?? (service.appointment_required ? "Requiere turno" : "Disponible por orden de llegada");
}

function latestAgentRun(runs: PbAgentRun[]) {
  return runs
    .slice()
    .sort((left, right) => {
      const leftTime = new Date(left.started_at ?? left.created ?? "").getTime();
      const rightTime = new Date(right.started_at ?? right.created ?? "").getTime();
      return rightTime - leftTime;
    })[0];
}
