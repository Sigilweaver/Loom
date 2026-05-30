# Terms of Use Template for Sigilweaver Loom Hub Operators

> [!CAUTION]
> **If you deploy Hub for others, you MUST have your own terms of use and privacy policy.**
>
> Sigilweaver Loom Hub handles workflows that access production databases, process sensitive data,
> and execute on schedules. Administrators configure grants for databases, file paths, credentials,
> and cloud storage. The audit logs record everything. Without clear terms, you have no defined
> relationship with your users - and no protection when things go wrong.
>
> This template is a starting point, not a finished document. If you're running Hub just for
> yourself, you don't need this.

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

> **For Hub Users:** If you're using a Hub instance operated by someone else, their terms
> (not this template) govern your use. Ask your Hub operator for their terms of use.

---

# [Your Organization] Sigilweaver Loom Hub Terms of Use

**Last updated:** [DATE]

## 1. Introduction and Acceptance

These Terms of Use ("Terms") govern your access to and use of the Sigilweaver Loom Hub instance operated by [Your Organization] ("we", "us", "our") at [your-hub-url] (the "Service").

By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.

**These Terms are solely between you and [Your Organization].** Sigilweaver Holdings LLC, Sigilweaver LLC, the Sigilweaver Loom open-source project, and its contributors are not parties to these Terms, do not operate this Hub instance, and have no responsibility for its operation, your data, or any disputes arising from your use. Your relationship is with [Your Organization] alone.

## 2. Description of Service

Sigilweaver Loom Hub is self-hosted workflow orchestration software deployed by [Your Organization]. The Service allows authorized users to:
- Upload, manage, and execute data transformation workflows
- Schedule automated workflow executions
- Access administrator-configured database connections, file paths, and cloud storage
- Collaborate with other authorized users
- Access execution history and audit logs (where permitted by role)

**The Service is provided "as is."** We are running an instance of open-source software; we did not create the software itself.

## 3. Account Registration and Security

### 3.1 Account Creation
To use the Service, you must create an account with a username and password. You agree to:
- Provide accurate information
- Maintain the security of your credentials
- Notify us immediately of any unauthorized access

### 3.2 Account Responsibility
You are responsible for all activity under your account. We are not liable for losses caused by unauthorized use of your account.

### 3.3 API Keys
If you generate API keys for programmatic access, you are responsible for keeping them secure. Treat API keys as passwords. We may revoke keys suspected of misuse.

## 4. Acceptable Use

### 4.1 You May
- Upload and execute workflows for [legitimate business purposes / your authorized work / etc.]
- Store credentials for databases you are authorized to access
- Share workflows and connections with other users as permitted by your role

### 4.2 You May Not
- Use the Service for any illegal purpose
- Attempt to access data or systems you are not authorized to access
- Upload workflows designed to harm systems, exfiltrate data, or circumvent security
- Share your account credentials with others
- Attempt to tamper with audit logs or circumvent logging
- Overload the Service with excessive requests or executions
- Reverse engineer, decompile, or attempt to extract source code (note: Sigilweaver Loom is open source under AGPL-3.0)
- Use the Service to violate any applicable law or regulation

### 4.3 Compliance
You are responsible for ensuring your use complies with all applicable laws, regulations, and your organization's policies. This includes but is not limited to:
- Data protection laws (GDPR, CCPA, etc.)
- Industry regulations (HIPAA, PCI-DSS, SOX, etc.)
- Export control laws
- Your organization's data governance policies

## 5. Your Data and Content

### 5.1 Ownership
**[Your Organization] owns all content created or uploaded to the Service**, including:
- Workflows created or uploaded by users
- Execution outputs and results
- Any other content submitted to the Service

Data processed by workflows (which passes through but is not stored by Hub) belongs to whoever owns the source systems.

[Alternative language if you want users to retain ownership:
> You retain ownership of workflows you create or upload, data processed by your workflows,
> and any content you submit to the Service. However, [Your Organization] retains a perpetual,
> irrevocable license to use such content for business purposes.]

### 5.2 License
By uploading content to the Service, you grant [Your Organization] a perpetual, irrevocable, worldwide license to store, process, display, modify, and use that content for any business purpose. Audit logs cannot be deleted.

### 5.3 Workflow Execution
When you execute a workflow:
- **Data flows through Hub** from source to destination but is not permanently stored
- **Metadata is logged** including row counts, timing, and any errors
- **Audit records are permanent** - we log that the execution happened, but not the data itself

### 5.4 Database Credentials
If you store database connection credentials:
- Credentials are encrypted at rest
- You are responsible for ensuring you have authorization to access those databases
- We may log connection usage for security purposes
- You should rotate credentials if you suspect compromise

## 6. Audit Logs and Monitoring

### 6.1 Comprehensive Logging
The Service maintains detailed audit logs of all activity including:
- Authentication events (logins, logouts, failures)
- Workflow operations (uploads, deletions, modifications)
- Execution events (what ran, when, by whom)
- Administrative actions
- Connection usage

### 6.2 Immutability
**Audit logs cannot be deleted or modified.** This is a feature, not a bug - it provides tamper-evident records for security and compliance. By using the Service, you consent to this logging.

### 6.3 Access to Logs
- Administrators and auditors can view logs
- You may request logs related to your own activity
- Logs may be disclosed if required by law

## 7. Privacy

Your use of the Service is also governed by our [Privacy Policy](link-to-your-privacy-policy). Please review it to understand what data we collect and how we use it.

## 8. Service Availability and Support

### 8.1 Availability
We [do/do not] guarantee any specific uptime or availability. The Service is provided on an [as-available / best-effort / X% SLA] basis.

[If applicable: See our Service Level Agreement for uptime commitments.]

### 8.2 Maintenance
We may perform maintenance that temporarily interrupts the Service. We will [try to provide notice / provide X hours notice / etc.] when possible.

### 8.3 Support
Support is provided [via email at X / through Y ticketing system / not provided / etc.].

## 9. Termination

### 9.1 By You
You may stop using the Service at any time. To delete your account, [contact us at X / use the account settings / etc.].

### 9.2 By Us
We may suspend or terminate your access:
- For violation of these Terms
- For suspected security issues
- For non-payment (if applicable)
- At our discretion with [X days] notice

### 9.3 Effect of Termination
Upon termination:
- Your access will be revoked
- Your workflows and data may be deleted after [X days]
- Audit logs will be retained per our retention policy
- Provisions that should survive (warranties, liability limits, etc.) will survive

## 10. Disclaimers

### 10.1 "As Is" Basis
THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.

### 10.2 No Guarantee of Results
We do not guarantee that:
- The Service will be uninterrupted or error-free
- Workflows will execute successfully or produce correct results
- Data will not be lost or corrupted
- The Service will meet your requirements

### 10.3 Underlying Software
Sigilweaver Loom Hub is open-source software provided under the AGPL-3.0 license. We are hosting an instance of this software but did not create it. 

**Sigilweaver Holdings LLC, Sigilweaver LLC, the Sigilweaver Loom project, and its contributors:**
- Did not create this Hub instance
- Do not operate this Hub instance
- Have no access to your data
- Are not responsible for how we operate this service
- Provide the software "as is" without warranties of any kind

See the [Sigilweaver Loom license](https://github.com/Sigilweaver/Loom/blob/main/LICENSE.md) for the software's terms.

## 11. Limitation of Liability

### 11.1 Exclusion of Damages
TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
- Loss of data
- Loss of profits or revenue
- Business interruption
- Cost of substitute services

### 11.2 Cap on Liability
OUR TOTAL LIABILITY SHALL NOT EXCEED [THE AMOUNT YOU PAID US IN THE PAST 12 MONTHS / $X / THE GREATER OF...].

[Adjust based on whether this is a paid service]

### 11.3 Exceptions
Some jurisdictions do not allow limitation of liability for certain damages. In such cases, limitations apply to the extent permitted.

## 12. Indemnification

You agree to indemnify and hold harmless [Your Organization], its officers, employees, and agents from any claims, damages, or expenses (including legal fees) arising from:
- Your use of the Service
- Your violation of these Terms
- Your violation of any law or third-party rights
- Content you upload or workflows you execute

## 13. Changes to Terms

We may update these Terms from time to time. We will notify you of material changes by [email / posting notice in the Service / X days before they take effect].

Continued use after changes take effect constitutes acceptance. If you do not agree, you must stop using the Service.

## 14. General Provisions

### 14.1 Governing Law
These Terms are governed by the laws of [Your State/Country], without regard to conflict of law principles.

### 14.2 Dispute Resolution
Any disputes shall be resolved [in the courts of X / through binding arbitration / etc.].

### 14.3 Severability
If any provision is found unenforceable, the remaining provisions remain in effect.

### 14.4 Entire Agreement
These Terms, together with the Privacy Policy [and any SLA], constitute the entire agreement between you and us regarding the Service.

### 14.5 No Waiver
Failure to enforce any provision does not waive our right to enforce it later.

### 14.6 Assignment
You may not assign your rights under these Terms without our consent. We may assign our rights freely.

## 15. Contact

For questions about these Terms:
- Email: [legal/terms contact]
- [Other contact methods]

---

## Appendix: Quick Reference for Users

| Topic | Summary |
|-------|---------|
| **What you can do** | Upload workflows, execute them, store connections, collaborate |
| **What we log** | Everything - logins, actions, executions, errors (audit logs are permanent) |
| **Your data** | You own it; we store it to provide the service |
| **Credentials** | Encrypted at rest; you're responsible for authorization |
| **Liability** | Limited; service provided "as is" |
| **Termination** | Either party can end; audit logs survive |

---

*This template is provided by the Sigilweaver Loom project under CC0 (public domain). 
Modify freely for your organization's needs.*
