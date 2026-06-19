## ADDED Requirements

### Requirement: Customer intent detection
The system SHALL classify common tire-shop customer messages into supported intents such as stock inquiry, price inquiry, service inquiry, appointment request, order intent, greeting, and unknown request.

#### Scenario: Detect tire stock inquiry
- **WHEN** a customer message asks whether a tire size is available
- **THEN** the system classifies the message as a stock inquiry and extracts the requested tire size when present

#### Scenario: Detect unknown request
- **WHEN** a customer message does not match a supported tire-shop intent
- **THEN** the system classifies the message as unknown and prepares a fallback response

### Requirement: Agent queries ERP before answering business questions
The agent workflow SHALL use ERP data before answering customer questions about tire availability, prices, services, or appointments.

#### Scenario: Answer availability from ERP data
- **WHEN** a customer asks for a tire size that exists in ERP inventory
- **THEN** the agent response includes matching availability, brand/model, stock, and price information from the ERP data

#### Scenario: No matching tire stock
- **WHEN** a customer asks for a tire size that has no matching ERP inventory
- **THEN** the agent response states that no matching stock is currently available and offers an alternative follow-up path

### Requirement: Responses travel through the automation hub
The agent workflow SHALL return generated responses to the automation hub before the social channel receives them.

#### Scenario: Agent response awaits automation delivery
- **WHEN** the agent produces a response
- **THEN** the automation hub receives the response draft and updates the conversation lifecycle before delivery

### Requirement: Server-side model generation
The agent workflow SHALL generate response drafts on the server by awaiting the configured OpenAI Responses API model before persisting the draft for operator review.

#### Scenario: Await OpenAI response before draft creation
- **WHEN** a customer message is submitted to the hub
- **THEN** the system sends the conversation context and ERP evidence to the configured OpenAI model
- **AND** waits for the model response before creating the pending agent draft

#### Scenario: OpenAI failure falls back safely
- **WHEN** the configured model cannot return a usable response
- **THEN** the system records a deterministic fallback draft using ERP data
- **AND** stores fallback metadata for debugging without exposing secrets

### Requirement: Multi-turn conversation continuity
The agent workflow SHALL preserve enough conversation context during the active simulation to answer follow-up questions related to the previous customer request.

#### Scenario: Follow-up asks for price
- **WHEN** a customer first asks for availability of a tire size and then asks for the price
- **THEN** the agent uses the previous tire-size context to answer the price question from ERP data

#### Scenario: Follow-up confirms next-day appointment
- **WHEN** a customer first asks about tire availability and installation and later says that tomorrow works
- **THEN** the agent treats the message as an appointment continuation instead of a new stock inquiry
- **AND** drafts a response that advances the appointment using ERP service availability
