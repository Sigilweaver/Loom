---
sidebar_position: 8
title: User Groups
---

# User Groups

User Groups organize users and control what resources they can access. A user sees connections from all groups they belong to.

## How Access Works

Hub uses a three-level permission hierarchy:

```
Users -> User Groups -> Grant Groups -> Connections
```

1. **Users** are added to **User Groups** (organizational structure)
2. **Grant Groups** are assigned to **User Groups** (permission bundles)
3. **Connections** are added to **Grant Groups** (actual resources)

A user can access a connection only if there's a complete path through this hierarchy.

## Managing User Groups

From **Admin > User Groups**:

### Creating Groups

Click **Create Group** and provide:
- **Name** - Unique identifier (e.g., "Engineering", "Analytics")
- **Description** - Optional context for administrators

### Adding Members

1. Select a group from the list
2. Go to the **Members** tab
3. Click **Add Member** and select users

Only users with the **User** role can be added to groups. Admins and auditors have access to all resources by default.

### Assigning Grant Groups

1. Select a group from the list
2. Go to the **Grant Groups** tab
3. Click **Assign Grant Group** and select from available grant groups

When you assign a grant group, all members of the user group immediately gain access to the connections in that grant group.

## Example Structures

### By Team

```
Engineering (User Group)
|-- Members: alice, bob, charlie
`-- Grant Groups: Production DBs, Dev DBs

Analytics (User Group)  
|-- Members: diana, eve
`-- Grant Groups: Data Warehouse, Dev DBs
```

### By Access Level

```
Production Access (User Group)
|-- Members: alice, bob (senior engineers)
`-- Grant Groups: Production DBs

Development Only (User Group)
|-- Members: charlie, diana (junior devs)
`-- Grant Groups: Dev DBs
```

### By Project

```
Project Alpha (User Group)
|-- Members: alice, diana, eve
`-- Grant Groups: Alpha DBs, Shared Resources
```

## Access Changes

When you modify group membership or grant group assignments:

- **Adding a user to a group**: User immediately gains access to all connections in the group's grant groups
- **Removing a user from a group**: User immediately loses access to connections (unless they have access through another group)
- **Assigning a grant group**: All group members immediately gain access to the grant group's connections
- **Removing a grant group**: All group members immediately lose access to those connections (unless they have access through another group)

## Best Practices

1. **Name groups by purpose**, not by individual access needs
2. **Use grant groups for permission bundles** - don't create a user group for each unique combination of connections
3. **Document group purposes** in descriptions
4. **Review memberships regularly** when team members change roles
5. **Users can be in multiple groups** - use this to grant additional access without restructuring
