---
sidebar_position: 2
---

# Roles and Permissions

Hub has four roles with a strict separation between administration and operation.

## Permission Matrix

Read the table as: **C**reate, **R**ead, **U**pdate, **D**elete. A dash means no access.

| Resource | Owner | Admin | Auditor | User |
|----------|-------|-------|---------|------|
| Users | CRUD | CRUD | R | - |
| Groups | CRUD | CRUD | R | R (own) |
| Connections | CRUD | CRUD | R | R (own groups) |
| Servers | CRUD | CRUD | R | R (own groups) |
| Workflows | RD (all) | RD (all) | R | CRUD (own) |
| Schedules | RD (all) | RD (all) | R | CRUD (own) |
| Executions | R | R | R | CR (own) |

**Key points:**
- Admins can delete any workflow/schedule but cannot create or edit them
- Users can only see workflows, schedules, and executions they created
- Users can see their own group memberships
- Users can see connections and servers assigned to groups they belong to
- Only users with the User role can trigger executions

## Why Admins Cannot Run Workflows

Administrators manage infrastructure. Users operate it. This separation provides:

- **Audit clarity** - Administrative actions are distinct from operational use
- **Least privilege** - Admins don't need workflow execution to do their job
- **Compliance** - Clear role boundaries for SOX, HIPAA, etc.

If someone needs both capabilities, create two accounts.

## Group Membership

Only users with the User role can be members of groups. Admin-level users (Owner, Admin, Auditor) cannot be added to groups because:

- Admins already see all resources regardless of group membership
- Groups control resource access for regular users only

## Server Selection

When creating schedules or triggering executions, users can optionally select a specific server from their available servers (those assigned to their groups). If no server is specified, Hub automatically selects an available server using round-robin load balancing.

Admins assign servers to groups to control which user teams can access which compute resources. This enables:

- **Resource isolation** - Production servers for production teams
- **Cost management** - High-performance servers for specific workloads
- **Compliance** - Dedicated servers for sensitive data processing
