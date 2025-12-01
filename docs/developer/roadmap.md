---
sidebar_position: 1
---

# Roadmap

Where we're going and why.

## Current State

Sigilweaver is in **active development**, pre-v1.0. The core is functional but rough. The focus right now is building out the foundation—not polish.

### What Works

- Visual workflow canvas with drag-and-drop
- Core tools: Input, Output, Filter, Select, Sort, Formula, Union, Join, Summarize
- Real-time preview of tool outputs
- Export to Python code
- Multi-tab workflow editing
- Undo/redo history
- Auto-save and manual save
- Cross-platform builds (Linux, Windows, macOS)

### What's Rough

- UI could be prettier
- Some edge cases in tool configs
- Error messages could be clearer
- Documentation is sparse
- No code signing yet (OS warnings on install)

---

## Project Philosophy

**Open Source:** AGPL-3.0 licensed—always free, always open.

**Desktop-Only:** No SaaS. You control your data and your infrastructure. The app runs locally, processes locally, saves locally.

**Core Value:** Visual layout for complex data flows. Even if you're writing Polars expressions in the tools, *seeing* the pipeline structure makes complex joins/merges/splits comprehensible.

**Target Audience:** People who already know Python and/or Polars. This isn't dumbed down—it assumes technical comfort. It's a tool for people who write code but want visual pipeline clarity.

---

## Phases

### Phase 1: Pre-Share (Current)

Build out the core feature set. Don't worry about polish.

**Focus:**
- Data integrity (correct results matter most)
- Reliable workflow execution
- Enough tools to do real work

**Defer:**
- Beautiful UI (functional is fine)
- Perfect icons
- Marketing materials
- Documentation polish

**Done when:** Can demo a real workflow end-to-end without it crashing.

### Phase 2: Early Testers

Bring in 2-3 trusted people who actually do data work.

**Approach:**
- 4-6 weeks, weekly check-ins
- Watch them use it, see what breaks
- Find out what features actually matter

**Goal:** Validate this solves real problems, not just feature-complete against a checklist.

**Done when:** They'd recommend it to a colleague.

### Phase 3: v1.0 Public Release

Ship something stable that works.

**Must-haves:**
- AGPL-3.0 license in place ✓
- Cross-platform builds ✓
- Documentation (enough to get started)
- Code signing (so OS doesn't flag as malware)
- GitHub Issues enabled (engagement is good!)

**Success metric:** Python/Polars users adopt it as their visual pipeline tool.

### Phase 4: Post-v1.0

**Near-term (3-6 months):**
- Fix bugs from real usage
- Add most-requested features
- Bug reports = people using it (good thing!)

**Medium-term (6-12 months):**
- Simplify UX for less technical users
- Build training materials
- Establish consulting/migration services

**Long-term (12+ months):**
- Enterprise features (based on actual customer needs)
- Performance scaling
- Ecosystem growth

---

## Feature Priorities

### High Priority

These are blocking v1.0 or critical for real-world use:

1. **Reliable execution** - No crashes, correct results
2. **Error handling** - Clear messages when things fail
3. **Save/load** - Workflows persist correctly
4. **Core tools** - Cover the 80% use case

### Medium Priority

Nice to have, will add based on user feedback:

1. **More data sources** - Excel, Parquet, databases
2. **More tools** - Pivot, unpivot, sample, transpose
3. **Keyboard shortcuts** - Power user efficiency
4. **Workflow comments** - Annotate what things do

### Low Priority

Cool ideas that can wait:

1. **Theming** - Dark mode, custom colors
2. **Plugin system** - Third-party tools
3. **Cloud sync** - Workflow sharing (if ever)
4. **Collaboration** - Multi-user editing (probably never)

---

## Guiding Principles

1. **Build what users actually need** - Not what I think is cool
2. **Keep it simple** - Don't reinvent Git, databases, etc.
3. **Open source forever** - AGPL-3.0, no SaaS temptation
4. **User engagement is success** - Bugs, requests, contributions
5. **Every feature has a maintenance cost** - Say no by default
6. **Shipping beats perfecting** - Done is better than perfect

---

## How to Influence the Roadmap

- **GitHub Issues**: Bug reports and feature requests go here
- **Pull Requests**: If you want a feature, try building it
- **Discussions**: GitHub Discussions for open-ended ideas

The roadmap isn't fixed. It evolves based on what real users actually need.

---

## Non-Goals

Things Sigilweaver intentionally won't do:

- **SaaS offering** - Desktop only, forever
- **Become a database** - Use a real database
- **Replace Python or Polars** - It's complementary, not a substitute
- **Enterprise lock-in** - AGPL means anyone can fork/modify

---

Next: [Known Issues](./known-issues) for current limitations and workarounds.
