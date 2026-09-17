# Authorization model (current) — H3 deferred

FBM Counter is currently a **single-tenant company-wide** app.

## Who can read projects

Roles with `projects:read`: ADMIN, MANAGEMENT, ACCOUNTING, PROJECT_MANAGER, VIEWER.

Any authenticated user with that permission can open **any** project by ID.
There is **no** assignment-scoped ACL for Project Managers.

## Who can modify projects

Roles with `projects:write`: ADMIN, PROJECT_MANAGER (and ADMIN via full matrix).

Deletes require `projects:delete` (ADMIN).

## Project Managers today

Company-wide: a PM can read/write all projects, not only those where they are
`projectManagerId`. H3 (project-scoped ACL) is intentionally **not** implemented
in this remediation batch and needs a separate product decision.
