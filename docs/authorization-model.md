# Authorization model (current) — H3 implemented

FBM Counter is a **single-tenant** app with **role permissions** plus **project-scoped object access** for Project Managers.

## Roles and permissions

Permission checks remain in `RolesGuard` (capability matrix). Object scope is enforced separately by `ProjectAccessService` (`apps/api/src/modules/authz/project-access.service.ts`), exported from the global `CommonModule`.

## Company-wide vs scoped

| Role | Project scope |
|------|----------------|
| ADMIN, MANAGEMENT, ACCOUNTING, VIEWER | Company-wide (`accessibleProjectIds` → `null`) |
| PROJECT_MANAGER | Only projects where `Project.projectManagerId === user.id` |

## Who can read / mutate projects

- `projects:read` / `projects:write` / `projects:delete` still gate the routes.
- In addition, every project load/mutation calls `assertCanAccessProject`.
- List endpoints AND `projectWhere(user)` into the Prisma filter.
- On create, a scoped PM may only assign themselves as `projectManagerId`.

## Linked finance & documents (H3)

Controllers pass `@CurrentUser()` into services. Services use:

- **List filters:** `invoiceWhere` / `expenseWhere` / `paymentWhere` / `documentWhere` / `budgetLineWhere`
- **Single-object asserts:** `assertCanAccessInvoice` / `Expense` / `Payment` / `Document` / `Project` / `OptionalProject`
- **Aggregates:** `accessibleProjectIds(user)` → `string[] \| null` (`null` = no filter)

Wired modules:

- Projects, invoices, expenses (incl. approve / recordPayment), payments, documents (**including download**), budgets
- Search (projects / invoices / expenses / documents scoped; customers / suppliers / subcontractors remain company-wide master data)
- Dashboard + `FinanceQueryService` (optional `projectIds` scope on aggregates)
- Reports (summary / CSV / PDF)
- Supplier & subcontractor **detail** financial history only (list master data stays company-wide)

## Unscoped rows

Invoices, expenses, payments, and documents with no assigned project are **hidden from PROJECT_MANAGER** (`assertCanAccessOptionalProject` rejects null `projectId` for scoped users).
