---
sidebar_position: 9
title: Grant Groups
---

# Grant Groups

Grant Groups are reusable permission bundles that contain connections. Instead of assigning connections directly to user groups, you assign grant groups. This provides a single audit path and enables permission reuse across teams.

## Why Grant Groups?

### Without Grant Groups (problematic)

```
Engineering -> [Prod DB, Dev DB, Analytics DB]
Analytics   -> [Analytics DB, Data Warehouse]
DevOps      -> [Prod DB, Dev DB, Monitoring DB]
```

If you need to revoke production access from all teams, you must edit each group individually.

### With Grant Groups (recommended)

```
Grant Groups:
  Production DBs    -> [Prod DB]
  Development DBs   -> [Dev DB]  
  Analytics DBs     -> [Analytics DB, Data Warehouse]
  Monitoring        -> [Monitoring DB]

User Groups:
  Engineering -> [Production DBs, Development DBs, Analytics DBs]
  Analytics   -> [Analytics DBs]
  DevOps      -> [Production DBs, Development DBs, Monitoring]
```

To revoke production access, remove "Production DBs" from the relevant user groups. One place to audit, one place to change.

## Managing Grant Groups

From **Admin > Grant Groups**:

### Creating Grant Groups

Click **Create Grant Group** and provide:
- **Name** - Descriptive identifier (e.g., "Production Databases", "Analytics Read-Only")
- **Description** - Document what access this grants and why

### Adding Connections

1. Select a grant group from the list
2. In the **Connections** section, click **Add Connection**
3. Select connections to include

A connection can belong to multiple grant groups. For example, a database might be in both "Production Databases" and "Read-Only Analytics".

### Viewing User Groups

The **User Groups** section shows which user groups have this grant group assigned. This is **read-only** - to modify assignments, go to **Admin > User Groups** and edit the user group directly.

This enforces the parent -> child hierarchy and provides a clear audit trail.

## Permission Flow

When a user tries to access a connection, Hub traces the path:

```
User (alice)
  `-- Member of: Engineering (User Group)
        `-- Has Grant Group: Production DBs
              `-- Contains: prod-postgres (Connection)
                    -> Access granted
```

If any link in this chain is missing, access is denied.

## Common Patterns

### Environment-Based

```
Production Databases
  `-- prod-postgres, prod-mysql, prod-redis

Staging Databases  
  `-- staging-postgres, staging-mysql

Development Databases
  `-- dev-postgres, dev-mysql
```

### Function-Based

```
Read-Only Analytics
  `-- analytics-replica, data-warehouse (read-only credentials)

Application Databases
  `-- app-postgres, app-redis (read-write credentials)

Admin Access
  `-- all databases (admin credentials)
```

### Project-Based

```
Project Alpha Resources
  `-- alpha-db, alpha-cache, alpha-queue

Shared Services
  `-- auth-db, logging-db, metrics-db
```

## Cascade Behavior

### Deleting a Grant Group

When you delete a grant group:
- All user group assignments are removed
- All connection assignments are removed
- Users immediately lose access to those connections (unless they have access through another grant group)

### Deleting a Connection

When you delete a connection:
- It's removed from all grant groups automatically
- Users lose access immediately

### Deleting a User Group

When you delete a user group:
- All grant group assignments to that user group are removed
- Users in that group lose access to connections (unless they have access through another group)

## Auditing Access

To audit why a user has access to a connection:

1. Go to **Admin > User Groups**
2. Find the user's groups (check each group's Members tab)
3. For each group, check the **Grant Groups** tab
4. For each grant group, check the **Connections** section

Or in reverse - from **Admin > Grant Groups**:

1. Select the grant group containing the connection
2. Check the **User Groups** section to see which teams have access
3. For each user group, check its members

## Best Practices

1. **Name grant groups by what they grant**, not who uses them
   - Good: "Production Databases"
   - Bad: "Engineering Database Access"

2. **Keep grant groups focused** - one logical set of resources per group

3. **Document the purpose** in the description field

4. **Use consistent naming conventions**:
   - `Production *` for prod resources
   - `* Read-Only` for read-only access
   - `* Admin` for administrative access

5. **Review assignments quarterly** - teams and access needs change
