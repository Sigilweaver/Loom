---
sidebar_position: 4
---

# Groups

Groups control which connections users can access. Users see connections from all groups they belong to.

## Managing Groups

From **Admin > Groups**:

- **Create** - Name and optional description
- **Add members** - Only users with User role can be added (not admins)
- **Add connections** - Assign connections to make them visible to members
- **Remove** - Members lose access to connections immediately

## Example Structures

**By team:**
- `engineering` - Engineering databases
- `analytics` - Data warehouse access

**By environment:**
- `production` - Production database access
- `development` - Dev/staging databases

**By project:**
- `project-alpha` - Cross-functional team access

Users can be in multiple groups and see connections from all of them.
