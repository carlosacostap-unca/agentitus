#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const env = loadEnv(resolve(process.cwd(), ".env.local"));
const baseUrl = requireEnv("NEXT_PUBLIC_POCKETBASE_URL").replace(/\/+$/, "");
const email = requireEnv("POCKETBASE_ADMIN_EMAIL");
const password = requireEnv("POCKETBASE_ADMIN_PASSWORD");

const READ_AUTH = '@request.auth.id != ""';

const collectionDefinitions = [
  {
    name: "customers",
    fields: [
      text("full_name", { required: true, max: 160, presentable: true }),
      text("phone", { max: 80 }),
      emailField("email"),
      select("status", ["prospect", "active", "archived"], { required: true }),
      text("notes", { max: 2000 }),
      json("metadata"),
    ],
    indexes: [
      "CREATE INDEX idx_customers_status ON customers (status)",
      "CREATE INDEX idx_customers_phone ON customers (phone)",
    ],
  },
  {
    name: "erp_products",
    fields: [
      text("sku", { required: true, max: 80, presentable: true }),
      text("brand", { required: true, max: 120 }),
      text("model", { required: true, max: 160 }),
      text("size", { required: true, max: 80 }),
      select("category", ["tire", "accessory"], { required: true }),
      number("price", { required: true, min: 0 }),
      number("stock", { min: 0, onlyInt: true }),
      number("min_stock", { min: 0, onlyInt: true }),
      bool("active"),
      text("notes", { max: 2000 }),
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_erp_products_sku ON erp_products (sku)",
      "CREATE INDEX idx_erp_products_size ON erp_products (size)",
      "CREATE INDEX idx_erp_products_active ON erp_products (active)",
    ],
  },
  {
    name: "erp_services",
    fields: [
      text("code", { required: true, max: 80, presentable: true }),
      text("name", { required: true, max: 160 }),
      text("description", { max: 2000 }),
      number("price", { required: true, min: 0 }),
      number("duration_minutes", { required: true, min: 0, onlyInt: true }),
      bool("appointment_required"),
      bool("active"),
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_erp_services_code ON erp_services (code)",
      "CREATE INDEX idx_erp_services_active ON erp_services (active)",
    ],
  },
  {
    name: "social_accounts",
    fields: ({ customers }) => [
      relation("customer", customers.id, { required: true, cascadeDelete: true }),
      select("channel", ["instagram", "whatsapp"], { required: true }),
      text("external_id", { max: 160 }),
      text("display_handle", { required: true, max: 160, presentable: true }),
      text("profile_name", { max: 160 }),
      url("avatar_url"),
      bool("is_active"),
      json("metadata"),
    ],
    indexes: [
      "CREATE INDEX idx_social_accounts_customer ON social_accounts (customer)",
      "CREATE INDEX idx_social_accounts_channel ON social_accounts (channel)",
      "CREATE UNIQUE INDEX idx_social_accounts_channel_handle ON social_accounts (channel, display_handle)",
    ],
  },
  {
    name: "conversations",
    fields: ({ customers, social_accounts, users }) => [
      relation("customer", customers.id, { required: true }),
      relation("social_account", social_accounts.id),
      select("channel", ["instagram", "whatsapp"], { required: true }),
      select("status", ["open", "pending_agent", "pending_approval", "resolved", "archived"], { required: true }),
      date("last_message_at"),
      relation("assigned_to", users.id),
      text("summary", { max: 4000 }),
      json("metadata"),
    ],
    indexes: [
      "CREATE INDEX idx_conversations_customer ON conversations (customer)",
      "CREATE INDEX idx_conversations_status ON conversations (status)",
      "CREATE INDEX idx_conversations_last_message_at ON conversations (last_message_at)",
    ],
  },
  {
    name: "messages",
    fields: ({ conversations, customers }) => [
      relation("conversation", conversations.id, { required: true, cascadeDelete: true }),
      relation("customer", customers.id),
      select("channel", ["instagram", "whatsapp"], { required: true }),
      select("direction", ["inbound", "outbound", "internal"], { required: true }),
      select("sender_type", ["customer", "business", "agent", "operator", "system"], { required: true }),
      text("body", { required: true, max: 8000, presentable: true }),
      select("status", ["received", "drafted", "approved", "delivered", "failed"], { required: true }),
      date("sent_at"),
      date("delivered_at"),
      json("metadata"),
    ],
    indexes: [
      "CREATE INDEX idx_messages_conversation ON messages (conversation)",
      "CREATE INDEX idx_messages_sent_at ON messages (sent_at)",
      "CREATE INDEX idx_messages_status ON messages (status)",
    ],
  },
  {
    name: "agent_runs",
    fields: ({ conversations, messages }) => [
      relation("conversation", conversations.id, { required: true, cascadeDelete: true }),
      relation("trigger_message", messages.id),
      select("status", ["queued", "running", "needs_approval", "completed", "failed"], { required: true }),
      select("intent", ["stock_inquiry", "price_inquiry", "service_inquiry", "appointment_request", "order_intent", "greeting", "unknown"]),
      text("model", { max: 120 }),
      text("input_summary", { max: 4000 }),
      text("response_draft", { max: 8000 }),
      text("final_response", { max: 8000 }),
      text("error", { max: 4000 }),
      date("started_at"),
      date("finished_at"),
      json("metadata"),
    ],
    indexes: [
      "CREATE INDEX idx_agent_runs_conversation ON agent_runs (conversation)",
      "CREATE INDEX idx_agent_runs_status ON agent_runs (status)",
    ],
  },
  {
    name: "agent_tool_calls",
    fields: ({ agent_runs }) => [
      relation("agent_run", agent_runs.id, { required: true, cascadeDelete: true }),
      text("tool_name", { required: true, max: 160, presentable: true }),
      select("status", ["started", "completed", "failed"], { required: true }),
      json("input"),
      json("output"),
      text("error", { max: 4000 }),
      date("started_at"),
      date("finished_at"),
    ],
    indexes: [
      "CREATE INDEX idx_agent_tool_calls_agent_run ON agent_tool_calls (agent_run)",
      "CREATE INDEX idx_agent_tool_calls_tool_name ON agent_tool_calls (tool_name)",
    ],
  },
  {
    name: "orders",
    fields: ({ customers, conversations }) => [
      relation("customer", customers.id, { required: true }),
      relation("conversation", conversations.id),
      select("status", ["draft", "confirmed", "cancelled", "completed"], { required: true }),
      number("total", { min: 0 }),
      text("notes", { max: 4000 }),
      json("metadata"),
    ],
    indexes: [
      "CREATE INDEX idx_orders_customer ON orders (customer)",
      "CREATE INDEX idx_orders_status ON orders (status)",
    ],
  },
  {
    name: "order_items",
    fields: ({ orders, erp_products }) => [
      relation("order", orders.id, { required: true, cascadeDelete: true }),
      relation("product", erp_products.id, { required: true }),
      number("quantity", { required: true, min: 1, onlyInt: true }),
      number("unit_price", { required: true, min: 0 }),
      number("subtotal", { required: true, min: 0 }),
      text("notes", { max: 2000 }),
    ],
    indexes: [
      "CREATE INDEX idx_order_items_order ON order_items (order)",
      "CREATE INDEX idx_order_items_product ON order_items (product)",
    ],
  },
  {
    name: "appointments",
    fields: ({ customers, conversations, erp_services }) => [
      relation("customer", customers.id, { required: true }),
      relation("conversation", conversations.id),
      relation("service", erp_services.id),
      select("status", ["requested", "confirmed", "cancelled", "completed"], { required: true }),
      date("scheduled_for"),
      text("vehicle_info", { max: 1000 }),
      text("notes", { max: 4000 }),
      json("metadata"),
    ],
    indexes: [
      "CREATE INDEX idx_appointments_customer ON appointments (customer)",
      "CREATE INDEX idx_appointments_status ON appointments (status)",
      "CREATE INDEX idx_appointments_scheduled_for ON appointments (scheduled_for)",
    ],
  },
];

async function main() {
  const token = await getAuthToken();
  const existing = await listCollections(token);
  const byName = new Map(existing.map((collection) => [collection.name, collection]));
  const created = [];
  const skipped = [];

  for (const definition of collectionDefinitions) {
    if (byName.has(definition.name)) {
      skipped.push(definition.name);
      continue;
    }

    const context = Object.fromEntries(byName.entries());
    const fields = typeof definition.fields === "function" ? definition.fields(context) : definition.fields;
    const missingRefs = fields
      .filter((field) => field.type === "relation" && !field.collectionId)
      .map((field) => field.name);

    if (missingRefs.length > 0) {
      throw new Error(`Cannot create ${definition.name}; missing relation collection ids for: ${missingRefs.join(", ")}`);
    }

    const collection = await createCollection(token, {
      name: definition.name,
      type: "base",
      system: false,
      listRule: READ_AUTH,
      viewRule: READ_AUTH,
      createRule: READ_AUTH,
      updateRule: READ_AUTH,
      deleteRule: READ_AUTH,
      fields,
      indexes: definition.indexes ?? [],
    });

    byName.set(collection.name, collection);
    created.push(collection.name);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        created,
        skipped,
        totalAgentitusCollections: collectionDefinitions.length,
      },
      null,
      2,
    ),
  );
}

function text(name, options = {}) {
  return {
    type: "text",
    name,
    required: options.required ?? false,
    presentable: options.presentable ?? false,
    hidden: false,
    min: options.min ?? 0,
    max: options.max ?? 0,
    pattern: options.pattern ?? "",
    autogeneratePattern: options.autogeneratePattern ?? "",
  };
}

function emailField(name, options = {}) {
  return {
    type: "email",
    name,
    required: options.required ?? false,
    presentable: options.presentable ?? false,
    hidden: false,
    exceptDomains: null,
    onlyDomains: null,
  };
}

function url(name, options = {}) {
  return {
    type: "url",
    name,
    required: options.required ?? false,
    presentable: options.presentable ?? false,
    hidden: false,
    exceptDomains: null,
    onlyDomains: null,
  };
}

function select(name, values, options = {}) {
  return {
    type: "select",
    name,
    required: options.required ?? false,
    presentable: options.presentable ?? false,
    hidden: false,
    values,
    minSelect: options.required ? 1 : 0,
    maxSelect: options.maxSelect ?? 1,
  };
}

function number(name, options = {}) {
  return {
    type: "number",
    name,
    required: options.required ?? false,
    presentable: options.presentable ?? false,
    hidden: false,
    min: options.min ?? null,
    max: options.max ?? null,
    onlyInt: options.onlyInt ?? false,
  };
}

function bool(name, options = {}) {
  return {
    type: "bool",
    name,
    required: options.required ?? false,
    presentable: options.presentable ?? false,
    hidden: false,
  };
}

function date(name, options = {}) {
  return {
    type: "date",
    name,
    required: options.required ?? false,
    presentable: options.presentable ?? false,
    hidden: false,
    min: options.min ?? "",
    max: options.max ?? "",
  };
}

function json(name, options = {}) {
  return {
    type: "json",
    name,
    required: options.required ?? false,
    presentable: options.presentable ?? false,
    hidden: false,
    maxSize: options.maxSize ?? 2_000_000,
  };
}

function relation(name, collectionId, options = {}) {
  return {
    type: "relation",
    name,
    required: options.required ?? false,
    presentable: options.presentable ?? false,
    hidden: false,
    collectionId,
    cascadeDelete: options.cascadeDelete ?? false,
    minSelect: options.required ? 1 : 0,
    maxSelect: options.maxSelect ?? 1,
  };
}

async function listCollections(token) {
  const response = await fetch(`${baseUrl}/api/collections?page=1&perPage=500`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(`PocketBase list collections failed: ${JSON.stringify(data)}`);
  }
  return data.items ?? [];
}

async function createCollection(token, payload) {
  const response = await fetch(`${baseUrl}/api/collections`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    throw new Error(`PocketBase create collection ${payload.name} failed: ${JSON.stringify(data, null, 2)}`);
  }
  return data;
}

async function getAuthToken() {
  const body = JSON.stringify({ identity: email, password });
  const paths = ["/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"];
  let lastError = null;

  for (const path of paths) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await parseResponse(response);
    if (response.ok && data.token) return data.token;
    lastError = data;
  }

  throw new Error(`PocketBase admin auth failed: ${JSON.stringify(lastError)}`);
}

async function parseResponse(response) {
  const textBody = await response.text();
  if (!textBody) return null;
  try {
    return JSON.parse(textBody);
  } catch {
    return textBody;
  }
}

function loadEnv(path) {
  const values = {};
  const file = readFileSync(path, "utf8");

  for (const rawLine of file.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
    process.env[key] ??= value;
  }

  return values;
}

function requireEnv(name) {
  const value = process.env[name] ?? env[name];
  if (!value) throw new Error(`Missing required env value: ${name}`);
  return value;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
