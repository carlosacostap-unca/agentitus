## ADDED Requirements

### Requirement: Centralized conversation intake
The system SHALL route every simulated social customer message into a ManyChat-like automation inbox.

#### Scenario: New social message appears in inbox
- **WHEN** a customer sends a message from Instagram or WhatsApp
- **THEN** the automation inbox displays a corresponding conversation item with channel, customer, latest message, and processing status

### Requirement: Conversation processing status visibility
The system SHALL show processing status for each customer message handled by the automation hub.

#### Scenario: Message processing status is visible
- **WHEN** the automation hub receives a customer message
- **THEN** the system displays the conversation status and detected intent without requiring separate evidence or pipeline panels

### Requirement: Operator can inspect conversation details
The system SHALL allow the user to open a conversation in the automation console and inspect messages, detected intent, and generated response.

#### Scenario: Open conversation details
- **WHEN** the user selects a conversation in the automation inbox
- **THEN** the system displays the conversation transcript, detected intent, latest customer message, and current draft response when available

### Requirement: Manual send control for drafted replies
The system SHALL support a mode where an operator can review a drafted response before it is delivered to the social channel.

#### Scenario: Operator approves a draft
- **WHEN** a draft response is available and the operator approves it
- **THEN** the system marks the response as delivered and sends it back to the originating simulated social channel

#### Scenario: Operator edits an inline draft before sending
- **WHEN** a draft response is available in the conversation transcript
- **THEN** the system displays it as an editable business reply with controls to restore the generated text or send the edited response
