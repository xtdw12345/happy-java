# Implementation Plan: Interface-Based Bean Resolution

**Branch**: `004-interface-bean-support` | **Date**: 2025-12-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-interface-bean-support/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable navigation from interface-typed injection points to their Spring bean implementations. The extension will:

1. Index Java interfaces and abstract classes in the workspace
2. Track implementation relationships (classes implementing interfaces, @Bean methods returning interfaces)
3. Enhance bean resolution to match interface types to their implementations
4. Provide CodeLens navigation with @Primary and @Qualifier disambiguation support
5. Support both explicit (@Autowired) and Lombok-generated constructor injections

**Technical Approach**: Extend the existing bean indexer to maintain an interface registry and implementation map. Enhance the bean resolver to perform type-based lookups using the interface registry. Leverage existing @Primary and @Qualifier support for disambiguation.

## Technical Context

**Language/Version**: TypeScript 5.9+ with strict mode enabled
**Primary Dependencies**:
- VS Code Extension API ^1.107.0
- java-parser ^3.0.1 (for CST parsing)
- @vscode/test-electron ^2.5.2 (for E2E tests)

**Storage**: In-memory bean index with interface→implementation mappings (BeanIndexer workspace state)
**Testing**: @vscode/test-cli with Mocha (unit, integration, E2E tests in src/test/suite/)
**Target Platform**: VS Code 1.107.0+ (cross-platform: Windows, macOS, Linux)
**Project Type**: VS Code Extension
**Performance Goals**:
- Activation <200ms (maintained, no change to activation events)
- Interface indexing <5s for 500 Java files
- Interface resolution <50ms for CodeLens provider requests
- Memory overhead <10MB for interface registry (within 50MB total budget)

**Constraints**:
- Bundle size <5MB (no new external dependencies)
- Memory usage <50MB total (interface registry must fit within budget)
- TypeScript strict mode
- 80% test coverage minimum
- Must not break existing bean resolution for concrete classes

**Scale/Scope**:
- Single workspace indexing (multi-root workspace out of scope)
- Workspace-only implementation discovery (external JARs not indexed)
- Supports projects with up to 500 Java files / 50 interfaces / 200 beans
- Raw type matching only (generic type parameters ignored)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature MUST comply with all principles in `.specify/memory/constitution.md`:

- [x] **Code Quality**: TypeScript strict mode maintained, ESLint rules respected, JSDoc comments for all new public APIs, dependency injection via existing BeanIndexer and BeanResolver services
- [x] **Testing Standards**: TDD approach with tests written BEFORE implementation, targeting 80%+ coverage for new interface resolution logic, integration tests for CodeLens with interface types
- [x] **UX Consistency**: No new commands required (extends existing CodeLens), error messages actionable ("No implementations found for interface X. Ensure implementation classes are annotated..."), respects VS Code themes
- [x] **Performance**: No activation time impact (reuses existing activation events), interface indexing async with progress notifications >500ms, CodeLens resolution <50ms (within 100ms sync budget)

**Constitution Compliance**: ✅ All principles satisfied. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/004-interface-bean-support/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── interface-resolution-api.md
├── checklists/
│   └── requirements.md  # Already created
└── spec.md              # Already created
```

### Source Code (repository root)

```text
src/spring-bean-navigation/
├── indexer/
│   ├── beanIndexer.ts               # MODIFY: Add interface indexing
│   ├── beanMetadataExtractor.ts     # MODIFY: Extract interface types
│   ├── annotationScanner.ts         # NO CHANGE (already handles all annotations)
│   └── interfaceRegistry.ts         # NEW: Interface→implementation registry
├── models/
│   ├── types.ts                     # MODIFY: Add InterfaceDefinition, ImplementationRelationship
│   ├── BeanDefinition.ts            # MODIFY: Add implementedInterfaces field
│   └── BeanInjectionPoint.ts        # NO CHANGE
├── resolver/
│   ├── beanResolver.ts              # MODIFY: Add resolveByInterfaceType()
│   └── interfaceResolver.ts         # NEW: Interface-specific resolution logic
├── providers/
│   └── codeLensProvider.ts          # MODIFY: Handle interface-typed injection points
└── utils/
    └── typeUtils.ts                 # NEW: Type matching utilities (raw type extraction)

src/test/suite/spring-bean-navigation/
├── interface-resolution/            # NEW: Test directory for this feature
│   ├── interfaceRegistry.test.ts
│   ├── interfaceResolver.test.ts
│   └── codeLens-interface.test.ts
└── fixtures/
    └── interfaces/                  # NEW: Test fixtures
        ├── UserRepository.java
        ├── UserRepositoryImpl.java
        ├── PaymentService.java
        ├── StripePaymentService.java
        └── PayPalPaymentService.java
```

**Structure Decision**: Extends existing `src/spring-bean-navigation/` feature directory. New components:
- `interfaceRegistry.ts`: Maintains bidirectional mapping (interface ↔ implementations)
- `interfaceResolver.ts`: Handles disambiguation logic (@Primary, @Qualifier, multi-selection)
- `typeUtils.ts`: Extracts raw types, normalizes FQNs, handles generic type erasure
- Modifies existing indexer, resolver, and provider to integrate interface resolution

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. This section intentionally left empty.

---

## Phase 0: Research

See [research.md](./research.md) for detailed findings on:

- Interface detection strategies in java-parser CST
- Implementation relationship tracking patterns
- Type matching algorithms for interface resolution
- Disambiguation strategies (@Primary, @Qualifier, user selection)
- Performance optimization for large interface hierarchies

## Phase 1: Design

### Data Model

See [data-model.md](./data-model.md) for detailed entity definitions, including:

- InterfaceDefinition: Represents indexed interfaces
- ImplementationRelationship: Links interfaces to implementing beans
- Enhanced BeanDefinition: Tracks which interfaces each bean implements

### API Contracts

See [contracts/interface-resolution-api.md](./contracts/interface-resolution-api.md) for:

- `InterfaceRegistry` API: registerInterface(), getImplementations(), getAllInterfaces()
- `InterfaceResolver` API: resolveInterface(), disambiguate(), selectImplementation()
- `TypeUtils` API: extractRawType(), normalizeFQN(), matchesInterface()

### Quickstart Guide

See [quickstart.md](./quickstart.md) for developer onboarding with:

- Architecture overview (how interface resolution integrates with existing bean resolution)
- Key extension points for adding new disambiguation strategies
- Example: Adding support for custom qualifier annotations
