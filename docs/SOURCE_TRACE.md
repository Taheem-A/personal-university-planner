# Source trace

The master **Personal University Planning System**, **University Planner — Implementation Roadmap**, approved mockups and accepted ADRs define the implementation. See [the authority hierarchy](../SOURCE_BOUNDARY.md). Package contracts and stored future-facing entities do not prove a production workflow exists; [implementation status](./IMPLEMENTATION_STATUS.md) identifies the current milestone boundary.

## Code → specification trace

- `apps/web/src/server/application` → authenticated actor, canonical validation, conditional transactions, read projections and authoritative planner execution (ADRs 0003–0006, 0008–0010).
- `apps/web/src/app` and `components` → frozen screen, interaction, responsive/accessibility contracts and M5/M6 production surfaces (ADRs 0007–0010).

- `packages/planner-core` → Technical & System Design Specification; Planner Behavior & Decision Policy; Domain & Data Semantics.
- `packages/database/prisma/schema.prisma` → Technical & System Design Specification; Domain & Data Semantics.
- `packages/integrations` → preparatory Integrations & Data Authority contracts; provider synchronization is not implemented.
- `packages/assistant` → Trust, Explainability & User Control; Interaction & State Contract; assistant architecture in the technical specification.
- `packages/analytics` → isolated helper aligned with Personalization & Learning Policy; no production learning workflow.
- `prototypes/approved-preview/styles.css` → Visual Design System Specification; UI Component System & Tokens; Responsive, Motion & Accessibility Contract.
- `prototypes/approved-preview/app.js` → UX & Information Architecture Specification; Screen Design Specifications; Interaction & State Contract; MVP Interface Contract & Handoff.
- `prototypes/approved-preview` page composition → approved Today, Week, Scenario Preview, Upcoming + Assessment Detail, Inbox + Quick Capture, mobile, and ecosystem mockup images.

When a generated mockup contains decoration that conflicts with the written frozen contract, the written contract wins. This is why motivational quote/filler treatments from some mockups were not implemented.
