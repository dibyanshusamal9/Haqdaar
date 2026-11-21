# Engineering documentation

Haqdaar.ai separates profile capture and extraction from deterministic eligibility matching.
The documents follow the software-engineering life cycle; the academic report records the
original requirements.

## 1. Requirements

- [Requirements traceability](requirements/traceability.md): report requirements mapped to implementation and verification gaps.
- [Mid-semester report](reports/Haqdaar_ai_Mid_Sem_Report_LaTeX.pdf): the original specification.

## 2. Design

- [Architecture](design/architecture.md): subsystems, ingestion, matching, the phone line and data stores.
- [Design decisions](design/decisions.md): reasons behind the structure.
- [API contract](design/api.md): endpoints, validation and authentication.

## 3. Implementation

- [Local setup](development/setup.md): dependencies, environment, database and app startup.
- [Repository map](development/repository.md): where each kind of file belongs.
- [Development workflow](development/README.md): changes, builds and module boundaries.

## 4. Testing

- [Testing](testing/testing.md): automated coverage and manual scenarios.
- [Verification](testing/verification.md): checks run and their limitations.

## 5. Deployment and operations

- [Operations](operations/README.md): migrations, refresh, the phone line, recovery and troubleshooting.
- [Security](../SECURITY.md): secrets, personal data and deployment boundaries.

## 6. Reports and presentations

- [Reports](reports/): the mid-semester report (PDF) and its LaTeX source archive.
- [Pitch deck](presentations/Haqdaar_Pitch_Deck.pptx): the hackathon proposal.

Update the relevant guide whenever a command, interface, path or behavior changes.
Coverage claims refer to existing tests; performance targets are not measured guarantees.
