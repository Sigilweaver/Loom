---
slug: sustainable-open-source
title: "Building Sustainable Open Source: Legal Structure, Licensing, and the Long Game"
authors: [sigilweaver]
tags: [open-source, business-model, legal, sustainability]
---

# Building Sustainable Open Source: Legal Structure, Licensing, and the Long Game

Most open source projects fail not because the code is bad, but because the maintainers burn out or run out of money. We encounter this problem frequently in the ecosystem. We represent Sigilweaver as a long-term project, and that requires deliberate choices about legal structure, licensing, and business model from day one - not as an afterthought when GitHub stars hit 10k.

This post outlines the model we are using. It's not the only way, but it's one that balances sustainability with open source values. We are sharing this in detail so other maintainers can use it as a template.

:::info TL;DR
- **PropCo/OpCo split**: Separate entities for IP (PropCo) and operations (OpCo) for liability isolation
- **AGPL + Commercial dual licensing**: Open source for community, paid licenses for enterprises
- **CLA with reversion clause**: Contributors assign IP, but it auto-reverts if PropCo closes the source or sells to a for-profit
- **Start strong, can relax later**: You can relicense from AGPL → MIT, but never MIT → AGPL allows forking the last MIT version.
- **Set up an LLC early**: Code signing on Windows requires a 3-year-old business entity
:::

<!--truncate-->

## The Core Philosophy: Code is Abundant; Trust and Liability are Scarce

You can fork any repo. You can clone any codebase. **Code is abundant.**

But can you put that software in production when your company's general counsel asks "Who do we sue if this breaks?" Can you get past procurement when IT security flags an unknown license? **Trust and liability are scarce.**

This is the gap that commercial open source fills. The software is free, but peace of mind costs money. That's not evil - it's how infrastructure software has worked for decades (Red Hat, Elastic, MongoDB).

## The Pattern: Enterprise Expectations, Volunteer Wages

This isn't theoretical. It happens constantly:

**Log4j (2021-2022):** When the Log4Shell vulnerability was discovered, volunteer maintainers at the Apache Software Foundation were suddenly responsible for patching a critical flaw affecting billions of devices worldwide. Companies demanded immediate fixes. The maintainers worked unpaid nights and weekends while their code ran in production at every Fortune 500 company. The Apache Foundation estimated ~80% of Java applications used Log4j. The funding? Minimal.

**core-js (ongoing):** Denis Pushkarev maintains the most-downloaded JavaScript package in existence - over 3 billion downloads per month, used by 19+ million repositories. Companies making billions rely on his code. He works unpaid. In 2019 he wrote: "I could stop doing this and it would affect the vast majority of sites on the Internet." His funding requests went largely ignored until he became vocal about the absurdity of the situation.

**xz Utils backdoor attempt (2024):** A burned-out maintainer of compression software used throughout Linux was pressured by demanding "contributors" (likely state-sponsored actors) who exploited his exhaustion and guilt. The pressure tactics nearly succeeded in introducing a backdoor into infrastructure software that runs on millions of servers. The attack vector was maintainer burnout.

These aren't edge cases. This is the default outcome when critical infrastructure is built on unpaid labor and corporate goodwill.

## The Legal Structure: PropCo/OpCo Split

Sigilweaver is split into two legal entities:

| Entity                                | Role                         | What It Owns/Does                                                                                                      |
| ------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Sigilweaver Holdings LLC** (PropCo) | Intellectual Property Holder | Owns trademarks, copyrights, patents. Holds all contributor IP via CLA.                                                |
| **Sigilweaver LLC** (OpCo)            | Operating Company            | Runs operations, employs people, signs contracts, takes on liability. Licensed by PropCo to use and sublicense the IP. |

### Why Split Them?

**Liability Isolation.** If OpCo gets sued (customer contract dispute, employment issue), the IP in PropCo is protected. The code survives even if the operations don't.

**IP Protection.** Contributors assign copyright to PropCo via a [Contributor License Agreement (CLA)](https://github.com/sigilweaver/sigilweaver/blob/main/CLA.md). This lets PropCo dual-license the code (AGPL to the public, Commercial to enterprises). Without a CLA, you can't do dual licensing - every contributor would need to consent to every commercial deal.

**Future Flexibility.** If Sigilweaver ever generates enough revenue to justify it, PropCo can be rolled into a nonprofit foundation (think Linux Foundation, Apache Foundation). Nonprofits have high overhead and regulatory burden, so we are not doing that prematurely. But the structure makes it possible later.

**Exit Optionality.** If someone wants to acquire Sigilweaver, they buy OpCo (the business) but license the IP from PropCo. Or they buy PropCo (the IP) but leave OpCo to continue operating. This flexibility increases the project's value.

### Why Is The Footer Like That?

Look at the bottom of [sigilweaver.app](https://sigilweaver.app):

> © 2026 Sigilweaver Holdings LLC. Operated under license by Sigilweaver LLC.

- **Copyright holder** (PropCo) is displayed for IP protection.
- **Operator** (OpCo) is mentioned for legal transparency.
- **Terms and Privacy** link to OpCo's documents - they carry the operational liability.
- **Licensing** (AGPL, Commercial) originates from PropCo - it owns the IP.

This isn't random. It's deliberate separation of concerns at the legal level.

## The Licensing Model: Dual Licensing (AGPL + Commercial)

Sigilweaver is available under two licenses:

| License        | Cost | Usage                                     | Constraints                                                                                     |
| -------------- | ---- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **AGPLv3**     | Free | Open source, evaluation, personal use     | Viral copyleft. Modifications deployed as network services must be open-sourced. Zero warranty. |
| **Commercial** | Paid | Professional, enterprise, proprietary use | Proprietary license. No copyleft obligations. Legal indemnification available.                  |

### Why AGPL (Not MIT or Apache)?

**AGPL is defensible.** If you use MIT/Apache, companies can take your code, add value, never contribute back, and compete with you. They can build businesses on your work without any obligation to support the project.

AGPL says: "If you deploy this as a service (SaaS, internal tool, Hub for a team), you must open source your modifications." Most enterprises **will not** open source their internal tools. So they buy a commercial license instead.

This is how [Grafana](https://grafana.com/), [GitLab](https://about.gitlab.com/), and [Sentry](https://sentry.io/) fund themselves. It works.

### Why Not Just GPL?

GPL only triggers on distribution (shipping binaries). It doesn't cover SaaS/network usage. AGPL closes that loophole. If you're running Hub for your company, AGPL applies even if you don't distribute the code.

### The Commercial License

Enterprises that can't (or won't) comply with AGPL can buy a commercial license. This:
- Removes the copyleft requirement
- Provides warranty and support
- Offers indemnification (we take on legal risk for IP claims)

The pricing model: charge enough that it's cheaper than the legal risk of AGPL non-compliance, but less than hiring a developer to build it internally.

## Why Not a Nonprofit Now?

People ask: "Why not make this a 501(c)(3) from the start?"

Because **nonprofits are expensive to run correctly.**

- Annual filings (Form 990) require an accountant
- Board governance requirements
- Restrictions on commercial activity
- Regulatory scrutiny (IRS has audited nonprofits aggressively after past abuse)

If Sigilweaver generates $0 revenue, a nonprofit structure is pure overhead. But if it generates enough to support full-time maintainers, donating the IP to a foundation makes sense.

**The PropCo/OpCo split makes this transition possible.** PropCo (the IP holder) can become a nonprofit foundation. OpCo (the commercial operator) can continue selling licenses and services under the foundation's governance.

This is the model used by:
- **Linux Foundation** (IP holder) + **Red Hat** (commercial operator)
- **Apache Foundation** (IP holder) + **Databricks** (commercial operator)
- **Python Software Foundation** (IP holder) + **Anaconda** (commercial operator)

We are not there yet. But the structure doesn't prevent it.

## The Contributor License Agreement: The "Poison Pill" Defense

All contributors must sign the [CLA](https://github.com/sigilweaver/sigilweaver/blob/main/CLA.md) before their pull request is merged. This took **weeks** to get right, and to my knowledge, this structure is unique to Sigilweaver.

### The Two Failed Models

Historically, open source maintainers have had two options, and both have serious problems:

**Option 1: No CLA (Distributed Ownership)**

Hundreds of contributors each retain copyright to their patches. Sounds democratic, right?

The problems:
- **Can't change licenses.** GPL projects that need to become AGPL (to cover SaaS usage) are stuck - getting hundreds of people to agree is impossible.
- **The SaaS loophole.** GPL only triggers on distribution (shipping binaries). Companies can take your code, modify it, run it as a service, and never share their improvements. They're not distributing, so GPL doesn't apply. This is why AGPL exists - but you can't switch to it without unanimous contributor consent.
- **Can't fight infringers effectively.** Without one legal entity holding the copyright, enforcement is fractured. Good luck coordinating a lawsuit across 200 contributors.
- **Cloud companies pollute the commons.** AWS, GCP, and Azure can take your GPL code, run it as a service with proprietary modifications, never contribute back, and you have no leverage. They're not violating the license - they're just exploiting its limitations.

This is the "tragedy of the commons" applied to open source.

**Option 2: Standard CLA (Centralized Ownership, No Protections)**

Contributors assign copyright to a company. The company can dual-license, fight infringers, and adapt quickly.

The problem: **rugpull risk.** History is full of examples:

- **MySQL:** Acquired by Sun, then Oracle. Community forked to MariaDB.
- **OpenOffice:** Oracle acquisition led to the LibreOffice fork.
- **Hudson CI:** Became Jenkins after Oracle tried to control it.
- **CentOS:** Red Hat killed CentOS 8, forcing users to CentOS Stream or paid RHEL.
- **Terraform:** HashiCorp changed from MPL to BSL (Business Source License), no longer open source.
- **Elasticsearch/Kibana:** Changed to SSPL (not OSI-approved) to fight AWS.
- **Redis:** Changed licensing away from BSD to fight cloud providers.
- **Akka:** Lightbend changed to BSL, breaking the open source model.

The pattern is consistent: companies acquire or control projects with standard CLAs, then change course when it's profitable. Contributors are left with nothing - no leverage, no recourse, just a fork and broken trust.

### Sigilweaver's Model: Option 3

Sigilweaver's CLA tries to get the benefits of centralized ownership (can dual-license, can fight infringers, can adapt) without the rugpull risk.

Yes, you assign copyright to Sigilweaver Holdings LLC (PropCo) - dual licensing is impossible without unified copyright. But **PropCo makes binding legal covenants back to you**:

1. **Continued Open Source Availability**: The project must remain publicly available under an OSI-approved license (AGPL or similar copyleft).
2. **Restriction on Transfer**: The IP cannot be transferred to a for-profit entity. Only to a 501(c)(3) nonprofit or internationally recognized foundation (Apache, Eclipse, Linux Foundation).

### The "Reversion Clause"  -  The Teeth

Here's the critical part. If PropCo:
- Ceases to make the source code publicly available for 90+ days
- Transfers ownership to a for-profit entity
- Is subject to involuntary transfer (bankruptcy, foreclosure, hostile acquisition, court judgment)

Then **the copyright assignment automatically terminates.** Ownership of all contributions immediately reverts to the individual contributors.

This is the "poison pill." If someone tries to buy Sigilweaver to close-source it, the IP evaporates. If PropCo fails its mission, the code becomes community-owned by default.

### The "Safety Pin" Clause

The CLA also includes a severability provision with a twist. If Section 3 (the Covenants) or Section 4 (the Reversion Clause) is held invalid by a court, then **Section 2 (the Assignment) is also void**. You can't enforce the assignment without the protections.

This isn't a standard CLA clause. Most agreements have severability that lets companies keep the parts they want even if other parts fail. Sigilweaver's CLA is intentionally all-or-nothing: either the protections hold, or the assignment doesn't happen.

### Why This Matters

I spent weeks working through this structure because **trust shouldn't require faith.** The open source community has been burned too many times by projects that started with good intentions and ended with proprietary capture.

Sigilweaver's CLA makes the commitments legally enforceable. You're not trusting me to do the right thing - you're trusting contract law to bind PropCo to its promises.

### What If You Still Don't Want to Sign?

That's valid. IP assignment is a personal decision, regardless of the protections.

If you don't want to sign the CLA, you can still:
- **Use Sigilweaver** under AGPL for any purpose
- **Fork the project** and maintain your own version
- **Report bugs and suggest features** without signing anything
- **Help others** in discussions, write tutorials, create content

Contributing code is just one way to participate. The project doesn't have an inherent right to your labor or your IP.

## The Goal: $0 Burn Rate Sustainability

I'm building Sigilweaver to have **zero recurring costs** until it has revenue to support them.

- **No cloud hosting:** Self-hosted Studio and Server, no AWS bills
- **No SaaS subscriptions:** Open source tooling (GitHub, Docusaurus, VS Code)
- **No employees:** Solo maintainer until revenue justifies hiring
- **No investors:** No dilution, no pressure for premature monetization

This is only possible because of:
1. **Dual licensing:** Enterprises pay for legal peace of mind
2. **PropCo/OpCo:** Liability is isolated, IP is protected
3. **Partner ecosystem:** Consultants and resellers scale sales/support without headcount

## The Reality: Building in Private

Here's something I don't see discussed often enough: **at the time of writing this (January 2026), Sigilweaver is not public.** The GitHub repo is private. I have zero users to my knowledge. I don't plan to make it public until June 2026 at the earliest.

I understand the "build in public" philosophy - the feedback loops, the accountability, the community momentum. But there's also something to be said for **building in private if you know you can actually force yourself to launch when the time comes.**

Building in private gives me space to:
- Make architectural mistakes and fix them before anyone sees
- Change my mind on foundational decisions without breaking someone's workflow
- Ship when it's ready, not when Twitter demands a launch

But I'd be lying if I said there wasn't uncertainty.

At this point, I've pumped significant funds into the project - domain names, legal filings, infrastructure, tools. More significantly, I've invested **hundreds of hours** that I otherwise would have spent with friends, family, or just relaxing. This has been a second full-time job on top of my 45-hour-per-week day job.

I don't know if this will work. I don't know if anyone will use it. I don't know if enterprises will pay for commercial licenses, or if I'll just end up with an over-engineered portfolio project. **That's the risk I accepted when I started.**

What I do know: I've watched maintainers build genuinely valuable infrastructure - software that companies depend on - and still work nights and weekends for free while those companies generate revenue. That's a choice too. I'm making a different one.

So I'm building the structure first. Legal entities before launch. Licensing model before users. Business plan before traction.

If Sigilweaver fails, it won't be because I didn't think about sustainability. It'll be because the market didn't care, or I executed poorly, or a competitor moved faster. Those are risks I can accept.

What I can't accept is building something valuable and watching it collapse because I was afraid to charge for it.

## The Hidden Blocker: Code Signing

Here's something nobody tells you: **Windows code signing has real barriers to entry for open source maintainers.**

If you want to distribute desktop software on Windows without triggering SmartScreen warnings ("Windows protected your PC"), you need a code signing certificate. Traditionally, this meant Extended Validation (EV) certificates, which require:
- A registered business (LLC, Corp, etc.) that's at least 3 years old
- An EIN (tax ID) and DUNS number
- Verification of your business address and identity

**The landscape is changing:** Microsoft is pushing [Trusted Signing](https://learn.microsoft.com/en-us/azure/trusted-signing/), a cloud-based service that doesn't require EV certificates or 3-year-old businesses. But it's still in preview, requires Azure integration, and the ecosystem hasn't fully transitioned yet. EV certificates are going the way of the dodo, but we're in an awkward transition period.

**The pragmatic advice:** Set up an LLC now, even if you're not sure you'll need it. Benefits:
- The 3-year clock starts when you file (matters if you need traditional EV)
- You can sign contracts with enterprises
- Liability protection for you personally
- Professional appearance

LLC costs vary wildly by state - California charges $800/year just to exist, while Ohio is $100 one-time with no annual filings. You can also register in a business-friendly state and use a registered agent ($50-100/year) regardless of where you live.

Start the clock early. You might not need it now, but you will if your project takes off.

## For Other Maintainers: This is a Template (and a Petri Dish)

Call this a template if you want, but it's also an experiment. There are people far smarter and more experienced than me working on open source sustainability - lawyers who've spent decades on CLAs, founders who've built billion-dollar companies on dual licensing, academics studying commons governance. I'm synthesizing what I've learned from them and testing it on a project with zero users.

We'll see if any of this holds water in due time.

**When to use this model:** You're building infrastructure software (databases, dev tools, data platforms, developer tooling) that enterprises might deploy internally. You have commercial ambitions or want to keep that option open.

**When NOT to use this model:** This is a hobby project. It's a personal tool. You just want to share code and don't care about monetization. You're building a library that other projects will embed (permissive licenses like MIT/Apache are better for adoption). In those cases, this is massive overkill - just pick MIT or Apache and move on.

If you're in the first category, consider:

### 1. Start with strong copyleft (AGPL), relax later if needed

**With a CLA, you can relicense in any direction.** If you own all the copyright (via CLA), you can change AGPL → MIT or MIT → AGPL tomorrow. You have unified ownership.

**Without a CLA, you're locked into permissive licenses.** Here's the nuance:

- **MIT → AGPL is technically possible** for future versions, but all the old MIT code remains MIT forever. Anyone can fork the last MIT version and continue under that license (this is how Hudson became Jenkins after Oracle tried to close it). You're building on a permissive foundation that you can't revoke.
- **AGPL → MIT is straightforward** because you're giving up restrictions, not adding them. Everyone who could use the AGPL version can use the MIT version.

The asymmetry matters. **Start with strong copyleft (AGPL). You can always relax to MIT if adoption is slow. You cannot effectively strengthen from MIT to AGPL without a fork risk.**

This is why a CLA matters: it gives you the option to adapt your license to market conditions without losing control of your codebase.

### 2. Set up legal entities early

PropCo/OpCo is ideal, but even a single LLC is better than nothing. Benefits:
- Code signing certificates (3-year clock starts now)
- Ability to sign contracts with enterprises
- Liability protection for you personally
- Professional appearance for enterprise sales

LLC costs vary dramatically by state. California: $800/year. Ohio: $100 one-time, no annual filings. Delaware: $300/year. You can register in any state and use a registered agent.

### 3. Require a CLA from day one

It's awkward to add a CLA to an existing project. Contributors who already contributed under MIT don't have to sign. You end up with a fragmented copyright situation.

Start with a CLA. Make it part of the contribution process from the first PR. Consider using a CLA with contributor protections (like Sigilweaver's reversion clause) to build trust.

### 4. Plan for sustainability, not purity

"Free software" is a luxury funded by someone - and it's usually in the form of unpaid labor. Corporate sponsorships are unreliable. Donations don't scale. If you want to work on this full-time, you need a business model.

Dual licensing isn't betraying open source - it's how open source infrastructure has been funded for 30 years. The code is still free. The peace of mind costs money.

## Transparency as a Moat

I'm documenting this publicly because **transparency is a competitive advantage.** Enterprises trust vendors who are clear about their business model. Developers contribute to projects with a credible future.

Sigilweaver's legal structure isn't a secret weapon - it's a blueprint. If sharing this helps other maintainers build sustainable projects, the open source ecosystem gets stronger.

And a stronger ecosystem is good for everyone.

## The Real Win: Creative Fulfillment

Here's something I don't see discussed often enough in conversations about open source sustainability: **I've genuinely enjoyed building this.**

I'm a deeply creative and curious person. Architecting a data pipeline engine, designing a visual workflow system, wrestling with the nuances of dual licensing - this scratches an intellectual itch that my day job doesn't. The hundreds of hours I've spent on Sigilweaver weren't martyrdom. They were *play*.

Building in private gives me space to chase down architectural rabbit holes, refactor things twice because I didn't like the first solution, and solve problems that probably only exist in my head. That has intrinsic value, regardless of what happens next.

I hope this doesn't end up being just a portfolio project. I hope enterprises find it useful and commercial licenses pay the bills. I hope the open source community adopts it and builds extensions and integrations.

But if the world doesn't need this? Then the world doesn't need this. I can accept that.

What I couldn't accept is spending years building something valuable, watching it gain adoption, and then watching it collapse because I was afraid to build a business around it. Or worse - burning out because I treated it like a side project with enterprise expectations.

So I'm building the structure first. If Sigilweaver succeeds, it'll succeed sustainably. If it fails, it'll fail with clean IP ownership, clear licensing, and a legal structure that someone else could pick up and run with.

That's the bet. We'll see how it plays out.

---

*This post will be updated as I learn more. If you see mistakes, have questions, or want to share your own experience with open source sustainability, I'd genuinely like to hear from you.*

**Discuss on [GitHub](https://github.com/sigilweaver/sigilweaver/discussions)** · **Email [contact@sigilweaver.app](mailto:contact@sigilweaver.app?subject=RE:%20sustainable-open-source)** · **Visit [sigilweaver.app](https://sigilweaver.app)**

