---
sidebar_position: 1
---

# Contributing Workflow

How to go from "I want to help" to "my code is merged."

## Before You Start

1. **Check existing issues.** Someone may already be working on it.
2. **Open an issue first** for anything non-trivial. Discuss before coding.
3. **Small PRs are better.** One feature or fix per PR.

## The Process

### 1. Fork and Clone

```bash
git clone https://github.com/YOUR_USERNAME/sigilweaver-app.git
cd sigilweaver-app
```

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

Branch naming convention:
- `feature/` for new functionality
- `fix/` for bug fixes
- `docs/` for documentation
- `refactor/` for code cleanup

### 3. Make Your Changes

- Follow the [code style guide](./code-style)
- Write tests for new functionality
- Update documentation if needed

### 4. Test Locally

```bash
# Run all tests
python ./scripts/test.py

# Or test individually
cd backend && pytest
cd frontend && npm test
```

Don't submit a PR with failing tests. If tests fail for unrelated reasons, note that in the PR.

### 5. Commit

Write meaningful commit messages:

```
# Good
Add Formula tool validation for invalid expressions

# Bad
fix stuff
```

For multi-commit PRs, each commit should be independently meaningful. Squash WIP commits before submitting.

### 6. Push and Open PR

```bash
git push origin feature/your-feature-name
```

Then open a PR on GitHub. Fill out the template:
- What does this change?
- Why is it needed?
- How was it tested?

### 7. Code Review

I'll review PRs as time allows. Expect:
- Questions about design choices
- Suggestions for improvement
- Requests for tests or documentation

Don't take feedback personally. The goal is a better codebase, not criticism of you.

### 8. Merge

Once approved, I'll merge. Typically squash-merge to keep history clean.

## What Makes a Good PR

**Good PRs**:
- Solve one problem
- Include tests
- Have clear commit messages
- Follow existing patterns
- Update docs if user-facing

**Problematic PRs**:
- Mix unrelated changes
- Lack tests
- Introduce new patterns without discussion
- Break existing tests

## Types of Contributions

### Bug Fixes

1. Open an issue describing the bug
2. Reference the issue in your PR
3. Include a test that would have caught the bug

### New Tools

Tools are the most common contribution. See [Adding Tools](./adding-tools) for the full guide.

### UI Improvements

Coordinate first—UI changes can conflict with ongoing work. Open an issue or discussion.

### Documentation

Always welcome. Fix typos, clarify confusing sections, add examples.

### Refactoring

Discuss first. Refactoring for its own sake can churn code without adding value. But targeted cleanup with clear benefits is welcome.

## What I Won't Accept

- Features that complicate the core without clear benefit
- Breaking changes to the workflow format without migration path
- Dependencies with problematic licenses
- Code without tests (for anything non-trivial)
- Stylistic changes that just move code around

## Questions?

Open an issue or discussion. I prefer public channels so others can benefit from the answers.

---

Next: [Adding Tools](./adding-tools) for the most common contribution path.
