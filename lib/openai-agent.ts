import "server-only";

import {
  generateAgentResult,
  type AgentResult,
  type Intent,
  type Message,
  type Service,
  type Tire,
} from "@/lib/simulation";

type AgentGeneration = {
  result: AgentResult;
  model: string;
  source: "openai" | "deterministic-fallback";
  error?: string;
};

type GenerateAgentReplyInput = {
  message: string;
  history: Message[];
  inventory: Tire[];
  services: Service[];
  previousSize?: string;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.4-mini";
const SUPPORTED_INTENTS: Intent[] = [
  "stock-inquiry",
  "price-inquiry",
  "service-inquiry",
  "appointment-request",
  "order-intent",
  "greeting",
  "unknown",
];

export async function generateAgentReply({
  message,
  history,
  inventory,
  services,
  previousSize,
}: GenerateAgentReplyInput): Promise<AgentGeneration> {
  const fallback = generateAgentResult(message, inventory, services, previousSize);
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

  if (!apiKey) {
    return {
      result: fallback,
      model: "deterministic-prototype",
      source: "deterministic-fallback",
      error: "OPENAI_API_KEY is not configured.",
    };
  }

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 700,
        input: [
          {
            role: "developer",
            content: buildDeveloperInstructions(),
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                currentCustomerMessage: message,
                previousRequestedTireSize: previousSize ?? null,
                conversationHistory: history.map((item) => ({
                  sender: item.sender,
                  body: item.body,
                  timestamp: item.timestamp,
                })),
                erpInventory: inventory.map((item) => ({
                  size: item.size,
                  brand: item.brand,
                  model: item.model,
                  price: item.price,
                  stock: item.stock,
                  availability: item.availability,
                })),
                erpServices: services.map((item) => ({
                  name: item.name,
                  priceRange: item.priceRange,
                  duration: item.duration,
                  availability: item.availability,
                  keywords: item.keywords,
                })),
                deterministicFallback: {
                  intent: fallback.intent,
                  requestedSize: fallback.requestedSize ?? null,
                  response: fallback.response,
                  evidence: fallback.evidence.summary,
                },
              },
              null,
              2,
            ),
          },
        ],
      }),
      cache: "no-store",
    });

    const payload = await readJsonResponse(response);
    if (!response.ok) {
      throw new Error(openAiErrorMessage(payload, response.status));
    }

    const outputText = extractOutputText(payload);
    const parsed = parseModelJson(outputText);
    const responseText = typeof parsed.response === "string" ? parsed.response.trim() : "";

    if (!responseText) {
      throw new Error("OpenAI response did not include a usable response field.");
    }

    const requestedSize =
      typeof parsed.requestedSize === "string" && parsed.requestedSize.trim()
        ? parsed.requestedSize.trim()
        : fallback.requestedSize;
    const intent = isSupportedIntent(parsed.intent) ? parsed.intent : fallback.intent;

    return {
      result: {
        ...fallback,
        intent,
        requestedSize,
        response: responseText,
      },
      model,
      source: "openai",
    };
  } catch (error) {
    return {
      result: fallback,
      model,
      source: "deterministic-fallback",
      error: error instanceof Error ? error.message : "Unknown OpenAI error.",
    };
  }
}

function buildDeveloperInstructions() {
  return [
    "Sos el agente de atencion de una gomeria argentina llamada Gomeria Centro.",
    "Genera un borrador breve, natural y editable para que un operador lo envie por WhatsApp o Instagram.",
    "Usa solo datos del ERP provisto para stock, precios, servicios y turnos; no inventes disponibilidad, marcas ni precios.",
    "Lee la conversacion completa. Si el cliente dice algo como 'el de manana me queda bien', 'me queda bien', 'si por favor' o 'ayudame', tratalo como continuacion del pedido anterior, no como una nueva consulta de stock.",
    "Si el cliente referencia 'el de manana', 'ese horario' o una opcion ya propuesta, busca en el ultimo mensaje del negocio el horario o servicio mencionado y confirmalo de forma concreta en vez de volver a listar stock.",
    "Cuando el cliente confirme un horario o pida coordinar, la intencion debe ser appointment-request y la respuesta debe avanzar con la reserva o pedir la confirmacion minima faltante.",
    "Devolve exclusivamente JSON valido con estas claves: intent, requestedSize, response.",
    "intent debe ser uno de: stock-inquiry, price-inquiry, service-inquiry, appointment-request, order-intent, greeting, unknown.",
    "requestedSize debe ser null si no aplica. response debe estar en espanol, sin markdown.",
  ].join("\n");
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractOutputText(payload: unknown) {
  if (isRecord(payload) && typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    return "";
  }

  return payload.output
    .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
    .map((content) => (isRecord(content) && typeof content.text === "string" ? content.text : ""))
    .join("")
    .trim();
}

function parseModelJson(text: string) {
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(clean) as {
    intent?: unknown;
    requestedSize?: unknown;
    response?: unknown;
  };
}

function openAiErrorMessage(payload: unknown, status: number) {
  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string") {
    return `OpenAI ${status}: ${payload.error.message}`;
  }

  return `OpenAI ${status}: ${JSON.stringify(payload)}`;
}

function isSupportedIntent(value: unknown): value is Intent {
  return typeof value === "string" && SUPPORTED_INTENTS.includes(value as Intent);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
