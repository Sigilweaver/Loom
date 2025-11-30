---
sidebar_position: 1
slug: /
---

# Welcome to Sigilweaver

**The visual data pipeline tool you always wished existed.**

Sigilweaver is a visual workflow designer for building and executing data processing pipelines through an intuitive drag-and-drop interface. Built as a cross-platform desktop application, it empowers you to create complex data transformations with minimal code.

## Why Sigilweaver?

As data professionals, we write transformation code all day—complex joins, filters, aggregations, multi-way merges. The code works, but it's hard to **see** what's happening. Debugging a 2000-line pipeline means mentally reconstructing the flow. Onboarding teammates means walking through nested function calls.

Sigilweaver gives you the best of both worlds:

- **Visual clarity**: See your entire pipeline at a glance—branches, joins, transformations laid out spatially
- **Full power**: Backed by [Polars](https://pola.rs)—lazy evaluation, blazing speed, production-ready performance  
- **Minimal code**: Write formulas when you need flexibility, drag-and-drop for structure
- **Instant debugging**: Inspect data at any stage, trace errors visually, understand transformations intuitively

## Core Features

### Visual Workflow Designer
Drag and drop tools onto an infinite canvas to build data pipelines. Connect tools to define data flow, and see your entire process at a glance.

### Smart Connection Validation
Real-time cycle detection prevents invalid workflow structures. The system guides you toward correct pipeline construction.

### Polars-Powered Execution
Lazy dataframe evaluation for speed and memory efficiency. Your workflows leverage the full power of the Polars engine.

### Workflow Persistence
Save and share workflows as portable `.swwf` JSON files. Version control your pipelines, share with teammates, or archive for later.

### Undo/Redo System
Full history tracking for confident workflow editing. Experiment freely knowing you can always step back.

### Organized Tool Library
Browse tools by category—In/Out, Preparation, Transform, Join, and more. Find what you need quickly.

## Quick Start

Ready to dive in? Head to the [Getting Started](/getting-started/installation) guide to download and install Sigilweaver.

Or jump straight to:

- [Your First Workflow](/getting-started/first-workflow) – Build a complete pipeline in 5 minutes
- [Tool Reference](/tools/overview) – Explore all available tools
- [Formula Guide](/concepts/formulas) – Write powerful expressions

## Open Source

Sigilweaver is **AGPL-3.0 licensed**—always free, always open. No SaaS, no cloud lock-in. You control your data and infrastructure.

- **GitHub**: [github.com/sigilweaver/sigilweaver-app](https://github.com/sigilweaver/sigilweaver-app)
- **Website**: [sigilweaver.app](https://sigilweaver.app)
- **Downloads**: [sigilweaver.app/downloads](https://sigilweaver.app/downloads)
