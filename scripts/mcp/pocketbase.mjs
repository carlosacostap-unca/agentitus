#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const env = loadEnv(resolve(process.cwd(), process.env.MCP_ENV_FILE ?? ".env.local"));
const config = {
  baseUrl: requireEnv("NEXT_PUBLIC_POCKETBASE_URL").replace(/\/+$/, ""),
  email: requireEnv("POCKETBASE_ADMIN_EMAIL"),
  password: requireEnv("POCKETBASE_ADMIN_PASSWORD"),
};

let cachedAuth = null;

const server = new McpServer(
  {
    name: "agentitus-pocketbase",
    version: "0.1.0",
  },
  {
    instructions:
      "Use this MCP to inspect and maintain the Agentitus PocketBase backend. Never expose credentials. Prefer read tools first; use write/delete tools only when the user explicitly asks for data changes.",
  },
);

server.registerTool(
  "pb_health",
  {
    title: "PocketBase health",
    description: "Checks whether the configured PocketBase instance is reachable.",
    inputSchema: {},
  },
  async () => {
    const result = await request("/api/health", { auth: false });
    return textResult({ ok: true, status: result.status, data: result.data });
  },
);

server.registerTool(
  "pb_list_collections",
  {
    title: "List PocketBase collections",
    description: "Lists PocketBase collections visible to the configured admin account.",
    inputSchema: {
      page: z.number().int().positive().default(1),
      perPage: z.number().int().positive().max(200).default(100),
    },
  },
  async ({ page, perPage }) => {
    const result = await request(`/api/collections?${query({ page, perPage })}`);
    return textResult(result.data);
  },
);

server.registerTool(
  "pb_list_records",
  {
    title: "List PocketBase records",
    description: "Lists records from a PocketBase collection with optional filter, sort, expand, and field projection.",
    inputSchema: {
      collection: z.string().min(1),
      page: z.number().int().positive().default(1),
      perPage: z.number().int().positive().max(200).default(30),
      filter: z.string().optional(),
      sort: z.string().optional(),
      expand: z.string().optional(),
      fields: z.string().optional(),
      skipTotal: z.boolean().optional(),
    },
  },
  async ({ collection, page, perPage, filter, sort, expand, fields, skipTotal }) => {
    const params = query({ page, perPage, filter, sort, expand, fields, skipTotal });
    const result = await request(`/api/collections/${encodeURIComponent(collection)}/records?${params}`);
    return textResult(result.data);
  },
);

server.registerTool(
  "pb_get_record",
  {
    title: "Get PocketBase record",
    description: "Gets a single record by collection and record id.",
    inputSchema: {
      collection: z.string().min(1),
      id: z.string().min(1),
      expand: z.string().optional(),
      fields: z.string().optional(),
    },
  },
  async ({ collection, id, expand, fields }) => {
    const params = query({ expand, fields });
    const suffix = params ? `?${params}` : "";
    const result = await request(
      `/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}${suffix}`,
    );
    return textResult(result.data);
  },
);

server.registerTool(
  "pb_create_record",
  {
    title: "Create PocketBase record",
    description: "Creates a record in a PocketBase collection. Use only after the user asks for a data change.",
    inputSchema: {
      collection: z.string().min(1),
      data: z.record(z.unknown()),
    },
  },
  async ({ collection, data }) => {
    const result = await request(`/api/collections/${encodeURIComponent(collection)}/records`, {
      method: "POST",
      body: data,
    });
    return textResult(result.data);
  },
);

server.registerTool(
  "pb_update_record",
  {
    title: "Update PocketBase record",
    description: "Updates a record in a PocketBase collection. Use only after the user asks for a data change.",
    inputSchema: {
      collection: z.string().min(1),
      id: z.string().min(1),
      data: z.record(z.unknown()),
    },
  },
  async ({ collection, id, data }) => {
    const result = await request(
      `/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: data,
      },
    );
    return textResult(result.data);
  },
);

server.registerTool(
  "pb_delete_record",
  {
    title: "Delete PocketBase record",
    description: "Deletes a record in a PocketBase collection. Requires confirmDelete='DELETE'.",
    inputSchema: {
      collection: z.string().min(1),
      id: z.string().min(1),
      confirmDelete: z.literal("DELETE"),
    },
  },
  async ({ collection, id }) => {
    await request(`/api/collections/${encodeURIComponent(collection)}/records/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return textResult({ ok: true, deleted: { collection, id } });
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
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

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
    process.env[key] ??= value;
  }

  return values;
}

function requireEnv(name) {
  const value = process.env[name] ?? env[name];
  if (!value) {
    throw new Error(`Missing required PocketBase MCP environment value: ${name}`);
  }
  return value;
}

async function getAuthToken() {
  if (cachedAuth && cachedAuth.expiresAt > Date.now() + 60_000) {
    return cachedAuth.token;
  }

  const body = {
    identity: config.email,
    password: config.password,
  };

  const authPaths = [
    "/api/collections/_superusers/auth-with-password",
    "/api/admins/auth-with-password",
  ];

  let lastError = null;
  for (const path of authPaths) {
    try {
      const result = await request(path, { auth: false, method: "POST", body });
      const token = result.data?.token;
      if (!token) {
        throw new Error(`PocketBase auth did not return a token for ${path}`);
      }

      cachedAuth = {
        token,
        expiresAt: decodeJwtExpiry(token) ?? Date.now() + 20 * 60_000,
      };
      return token;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function request(path, options = {}) {
  const method = options.method ?? "GET";
  const headers = {
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.auth !== false) {
    headers.Authorization = `Bearer ${await getAuthToken()}`;
  }

  const response = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const data = await readResponse(response);

  if (!response.ok) {
    throw new Error(
      `PocketBase request failed (${response.status} ${response.statusText}) ${method} ${redactUrl(path)}: ${JSON.stringify(data)}`,
    );
  }

  return {
    status: response.status,
    data,
  };
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function query(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  return params.toString();
}

function textResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function decodeJwtExpiry(token) {
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(Buffer.from(normalized, "base64url").toString("utf8"));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function redactUrl(path) {
  return path.replace(/([?&](?:password|token|auth|key)=)[^&]+/gi, "$1***");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
