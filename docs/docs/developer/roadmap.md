---
sidebar_position: 1
---

# Roadmap

Where we're going and why.

## Development Timeline

Sigilweaver has been in active development since **August 1, 2025**, with 4-8 hours of daily work. This isn't a weekend project or an AI-generated app thrown together in an afternoon—it's a serious, sustained effort to build something genuinely useful.

**Target v1.0 release: June 1, 2026**

## Current State

Sigilweaver is in **active development**, pre-v1.0. The core is functional but has rough UI/UX. The focus right now is building out the foundation—not polish.

### What Works

- Visual workflow canvas with drag-and-drop
- Core tools: Input, Output, Filter, Select, Sort, Formula, Union, Join, Summarize
- Real-time preview of tool outputs
- Export to Python code
- Multi-tab workflow editing
- Undo/redo history
- Workflow persistence (save/load)
- Cross-platform builds (Linux, Windows, macOS)

### What's Rough

- UI could be prettier
- Some edge cases in tool configs
- No code signing yet (OS warnings on install)

---

## Project Philosophy

**Open Source:** AGPL-3.0 licensed—always free, always open. The AGPL was chosen specifically to prevent large companies from taking this work, wrapping it in proprietary code, and profiting without contributing back. If you use Sigilweaver, you share your improvements. That's the deal.

**Desktop-Only:** No SaaS. You control your data and your infrastructure. The app runs locally, processes locally, saves locally.

**Core Value:** Visual layout for complex data flows. Even if you're writing Polars expressions in the tools, *seeing* the pipeline structure makes complex joins/merges/splits comprehensible.

**Target Audience:** Anyone who is data-minded. You don't need prior Python or Polars experience—the expression engine is designed to be intuitive, and the documentation includes a crash course in Polars expressions. If you've used other visual data tools, you'll find Sigilweaver easier to pick up than you might expect.

---

## Phases

### Phase 1: Stealth Development (Current)

Build out the core feature set until the software is genuinely usable. Source code remains private during this phase.

**Focus:**
- All major data file sources that Polars supports
- Extensive testing with real-world data
- Easy-to-use, intuitive tools
- Data integrity (correct results matter most)

**Defer:**
- Beautiful UI (functional is fine)
- Perfect icons
- Marketing materials
- Documentation polish

**Done when:** The software reaches Minimum Competitive Product—can handle real workflows end-to-end without friction.

### Phase 2: Early Testers

Open to a small group of trusted testers: professional colleagues and data-literate friends. This mix ensures feedback from both advanced and basic users.

**Approach:**
- Weekly check-ins with testers
- Watch them use it, see what breaks
- Find out what features actually matter
- Testers stay engaged throughout the feedback incorporation period

**Goal:** Validate this solves real problems, not just feature-complete against a checklist.

**Done when:** Testers would recommend it to a colleague.

### Phase 3: Polish Sprint

After initial tester feedback, a focused month of intensive development.

**Focus:**
- Documentation quality
- Presentation and UI polish
- Functionality gaps identified by testers
- Feature completeness

**Testers remain engaged** during this phase to validate fixes and catch regressions.

### Phase 4: Code Signing & Platform Prep

2-4 weeks before v1.0 release.

**Tasks:**
- Obtain code signing certificates from Microsoft and Apple
- Test installation on Windows and macOS without OS warnings
- Prepare Linux distribution packages:
  - AppImage (direct download)
  - Flatpak (Flathub)
  - Snap Store
  - AUR (Arch User Repository)
- Verify successful install on all platforms

**Done when:** Can download and install successfully on Linux, Windows, and macOS without friction.

### Phase 5: v1.0 Public Release

Ship something stable that works.

**Must-haves:**
- Open source license (AGPL-3.0 or similar in spirit)
- Cross-platform builds
- Documentation (enough to get started)
- Code signing complete
- Contributor License Agreement (CLA) in place
- GitHub Issues enabled

**Release as v1.0.0** once installation works smoothly on all platforms.

### Phase 6: Announcement

Following v1.0 release, announce on:
- Reddit (relevant subreddits)
- Hacker News
- LinkedIn
- Other developer/data communities

**Timing:** Mid-week (Tuesday-Thursday), morning US time for best visibility.

**Messaging:** Transparent that this is "stable" but also early development software. Set appropriate expectations.

### Phase 7: Post-v1.0

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

## Contributor License Agreement (CLA)

Contributions to Sigilweaver require signing a Contributor License Agreement. This grants the project maintainer rights to your contributions while you retain ownership of your work.

**Why a CLA?** To preserve flexibility for the project's long-term sustainability. We may offer dual licensing in the future—AGPL for open source users, commercial licenses for enterprises who need different terms. A CLA makes this possible without needing to track down every contributor for permission.

**Transparency:** The project is and will remain AGPL-3.0 (or license in similar spirit). Any commercial licensing would be *in addition to*, not *instead of*, the open source version. The CLA exists to keep options open, not to take them away from the community.

---

## Non-Goals

Things Sigilweaver intentionally won't do:

- **SaaS offering** - Desktop only, forever
- **Become a database** - Use a real database
- **Replace Python or Polars** - It's complementary, not a substitute
- **Enterprise lock-in** - AGPL means anyone can fork/modify

---

## Stability Commitments

### Workflow JSON Format

The JSON workflow format is designed to be **verbose and explicit** for data operations. This verbosity is intentional—it makes the format resilient to change.

**Our commitment:**
- Workflows saved in v1.0 will remain loadable in future versions
- Most JSON handling happens server-side, allowing transparent migration
- If breaking changes ever become necessary, automatic handling of legacy structures will be provided

The workflow format is the primary stability contract. We take this seriously.

### Polars Dependency

Sigilweaver is deeply integrated with [Polars](https://pola.rs). Our roadmap is influenced by theirs:

- New Polars features may enable new Sigilweaver capabilities
- Polars breaking changes may require Sigilweaver updates
- We track Polars releases and test compatibility

This dependency is a feature, not a bug—Polars is excellent, and tight integration means you get its full power.

---

Next: [Known Issues](./known-issues) for current limitations and workarounds.
