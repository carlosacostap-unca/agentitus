## ADDED Requirements

### Requirement: Tire inventory data
The system SHALL provide ERP demo data for tires including size, brand, model, price, stock quantity, and availability status.

#### Scenario: View tire inventory
- **WHEN** the user opens the ERP inventory view
- **THEN** the system displays tire records with size, brand, model, price, stock, and availability

### Requirement: Service and appointment data
The system SHALL provide ERP demo data for tire-shop services such as installation, balancing, alignment, rotation, repair, and appointment availability.

#### Scenario: View available services
- **WHEN** the user opens the ERP services view
- **THEN** the system displays service names, estimated prices or price ranges, durations, and availability context

### Requirement: Queryable ERP data for agent responses
The ERP module SHALL expose inventory and service data to the agent workflow through internal query functions or equivalent application logic.

#### Scenario: Agent queries tire size availability
- **WHEN** the agent workflow requests availability for a specific tire size
- **THEN** the ERP module returns matching tire records with stock and price information

#### Scenario: Agent queries service information
- **WHEN** the agent workflow requests information about a tire-shop service
- **THEN** the ERP module returns matching service details suitable for a customer-facing reply

### Requirement: ERP context remains visible during automation
The system SHALL make the ERP record or records used by the agent visible from the automation workflow.

#### Scenario: ERP lookup evidence is shown
- **WHEN** the agent uses ERP data to answer a customer question
- **THEN** the automation console displays the ERP data source or lookup result used for that answer
