## ADDED Requirements

### Requirement: Separate simulated social channel screens
The system SHALL provide Instagram and WhatsApp as separate simulated customer messaging screens inside the web application.

#### Scenario: Customer opens Instagram screen
- **WHEN** the user opens the Instagram screen
- **THEN** the system displays an Instagram direct-message style surface with customer messages and business replies for that channel

#### Scenario: Customer opens WhatsApp screen
- **WHEN** the user opens the WhatsApp screen
- **THEN** the system displays a WhatsApp conversation style surface with customer messages and business replies for that channel

#### Scenario: Customer sends a message
- **WHEN** the user writes a customer message in a simulated channel and sends it
- **THEN** the system records the message with its originating channel, customer identity, timestamp, and conversation association

### Requirement: Delivered replies return to the originating channel
The system SHALL display automation replies in the same simulated channel where the customer message originated.

#### Scenario: Reply delivered to Instagram
- **WHEN** a response is generated for a customer message that originated from Instagram
- **THEN** the Instagram chat surface displays the response as a business reply in that conversation

#### Scenario: Reply delivered to WhatsApp
- **WHEN** a response is generated for a customer message that originated from WhatsApp
- **THEN** the WhatsApp chat surface displays the response as a business reply in that conversation

### Requirement: Social conversations remain inspectable
The system SHALL preserve conversation history during the active simulation session.

#### Scenario: Conversation history after multiple turns
- **WHEN** the customer sends multiple messages and receives multiple replies in the same channel
- **THEN** the system displays the full ordered conversation history for that active session

### Requirement: Simulated channel users can be added
The system SHALL allow the user to add simulated customer profiles independently for Instagram and WhatsApp.

#### Scenario: Add Instagram user
- **WHEN** the user enters a customer name and Instagram handle on the Instagram screen and submits it
- **THEN** the system creates a new Instagram customer conversation and selects it

#### Scenario: Add WhatsApp user
- **WHEN** the user enters a customer name and phone number on the WhatsApp screen and submits it
- **THEN** the system creates a new WhatsApp customer conversation and selects it
