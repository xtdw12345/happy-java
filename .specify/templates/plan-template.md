# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.9+ with strict mode enabled
**Primary Dependencies**: VS Code Extension API ^1.107.0, @vscode/test-electron (for E2E tests)
**Storage**: [e.g., VS Code workspace state, global state, SecretStorage, or file system]
**Testing**: @vscode/test-cli, Mocha (unit, integration, E2E tests in src/test/suite/)
**Target Platform**: VS Code 1.107.0+ (cross-platform: Windows, macOS, Linux)
**Project Type**: VS Code Extension
**Performance Goals**: Activation <200ms, operations <100ms (sync) or properly async with progress
**Constraints**: Bundle size <5MB, memory usage <50MB, TypeScript strict mode, 80% test coverage
**Scale/Scope**: [e.g., single workspace, multi-root workspace, number of files to process]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature MUST comply with all principles in `.specify/memory/constitution.md`:

- [ ] **Code Quality**: Will TypeScript strict mode be maintained? Are ESLint rules respected?
- [ ] **Testing Standards**: Will tests be written BEFORE implementation (TDD)? Is 80% coverage achievable?
- [ ] **UX Consistency**: Do commands follow VS Code naming conventions? Are error messages actionable?
- [ ] **Performance**: Will activation stay under 200ms? Are operations under 100ms or properly async?

Any violations MUST be justified in the Complexity Tracking section below.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# VS Code Extension (Happy Java project structure)
src/
├── commands/           # Command implementations
├── services/           # Business logic
├── models/            # Data structures
├── utils/             # Shared utilities
└── test/
    └── suite/         # Test files

# Alternative: If feature requires separate organization
src/
├── [feature-name]/
│   ├── commands/
│   ├── services/
│   └── models/
└── test/
    └── suite/
        └── [feature-name]/
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
