---
name: Apply link live-read vs snapshot
description: Why the public apply endpoints read live property/unit data instead of the link snapshot
---

The public applicant endpoints (`GET /api/apply/:token` and `GET /api/apply/link/:linkId`)
resolve property name, cover page, field schema, document requirements, compliance rules,
and property terms **live** from the unit→property chain. The `link.mergedSchemaJson`
snapshot is only a fallback for when that chain is unavailable.

**Why:** Landlords edit a property via PATCH `/api/rental/properties/:id`, which does NOT
re-sync existing links' `mergedSchemaJson`. If endpoints read from the snapshot, edits
(late fees, deposits, deadlines, name, cover page) silently fail to reach already-shared
links. Reading live makes edits propagate immediately without recreating links.

**How to apply:** When adding any field surfaced on the apply page, source it live from the
property/unit (respecting unit-level overrides: `fieldSchemaOverride*`, `coverPageOverride*`),
not from the snapshot. Treat live values as authoritative even when null/cleared
(`property.propertyTermsJson ?? {}`), otherwise a cleared field falls back to stale snapshot.
Unit-level rent/deposit are overlaid on top of property terms.
