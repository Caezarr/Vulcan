---
feature: slug-case-name
title: "Human Readable Feature Title"
status: draft          # draft | ready | in-progress | shipped
priority: medium       # low | medium | high | critical
target_dir: /absolute/path/to/project
stack:
  backend: node        # node | python | go | none
  frontend: react      # react | vue | svelte | vanilla | none
  api: rest            # rest | graphql | none
  db: postgres         # postgres | sqlite | mysql | mongo | none
skip_agents: []        # e.g. ["db"] to skip DB agent if no schema changes
requires_security_review: true
---

## Problem

<!-- One paragraph: what user pain or business need does this solve? Why now? -->

## Success Criteria

<!-- Measurable, observable outcomes. Reviewer agents check these. -->
- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>

## Scope

### In scope
- <explicit thing included>
- <explicit thing included>

### Out of scope
- <explicit thing excluded — prevents scope creep in agents>

## Technical Context

<!--
What already exists that agents must understand before touching anything.
File paths, existing API contracts, DB table names, auth requirements.
List things that must NOT be broken.
-->

## Design / UX Notes

<!--
Wire descriptions, component names, interaction patterns.
Figma links, screenshots, or ASCII sketches welcome.
Leave blank if this is backend-only.
-->

## API Contract

<!--
Endpoint signatures, request/response shapes, auth requirements.
Example:

POST /api/users
Authorization: Bearer {token}
Body: { "email": string, "name": string }
Response 201: { "id": string, "email": string, "name": string }
Response 400: { "error": string }

If unknown, write "architect to define" and the architect agent will fill this in.
-->

## Data Model

<!--
New tables, columns, indexes, or migrations needed.
Example:

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

If unknown, write "architect to define".
-->

## Acceptance Test Sketches

<!--
Informal test cases the reviewer agents verify against.
Format: given <precondition>, when <action>, then <outcome>
-->
1. Given <precondition>, when <action>, then <outcome>
2. Given <precondition>, when <action>, then <outcome>
