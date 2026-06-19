## 1. Domain Model And Demo Data

- [x] 1.1 Define TypeScript domain types for channels, customers, conversations, messages, lifecycle events, ERP tire inventory, ERP services, and agent results.
- [x] 1.2 Create seeded ERP data for tire brands, sizes, models, stock, prices, services, durations, and appointment context.
- [x] 1.3 Create seeded social customer profiles and initial empty or sample conversations for Instagram and WhatsApp.
- [x] 1.4 Implement internal ERP query helpers for tire availability, price lookup, service lookup, and appointment context.

## 2. Message Flow And Agent Logic

- [x] 2.1 Implement a shared simulation state model that links social messages, automation inbox records, ERP lookup evidence, and delivered replies.
- [x] 2.2 Implement deterministic intent detection for stock inquiry, price inquiry, service inquiry, appointment request, order intent, greeting, and unknown request.
- [x] 2.3 Implement agent response generation that uses ERP query results and preserves recent conversation context for follow-up questions.
- [x] 2.4 Implement lifecycle event creation for intake, intent detection, ERP lookup, response draft, approval, and delivery.

## 3. Social Channel Simulator UI

- [x] 3.1 Build Instagram-like and WhatsApp-like chat surfaces with channel switching and stable conversation history.
- [x] 3.2 Add message composer behavior that submits customer messages into the shared simulation flow.
- [x] 3.3 Display business replies returned from the automation hub in the originating channel.
- [x] 3.4 Verify multi-turn conversations remain ordered and inspectable during the active session.

## 4. Automation Inbox UI

- [x] 4.1 Build a ManyChat-like conversation list showing channel, customer, latest message, and processing status.
- [x] 4.2 Build a conversation detail panel showing transcript, detected intent, lifecycle timeline, ERP lookup evidence, and response draft.
- [x] 4.3 Add operator controls to approve and deliver drafted responses.
- [x] 4.4 Ensure approved responses update both the automation lifecycle and the originating social channel.

## 5. Tire Shop ERP UI

- [x] 5.1 Build ERP inventory view with tire size, brand, model, price, stock, and availability status.
- [x] 5.2 Build ERP services view with installation, balancing, alignment, rotation, repair, pricing, duration, and appointment context.
- [x] 5.3 Show which ERP records were used by the latest agent lookup from the automation workflow.
- [x] 5.4 Optionally add simple local stock or price editing if the core flow is complete.

## 6. Verification And Polish

- [x] 6.1 Add or run focused tests for ERP query helpers, intent detection, and response generation.
- [x] 6.2 Run the Next.js build and lint checks available in the project.
- [x] 6.3 Manually verify the end-to-end flow for Instagram and WhatsApp messages.
- [x] 6.4 Validate the OpenSpec change with `npx.cmd openspec validate simulate-social-manychat-erp-flow --strict`.
