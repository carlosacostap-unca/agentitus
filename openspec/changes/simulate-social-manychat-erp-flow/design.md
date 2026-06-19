## Context

The app is a new Next.js project with OpenSpec configured and no existing product-specific implementation. The requested experience is one web application with distinct screens that simulate connected systems: Instagram customer DMs, WhatsApp customer conversations, a ManyChat-like automation hub, and a tire-shop ERP. The main stakeholder is a demo user who needs to explain and interact with the full customer support/sales flow without connecting to real external platforms.

The initial build should favor clarity of simulation over production infrastructure. The system can use in-memory or static demo data, local client state, and deterministic agent behavior while preserving clean domain boundaries so later persistence or real integrations can be added.

## Goals / Non-Goals

**Goals:**

- Present one coherent web app with distinct internal simulated application screens: Instagram, WhatsApp, automation inbox, and tire-shop ERP.
- Make the message lifecycle visible from customer message to ERP lookup and returned answer.
- Include tire-shop demo data that supports realistic customer questions about stock, tire size, prices, services, appointments, and order intent.
- Model the automation hub as the central place where messages are received, classified, answered, and monitored.
- Keep implementation self-contained for a first prototype.

**Non-Goals:**

- No real Instagram, WhatsApp, ManyChat, or ERP API integration in the initial version.
- No production authentication, role management, payment processing, or multi-tenant configuration.
- No requirement for server-side persistence in the first version.
- No unrestricted generative AI dependency is required; the agent can be rule-based or deterministic for the demo.

## Decisions

1. Build a single-page simulation shell with separate navigable application screens.

   The app will expose Instagram, WhatsApp, the automation console, and the ERP view as distinct screens in one navigable experience so the user can observe cause and effect without switching projects. An alternative was to keep Instagram and WhatsApp inside one social screen; that is compact, but it weakens the feeling that the customer is using two different original channels.

2. Use a shared event and conversation model.

   Messages, agent steps, ERP lookups, and delivered replies will be represented as domain events linked to a conversation. This keeps the lifecycle inspectable and avoids hidden magic in the demo. An alternative was to update UI state directly per panel; that would be simpler at first but harder to test and explain.

3. Treat the ManyChat-like console as the orchestration source of truth.

   The social channels originate and receive messages, and the ERP owns business data, but the automation console owns conversation state, routing, classification, and response status. This mirrors the intended architecture and makes the middle application meaningful instead of decorative.

4. Start with deterministic agent behavior backed by ERP demo data.

   The initial agent will map common customer intents to ERP queries and response templates. This provides reliable demos and testable outcomes. A future version can replace or augment this with a real model/API once the desired flow is validated.

5. Keep ERP data editable enough for the simulation.

   The ERP view should show inventory, services, and customer/order context, and it should allow at least simple stock/price changes if implementation scope allows. The first priority is queryability by the agent; full ERP CRUD can come later.

## Risks / Trade-offs

- Simulation may feel artificial if the agent only handles a tiny set of phrases -> Mitigation: include several realistic seeded questions and visible fallback behavior.
- A single screen with three apps can become visually crowded -> Mitigation: use a structured workspace with clear panes/tabs and stable dimensions.
- Deterministic agent logic may be mistaken for real AI capability -> Mitigation: label the agent step as a simulated/deterministic demo in internal UI state and keep future integration points clear.
- In-memory state resets on refresh -> Mitigation: acceptable for the initial prototype; later work can add localStorage or a database.
- ERP scope can grow quickly -> Mitigation: constrain initial ERP data to the fields needed for customer replies.
