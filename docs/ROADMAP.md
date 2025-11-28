# Sigilweaver Roadmap

High-level development phases. See [TODO.md](./TODO.md) for detailed tasks.

---

## Project Foundation

**Open Source:** AGPL-3.0 licensed - always free, always open  
**No SaaS:** Desktop-only, user controls their data and infrastructure  
**Business Model:** Training, consulting, migrations, certifications + donations

**Core Value Prop:** Visual layout for complex data flows. Even if you're writing Python/Polars code in the tools, seeing the pipeline structure makes complex joins/merges/splits comprehensible.

---

## Where We Are

**Currently:** Building foundation - modeling off Alteryx to understand what's actually needed  
**Next:** Get it stable enough to show people

---

## Pre-Share

**Philosophy:** Roughness is acceptable, but the bones must be solid.

Build out the core feature set, don't worry about polish. Focus on:
- Data integrity (correct results matter most)
- Core workflow execution works reliably
- Enough tools to do real work

Things that can wait:
- Beautiful UI (functional is fine)
- Perfect icons
- Marketing materials
- Documentation polish

**Done when:** I can demo a real workflow end-to-end without it crashing.

---

## Early Testers (Controlled Beta)

Bring in 2-3 trusted friends/colleagues who actually do data work.

**Approach:**
- Sign NDA + nominal payment (~$50-100)
- 4-6 weeks, weekly check-ins
- Watch them use it, see what breaks
- Find out what features actually matter

**Goal:** Validate this is solving real problems, not just feature-complete against a checklist.

**Done when:** They say they'd recommend it to a colleague.

---

## v1.0 Public Release

Ship something stable that works.

**Target Audience:** People already familiar with Python and/or Polars  
- Formulas/filters use transparent Python expressions
- Not dumbed down - assumes technical comfort
- Tool for people who write code but want visual pipeline clarity

**Must-haves before launch:**
- AGPL-3.0 license in place
- Cross-platform builds (Linux, Windows, Mac)
- Documentation (enough to get started)
- Code signing (so OS doesn't flag it as malware)
- GitHub Issues for bug reports and feature requests (engagement is good!)

**Scope:** Whatever emerged from beta testing as "core". Modeling off Alteryx, but actual feature set determined by real usage, not speculation.

**Success:** Python/Polars users adopt it as their visual pipeline tool.

---

## Post-v1.0

**Near-term (3-6 months):** 
- Fix bugs, add most-requested features from real users
- Bug reports = people using it (good thing!)
- Feature requests = understanding user needs (also good!)

**Medium-term (6-12 months):**
- Simplify UX for less technical users (post-Python crowd validation)
- Build training materials, certifications
- Establish consulting/migration services

**Long-term (12+ months):**
- Enterprise features (based on actual customer needs)
- Performance scaling
- Ecosystem growth

---

## Guiding Principles

- Build what users actually need, not what I think is cool
- Keep it simple - don't reinvent Git, databases, etc.
- Open source forever - AGPL-3.0, no SaaS temptation
- User engagement (bugs, requests, contributions) is success
- Every feature has a maintenance cost
- Shipping beats perfecting

---

*Last Updated: November 2025*