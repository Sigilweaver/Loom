# Privacy Policy Template for Sigilweaver Hub Operators

> [!CAUTION]
> **If you deploy Hub for others, you MUST have your own privacy policy and terms of use.**
>
> Sigilweaver Hub is enterprise-grade software designed with compliance in mind. It collects
> detailed, immutable audit logs of all user activity — who did what, when, from where. It
> stores workflow definitions, execution history, administrator-configured credentials, and
> session data including IP addresses. This data may be highly sensitive depending on the
> workflows and systems Hub connects to.
>
> Deploying Hub for others without clear privacy and terms documentation exposes you to
> significant legal liability. Your users have a right to know what you collect, who can
> access it, how long you retain it, and what happens if there's a breach.
>
> If you're running Hub just for yourself, you don't need this.

---

> [!IMPORTANT]
> **THIS IS NOT LEGAL ADVICE**
>
> This template is provided as a convenience to reduce friction for Hub operators. It is
> generic, incomplete, and **cannot account for your specific situation**. Laws vary by
> jurisdiction. Your organization has unique requirements. One size does not fit all.
>
> **You must:**
> - Review and customize this template for your organization
> - Have your legal counsel review it before publishing
> - Update it when your practices or applicable laws change
> - Ensure it's consistent with your actual practices
>
> Sigilweaver LLC provides this template "as is" with no warranties. We are not responsible
> for any legal issues arising from your use of this template or failure to customize it
> appropriately.

---

> [!WARNING]
> **NO ATTORNEY-CLIENT RELATIONSHIP**
>
> Downloading, reading, or using this template does not create any legal relationship
> between you and Sigilweaver Holdings LLC, Sigilweaver LLC, the Sigilweaver project,
> or its contributors. We are not your lawyers. You use this template entirely at your
> own risk.

---

> **For Hub Users:** If you're using a Hub instance operated by someone else, their
> privacy policy (not this template) governs your data. Ask your Hub operator for their
> privacy policy.

---

# [Your Organization] Sigilweaver Hub Privacy Policy

**Last updated:** [DATE]

## 1. Introduction

This Privacy Policy describes how [Your Organization] ("we", "us", "our") collects, uses, and protects information when you use our Sigilweaver Hub deployment at [your-hub-url].

**This policy is solely between you and [Your Organization].** Sigilweaver Holdings LLC, Sigilweaver LLC, the Sigilweaver open-source project, and its contributors are not parties to this policy, do not operate this Hub deployment, have no access to your data, and bear no responsibility for how [Your Organization] handles your information.

Sigilweaver Hub is self-hosted workflow orchestration software. Administrators configure access to databases, file systems, and cloud storage. When you use our Hub deployment, we collect and process data as described below.

## 2. Information We Collect

### 2.1 Account Information

When you create an account, we collect:
- **Username** — your chosen identifier
- **Password** — stored as a secure hash (we cannot read your password)
- **API keys** — if you generate them for programmatic access

### 2.2 Session Data

When you log in, we record:
- **IP address** — for security and session management
- **User agent** — browser/client information
- **Session timestamps** — login time, last activity, expiration

### 2.3 Workflow Data

When you upload or create workflows, we store:
- **Workflow files (.swwf)** — your pipeline definitions
- **Workflow metadata** — name, description, author, tags, folder path
- **Upload metadata** — who uploaded, when, checksums

### 2.4 Execution Records

When workflows run, we record:
- **Execution status** — queued, running, completed, failed
- **Timing data** — start time, end time, duration
- **Trigger information** — who/what started the execution (user, schedule, API)
- **Output summary** — row counts, column counts, byte sizes (not your actual data)
- **Error messages** — if the execution failed
- **Connections used** — which database connections were accessed

### 2.5 Audit Logs

**This is important:** Hub maintains detailed, tamper-evident audit logs of all significant actions. These logs are designed to be immutable and include:

| Event Type | What We Log |
|------------|-------------|
| **Authentication** | Login attempts (success/failure), logouts, session creation |
| **User actions** | Who did what, when, from which IP address |
| **Workflow operations** | Uploads, downloads, deletions, modifications |
| **Execution events** | Start, completion, failures, cancellations |
| **Administrative actions** | User management, permission changes, configuration changes |
| **Connection access** | Which connections were used, by whom, when |

Audit logs include:
- Timestamp
- Actor (user, schedule, or system)
- Client IP address
- User agent
- Event-specific details
- Cryptographic hash chain for tamper evidence

**Audit logs cannot be deleted or modified** — this is by design for security and compliance. Administrators and auditors can view these logs.

### 2.6 Connection Credentials

If you store database connection credentials in Hub:
- Credentials are encrypted at rest using Fernet symmetric encryption
- Only authorized users can use connections (not view raw credentials)
- Connection usage is logged in audit trails

## 3. Who Can See Your Data

### 3.1 Regular Users
- Can see their own workflows and executions
- Can see workflows/connections shared with their groups
- Cannot see other users' private data
- Cannot see audit logs

### 3.2 Auditors
- Can view audit logs
- Can see execution history across the system
- Cannot modify data

### 3.3 Administrators
- Full access to all data, users, and configuration
- Can view audit logs
- Can manage user accounts and permissions
- Can access connection credentials (encrypted)

### 3.4 Your Organization's Staff
[Describe who in your organization has administrative access and why]

## 4. Data Retention

| Data Type | Retention Period |
|-----------|------------------|
| User accounts | [X days/months/years] after account deletion request |
| Workflow files | [X days/months/years] after deletion |
| Execution records | [X days/months/years] |
| Audit logs | [X days/months/years] — **cannot be deleted early** |
| Session data | Until logout or [X days] expiration |

## 5. Data Security

We implement the following security measures:
- [ ] HTTPS encryption in transit
- [ ] Encrypted credentials at rest
- [ ] Secure password hashing (bcrypt/argon2)
- [ ] Session token hashing
- [ ] Role-based access control
- [ ] Tamper-evident audit logging

[Add your organization's specific security measures]

## 6. Data Sharing

We do not sell your data.

We may share data:
- **With your consent** — when you explicitly agree
- **Within your organization** — as permitted by your role/groups
- **Legal requirements** — if required by law or court order
- **Service providers** — [list any third parties, e.g., cloud hosting provider]

## 7. Your Rights

Depending on your jurisdiction, you may have rights to:
- **Access** — request a copy of your data
- **Correction** — fix inaccurate data
- **Deletion** — request deletion (note: audit logs cannot be deleted)
- **Portability** — export your workflows
- **Objection** — object to certain processing

To exercise these rights, contact: [contact information]

## 8. Data Location

Your data is stored in: [location/region/country]

[If applicable: Data may be transferred to X jurisdiction for Y reason]

## 9. Third-Party Services

This Hub instance uses:
- **Hosting:** [Your hosting provider] — [link to their privacy policy]
- **Database:** [PostgreSQL hosted on X] — [if relevant]
- [Add any other services]

## 10. Children's Privacy

This service is not intended for users under [13/16/18] years of age.

## 11. Changes to This Policy

We will notify you of material changes by [email / Hub notification / posting here].

## 12. Contact

For privacy questions or requests:
- Email: [privacy contact]
- [Other contact methods]

---

## Appendix: Audit Event Types

For transparency, here are the event types logged by Hub:

```
# Authentication
auth.login.success
auth.login.failure
auth.logout
auth.session.created
auth.session.expired
auth.api_key.used

# User Management
user.created
user.updated
user.deleted
user.password.changed
user.role.changed

# Workflow Operations
workflow.uploaded
workflow.downloaded
workflow.updated
workflow.deleted
workflow.moved

# Execution Events
execution.queued
execution.started
execution.completed
execution.failed
execution.cancelled

# Schedule Operations
schedule.created
schedule.updated
schedule.deleted
schedule.triggered

# Connection Operations
connection.created
connection.updated
connection.deleted
connection.used
connection.test.success
connection.test.failure

# Group/Permission Changes
group.created
group.updated
group.deleted
group.member.added
group.member.removed

# Server Management
server.registered
server.updated
server.deleted
server.health.changed

# Administrative
admin.config.changed
admin.audit.exported
```

---

*This template is provided by the Sigilweaver project under CC0 (public domain). 
Modify freely for your organization's needs.*
