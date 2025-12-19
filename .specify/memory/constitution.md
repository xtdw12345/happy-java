<!--
SYNC IMPACT REPORT - Constitution v1.0.0
================================================================================
VERSION CHANGE: [TEMPLATE] → 1.0.0
RATIONALE: Initial constitution ratification with four core principles

MODIFIED PRINCIPLES:
- NEW: I. Code Quality & Maintainability
- NEW: II. Testing Standards (NON-NEGOTIABLE)
- NEW: III. User Experience Consistency
- NEW: IV. Performance Requirements

ADDED SECTIONS:
- Development Workflow
- Extension-Specific Constraints

REMOVED SECTIONS: None (initial version)

TEMPLATES REQUIRING UPDATES:
✅ plan-template.md - Constitution Check section references this file
✅ spec-template.md - Functional requirements align with UX principles
✅ tasks-template.md - Test tasks align with Testing Standards principle

FOLLOW-UP TODOS: None
================================================================================
-->

# Happy Java Constitution

## Core Principles

### I. Code Quality & Maintainability

**All code MUST adhere to the following quality standards:**

- TypeScript strict mode MUST be enabled with no `any` types except where explicitly justified
- ESLint rules MUST pass with zero warnings in CI/CD pipeline
- Code MUST follow Single Responsibility Principle - each module, class, and function has
  one clear purpose
- Magic numbers and strings MUST be replaced with named constants
- Complex logic MUST include inline comments explaining the "why", not the "what"
- Dependency injection MUST be used over hard-coded dependencies to enable testability
- All public APIs MUST include JSDoc comments with parameter types, return types, and
  usage examples

**Rationale**: VS Code extensions run in users' development environments. Poor code quality
leads to extension crashes, performance degradation, and difficult maintenance. Strict
quality standards ensure reliability and long-term maintainability.

### II. Testing Standards (NON-NEGOTIABLE)

**Test-Driven Development is mandatory for all features:**

- Tests MUST be written BEFORE implementation (Red-Green-Refactor cycle)
- All tests MUST fail initially, then pass after implementation
- Minimum coverage requirements:
  - Unit tests: 80% code coverage for all business logic
  - Integration tests: All VS Code API interactions MUST have integration tests
  - E2E tests: Critical user workflows MUST have end-to-end tests using @vscode/test-electron
- Tests MUST run in CI/CD and block merges if failing
- Tests MUST be deterministic (no flaky tests allowed in main branch)
- Test files MUST be colocated with source code or in parallel test/ directory structure

**Test Categories Required:**

- **Unit Tests**: Business logic, utilities, data transformations (src/test/suite/)
- **Integration Tests**: VS Code API calls, workspace interactions, file system operations
- **E2E Tests**: Complete user workflows from command palette to final result

**Rationale**: Extensions that break user workflows damage trust and productivity. TDD ensures
features work as intended before deployment and prevents regressions. VS Code extension bugs
are difficult to debug in production; comprehensive testing catches issues early.

### III. User Experience Consistency

**All user-facing features MUST provide a consistent, predictable experience:**

- Commands MUST be registered in package.json with clear, action-oriented names following
  VS Code conventions (e.g., "happy-java.createClass", not "happy-java.cc")
- All commands MUST appear in Command Palette with descriptive titles
- Error messages MUST be actionable - tell users what went wrong AND how to fix it
- Loading states MUST show progress notifications for operations exceeding 500ms
- Status bar items MUST use appropriate icons from VS Code icon library
- Configuration settings MUST include descriptions and default values in package.json
- Keyboard shortcuts MUST NOT conflict with core VS Code or popular extension shortcuts
- Extension activation MUST be lazy - only activate on relevant events to minimize startup time
- All user interactions MUST respect VS Code themes (dark/light mode compatibility)

**Rationale**: VS Code users expect extensions to behave like native features. Inconsistent UX
creates confusion, frustration, and support burden. Following VS Code conventions ensures
seamless integration into users' workflows.

### IV. Performance Requirements

**The extension MUST NOT degrade IDE performance:**

- Activation time MUST be under 200ms (measure with `--prof-startup` flag)
- Synchronous operations MUST complete within 100ms; longer operations MUST be async with
  progress indicators
- File parsing and analysis MUST use streams for files exceeding 1MB
- Workspace scanning MUST be incremental and respect `.vscodeignore` patterns
- Memory usage MUST NOT exceed 50MB for typical projects (1000 files)
- Extension host blocking MUST be avoided - use worker threads for CPU-intensive operations
- Language server protocol operations MUST respond within 200ms for autocomplete/hover
- File system watchers MUST be disposed properly to prevent memory leaks
- Heavy computations MUST be debounced with 300ms delay for text change events

**Performance Monitoring:**

- MUST profile extension during development using VS Code Performance tools
- MUST monitor telemetry for slow operations in production (if telemetry enabled)
- MUST run benchmark tests in CI comparing against baseline metrics

**Rationale**: Slow extensions are disabled by users. VS Code runs extensions in a shared host
process; one slow extension impacts the entire IDE. Performance discipline is essential for
user retention and positive reviews.

## Development Workflow

### Code Review Requirements

- All PRs MUST pass CI/CD checks (tests, linting, type checking)
- All PRs MUST include test coverage for new features and bug fixes
- Breaking changes MUST be documented in CHANGELOG.md with migration guide
- PRs MUST reference related GitHub issues using "Fixes #123" syntax
- Code reviews MUST verify compliance with all four core principles

### Quality Gates

1. **Pre-commit**: ESLint and TypeScript compilation MUST pass
2. **Pre-push**: All tests MUST pass locally
3. **CI/CD**: Full test suite, coverage threshold (80%), and build MUST succeed
4. **Pre-release**: Manual smoke testing of all commands in clean VS Code install

### Versioning Policy

Extension follows semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes to commands, configuration, or public API
- **MINOR**: New features, new commands, backward-compatible enhancements
- **PATCH**: Bug fixes, performance improvements, documentation updates

## Extension-Specific Constraints

### Activation Events

- MUST use specific activation events (not `*` wildcard) to minimize startup impact
- Common patterns: `onLanguage:java`, `onCommand:happy-java.*`, `workspaceContains:**/*.java`

### Dependencies

- MUST minimize npm dependencies to reduce bundle size
- MUST use VS Code built-in modules where possible (fs, path, vscode APIs)
- MUST NOT include dependencies with known security vulnerabilities (run `npm audit`)
- Bundle size MUST stay under 5MB for fast installation

### Security Requirements

- MUST sanitize all user input before executing shell commands or file operations
- MUST validate workspace paths to prevent directory traversal attacks
- MUST request minimal required permissions in package.json
- MUST NOT store sensitive data in workspace settings (use VS Code SecretStorage API)

## Governance

### Amendment Procedure

1. Propose amendment with rationale in GitHub issue
2. Discuss trade-offs and impact on existing code
3. Require approval from project maintainer(s)
4. Update constitution version according to semantic versioning
5. Update dependent templates and documentation
6. Create migration plan for existing code if needed

### Compliance Verification

- All PRs MUST include checklist verifying alignment with constitution principles
- Constitution violations MUST be explicitly justified in PR description
- Quarterly reviews MUST assess whether principles are being followed
- Principles found to be impractical MUST be amended rather than ignored

### Complexity Justification

Any violation of principles (e.g., skipping tests, exceeding performance budgets) MUST be
documented in plan.md Complexity Tracking section with:

- Which principle is violated
- Why the violation is necessary
- What simpler alternatives were rejected and why

**Version**: 1.0.0 | **Ratified**: 2025-12-19 | **Last Amended**: 2025-12-19
