# Known limitations — FBM Counter

Honest product and technical limitations for operators and stakeholders.

## Authorization

- **VIEWER** remains **company-wide** read access (no project assignment model).
- **PROJECT_MANAGER** is scoped by `Project.projectManagerId` only — there is no multi-assignee ACL table.
- Master data lists (customers / suppliers / subcontractors) remain visible to PMs who have the corresponding read permission; **project-linked financial history** on detail pages is scoped.

## CSRF / cookies

- Production relies on **SameSite=Lax or Strict** cookies for CSRF mitigation.
- **`COOKIE_SAME_SITE=none` is rejected** until explicit CSRF tokens (double-submit or synchronizer) are implemented.
- Cross-site SPA hosting on a different registrable domain is therefore unsupported.

## Finance / tax

- **Mixed VAT rates on one invoice are not supported** (single header `taxRate`).
- Application VAT math is **not** a claim of German tax-law compliance — accounting/legal review remains external.
- API field `totalRevenue` is a legacy name meaning **cash received**, not accrued invoiced revenue.

## Documents / storage

- Soft-deleted blobs are purged after `DOCUMENT_BLOB_RETENTION_DAYS` (default 30), not immediately.
- Local disk storage requires volume backups; S3 requires separate bucket protection.

## Platform

- No formal customer number sequence (customers identified by id / company name).
- No vendor APM baked in — metrics are in-process ADMIN endpoint + structured logs.
- Accessibility / responsive polish is smoke-level, not WCAG certification.
- Multi-tenant SaaS isolation (separate companies) is out of scope — single-tenant company model.

## Seeding

- Demo users/passwords exist for development. Production seed requires explicit `ALLOW_SEED=true` and still must not be used against live business data.
