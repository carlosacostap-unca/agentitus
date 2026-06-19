## Why

The project needs a demonstrable web simulation of how customer conversations can move from social messaging channels into an automation hub, query business data, and return useful answers to the customer. This creates a focused prototype for explaining and testing an agent-assisted sales/support workflow for a tire shop without requiring real Instagram, WhatsApp, ManyChat, or ERP integrations.

## What Changes

- Add a single web application experience with distinct simulated application screens:
  - An Instagram direct-message simulator.
  - A WhatsApp conversation simulator.
  - A ManyChat-like inbox/orchestration console that receives, manages, and routes customer conversations.
  - A tire-shop ERP that stores and exposes business data such as tire inventory, prices, customer records, orders, and appointments.
- Introduce an agent-assisted response flow where messages written by a simulated customer are received by the orchestration console, interpreted, matched against ERP data, and answered back through the originating social channel.
- Support end-to-end conversation state across those screens so the user can see each step of the message lifecycle: customer message, orchestration intake, agent/ERP lookup, response drafting, and delivery back to the customer.
- Provide demo data for a gomeria, including tire sizes, brands, stock, prices, services, and common customer questions.
- Keep the simulation self-contained inside the app; no real external Instagram, WhatsApp, ManyChat, or ERP connection is required for the initial version.

## Capabilities

### New Capabilities

- `social-channel-simulator`: Simulated Instagram and WhatsApp customer chat surfaces that can send and receive messages.
- `automation-inbox-orchestrator`: ManyChat-like console for receiving messages, tracking conversations, and managing automated/agent responses.
- `tire-shop-erp`: ERP-style tire shop module with inventory, services, prices, customer/order context, and queryable business data.
- `agent-assisted-erp-replies`: Agent workflow that interprets customer intent, queries ERP data, drafts responses, and routes replies back to the originating channel.

### Modified Capabilities

- None.

## Impact

- Affects the Next.js app UI, application state model, mock data, and internal message-routing logic.
- Adds domain models for social channels, conversations, customer messages, ERP inventory/services, agent actions, and response events.
- Does not require external APIs, authentication, payments, or persistent production storage for the initial simulation.
