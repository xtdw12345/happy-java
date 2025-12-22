# Implementation Plan: Lombok Annotation Support for Constructor Injection

**Branch**: `003-lombok-autowired-support` | **Date**: 2025-12-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-lombok-autowired-support/spec.md`

## Summary

Extend the existing Spring bean navigation plugin to support Lombok's constructor-based dependency injection patterns. When a class uses `@RequiredArgsConstructor(onConstructor=@__({@Autowired}))` or `@AllArgsConstructor(onConstructor=@__({@Autowired}))`, fields marked with `@NonNull` become implicit injection points. The plugin will detect these patterns and provide CodeLens navigation from Lombok-injected fields to their Spring bean definitions, maintaining feature parity with explicit `@Autowired` field injections.

**Technical Approach**: Enhance the existing `AnnotationScanner` to recognize Lombok constructor annotations and extract the `onConstructor` parameter. Extend the `BeanMetadataExtractor` to identify `@NonNull` fields as injection points when Lombok constructor injection is present. Leverage the existing `BeanResolver` and `BeanCodeLensProvider` infrastructure without modification, treating Lombok-injected fields as standard injection points.

## Technical Context

**Language/Version**: TypeScript 5.9+ with strict mode enabled
**Primary Dependencies**:
- VS Code Extension API ^1.107.0
- @vscode/test-electron (for E2E tests)
- java-parser (existing, for CST parsing)

**Storage**: VS Code workspace state (existing BeanIndex in-memory structure)
**Testing**: @vscode/test-cli, Mocha (unit, integration, E2E tests in src/test/suite/spring-bean-navigation/)
**Target Platform**: VS Code 1.107.0+ (cross-platform: Windows, macOS, Linux)
**Project Type**: VS Code Extension
**Performance Goals**:
- Activation remains <200ms (no change to activation)
- Lombok annotation detection adds <100ms per file during indexing
- CodeLens rendering maintains <500ms for files with Lombok annotations

**Constraints**:
- Bundle size <5MB (Lombok detection uses existing java-parser, no new dependencies)
- Memory usage <50MB (Lombok fields stored in existing BeanIndex structure)
- TypeScript strict mode maintained
- 80% test coverage for new Lombok detection logic

**Scale/Scope**:
- Single workspace and multi-root workspace support (inherited from existing architecture)
- Typical Spring Boot projects: 100-1000 Java files
- Expected Lombok usage: 10-30% of classes using constructor injection

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature MUST comply with all principles in `.specify/memory/constitution.md`:

- [x] **Code Quality**: TypeScript strict mode will be maintained. All Lombok detection logic will follow existing patterns (AnnotationScanner, BeanMetadataExtractor). ESLint rules respected. Public APIs will have JSDoc comments.
- [x] **Testing Standards**: TDD approach - tests written BEFORE implementation. 80% coverage achievable for Lombok annotation detection, field identification, and integration with existing CodeLens provider.
- [x] **UX Consistency**: No new commands required. Lombok-injected fields use existing `happy-java.navigateToBean` command. CodeLens appearance identical to existing `@Autowired` fields. Error messages actionable (e.g., "Lombok annotation detected but onConstructor missing @Autowired").
- [x] **Performance**: No impact on activation time (detection happens during existing indexing phase). Lombok annotation parsing adds minimal overhead (<100ms per file) using existing java-parser CST traversal. Operations remain <100ms or async with progress.

**No constitution violations** - feature integrates cleanly into existing architecture.

## Project Structure

### Documentation (this feature)

```text
specs/003-lombok-autowired-support/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output - Lombok annotation patterns research
├── data-model.md        # Phase 1 output - Extended models for Lombok support
├── quickstart.md        # Phase 1 output - Developer quickstart guide
└── contracts/           # Phase 1 output - Internal API contracts
    ├── lombok-annotation-detector.ts  # Lombok annotation detection API
    └── lombok-injection-extractor.ts  # Lombok injection point extraction API
```

### Source Code (repository root)

```text
# Existing structure (no changes to organization)
src/
├── spring-bean-navigation/
│   ├── models/
│   │   ├── BeanDefinition.ts           # Existing - no changes
│   │   ├── BeanInjectionPoint.ts       # MODIFY: Add injectionType enum (lombok-constructor)
│   │   ├── BeanIndex.ts                # Existing - no changes
│   │   ├── BeanLocation.ts             # Existing - no changes
│   │   ├── BeanCandidate.ts            # Existing - no changes
│   │   └── types.ts                    # MODIFY: Add Lombok-specific types
│   ├── indexer/
│   │   ├── annotationScanner.ts        # MODIFY: Add Lombok annotation detection
│   │   ├── beanMetadataExtractor.ts    # MODIFY: Extract Lombok injection points
│   │   ├── beanIndexer.ts              # Existing - no changes (reuses existing logic)
│   │   ├── javaParser.ts               # Existing - no changes
│   │   └── lombok/                     # NEW directory
│   │       ├── lombokAnnotationDetector.ts    # NEW: Detects Lombok constructor annotations
│   │       └── lombokInjectionExtractor.ts    # NEW: Extracts @NonNull fields as injection points
│   ├── providers/
│   │   ├── beanCodeLensProvider.ts     # Existing - no changes (handles lombok injections via existing logic)
│   │   └── definitionProvider.ts       # Existing - no changes
│   ├── resolver/
│   │   ├── beanResolver.ts             # Existing - no changes
│   │   └── qualifierMatcher.ts         # Existing - no changes
│   └── utils/
│       ├── projectDetector.ts          # Existing - no changes
│       └── pathResolver.ts             # Existing - no changes
└── test/
    └── suite/
        └── spring-bean-navigation/
            ├── lombok/                  # NEW test directory
            │   ├── lombokAnnotationDetector.test.ts
            │   ├── lombokInjectionExtractor.test.ts
            │   └── e2e/
            │       ├── lombokFieldNavigation.test.ts
            │       └── lombokQualifierNavigation.test.ts
            └── fixtures/
                └── lombok/              # NEW test fixtures
                    ├── RequiredArgsConstructorController.java
                    ├── AllArgsConstructorService.java
                    └── LombokWithQualifierRepository.java
```

**Structure Decision**:
Feature extends existing `src/spring-bean-navigation/` structure by:
1. Adding new `lombok/` subdirectory under `indexer/` for Lombok-specific detection logic
2. Modifying existing files (`annotationScanner.ts`, `beanMetadataExtractor.ts`, `BeanInjectionPoint.ts`, `types.ts`) to integrate Lombok support
3. Adding parallel test structure under `test/suite/spring-bean-navigation/lombok/`

This approach:
- Isolates Lombok-specific logic in dedicated modules for maintainability
- Leverages existing infrastructure (CodeLensProvider, BeanResolver, BeanIndex) without modification
- Maintains consistency with existing codebase organization
- Enables feature toggle (Lombok detection can be disabled independently if needed)

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No constitution violations - table not applicable.*

## Phase 0: Research & Decisions

See [research.md](./research.md) for detailed findings.

**Key Decisions**:
1. **Lombok Annotation Parsing**: Use existing java-parser CST traversal to extract Lombok annotations and their parameters
2. **OnConstructor Syntax Support**: Recognize all three variants (`@__`, `_=`, `__=`) using regex pattern matching
3. **Field Filtering**: For `@RequiredArgsConstructor`, include only `@NonNull` and `final` fields; for `@AllArgsConstructor`, include all fields
4. **Integration Point**: Extend `BeanMetadataExtractor.extractInjectionPoints()` to call Lombok-specific extraction after existing logic
5. **Data Model Extension**: Add `injectionType` enum to `BeanInjectionPoint` with value "lombok-constructor" to distinguish source

## Phase 1: Data Model & Contracts

See [data-model.md](./data-model.md) for detailed entity definitions.

**Core Entities Modified**:
- `BeanInjectionPoint`: Add `injectionType: 'explicit-field' | 'constructor-param' | 'lombok-constructor'`
- `types.ts`: Add `LombokConstructorAnnotation`, `LombokConstructorType`, `OnConstructorSyntax` types

**New Internal APIs**:
- `LombokAnnotationDetector.detectConstructorInjection()`: Detects Lombok constructor annotations with @Autowired
- `LombokInjectionExtractor.extractInjectionPoints()`: Extracts @NonNull fields as injection points

See [contracts/](./contracts/) for detailed API specifications.

## Phase 2: Implementation Tasks

**Note**: Detailed task breakdown will be generated by `/speckit.tasks` command.

**High-Level Task Grouping**:
1. **Lombok Annotation Detection** (Tests → Implementation)
   - Detect `@RequiredArgsConstructor` with onConstructor parameter
   - Detect `@AllArgsConstructor` with onConstructor parameter
   - Extract and validate onConstructor contains `@Autowired`
   - Support all three onConstructor syntax variants

2. **Field Injection Point Extraction** (Tests → Implementation)
   - Identify `@NonNull` fields in Lombok classes
   - Extract field type and location information
   - Support `@Qualifier` annotations on Lombok fields
   - Distinguish between RequiredArgs (selective) and AllArgs (all fields)

3. **Integration with Existing Architecture** (Tests → Implementation)
   - Integrate Lombok detector into `AnnotationScanner`
   - Integrate injection extractor into `BeanMetadataExtractor`
   - Verify CodeLens appears on Lombok fields (reusing existing provider)
   - Verify navigation works via existing `navigateToBean` command

4. **Edge Case Handling** (Tests → Implementation)
   - Mixed injection patterns (explicit + Lombok)
   - Invalid bean types (primitives, non-bean classes)
   - Malformed onConstructor syntax
   - Import variations (lombok.NonNull vs @NonNull)

5. **Performance Validation**
   - Benchmark Lombok detection overhead (<100ms per file)
   - Verify no regression in existing navigation performance
   - Test with large codebases (1000+ files)

## Phase 3: Testing Strategy

**Test-Driven Development Approach** (per Constitution Principle II):

### Unit Tests (TDD - Write First)
Location: `src/test/suite/spring-bean-navigation/lombok/`

1. **LombokAnnotationDetector Tests** (`lombokAnnotationDetector.test.ts`)
   - Test: Detect `@RequiredArgsConstructor(onConstructor=@__({@Autowired}))`
   - Test: Detect `@AllArgsConstructor(onConstructor_={@Autowired})`
   - Test: Detect alternative syntax `onConstructor__={@Autowired}`
   - Test: Return null when onConstructor missing @Autowired
   - Test: Extract constructor type (RequiredArgs vs AllArgs)

2. **LombokInjectionExtractor Tests** (`lombokInjectionExtractor.test.ts`)
   - Test: Extract @NonNull fields for RequiredArgsConstructor
   - Test: Extract all fields for AllArgsConstructor
   - Test: Extract @Qualifier from Lombok fields
   - Test: Extract field type and location correctly
   - Test: Skip fields without @NonNull when RequiredArgs
   - Test: Include final fields for RequiredArgsConstructor

3. **AnnotationScanner Integration Tests**
   - Test: Existing Spring annotation detection still works
   - Test: Lombok annotations detected alongside Spring annotations
   - Test: Performance: Lombok detection adds <100ms overhead

4. **BeanMetadataExtractor Integration Tests**
   - Test: Lombok injection points added to BeanIndex
   - Test: Lombok injections marked with correct injectionType
   - Test: Existing injection point extraction unaffected

### Integration Tests (TDD - Write First)
Location: `src/test/suite/spring-bean-navigation/lombok/`

1. **CodeLens Integration**
   - Test: CodeLens appears on @NonNull field lines
   - Test: CodeLens text matches existing format ("→ go to bean definition")
   - Test: Multiple candidates show count ("3 candidates")

2. **Navigation Integration**
   - Test: Clicking Lombok field CodeLens navigates to bean definition
   - Test: QuickPick appears for multiple candidates
   - Test: @Qualifier narrows to correct bean

### E2E Tests (TDD - Write First)
Location: `src/test/suite/spring-bean-navigation/lombok/e2e/`

1. **lombokFieldNavigation.test.ts**
   - Test: Open file with RequiredArgsConstructor → CodeLens appears → Click → Navigate to bean
   - Test: Open file with AllArgsConstructor → All fields have CodeLens → Navigation works
   - Test: Mixed Lombok + explicit @Autowired → Both work correctly

2. **lombokQualifierNavigation.test.ts**
   - Test: @NonNull field with @Qualifier → Navigate to qualified bean directly
   - Test: Multiple beans of same type → QuickPick shows all candidates
   - Test: @Primary bean prioritized in QuickPick

**Test Coverage Target**: 80% minimum for all new Lombok detection code

## Performance Benchmarks

**Acceptance Criteria** (from spec.md Success Criteria):

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Lombok annotation detection | <100ms per file | Benchmark in `lombokAnnotationDetector.test.ts` |
| CodeLens rendering | <500ms | E2E test timing in `lombokFieldNavigation.test.ts` |
| Navigation time | <2 seconds | E2E test timing (click to editor navigation) |
| Indexing overhead | <10% | Compare indexing time with/without Lombok detection |
| No activation impact | 0ms additional | Verify activation time remains <200ms |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Lombok annotation syntax changes | Low | Medium | Support multiple historical syntaxes; version detection if needed |
| Java-parser CST structure changes | Low | High | Isolate CST traversal in Lombok detector; extensive tests for CST navigation |
| Performance regression in large codebases | Medium | High | Benchmark with 1000+ file projects; optimize CST traversal if needed |
| Conflict with future Lombok features | Low | Medium | Design extensible Lombok detector interface for future annotations |
| Edge cases in mixed injection patterns | Medium | Low | Comprehensive edge case test coverage; document known limitations |

## Dependencies & Ordering

**Critical Path**:
1. Lombok annotation detection (foundational)
2. Field injection point extraction (depends on #1)
3. Integration with BeanMetadataExtractor (depends on #2)
4. CodeLens integration (depends on #3, but reuses existing infrastructure)
5. E2E testing (depends on all above)

**No external dependencies** - feature uses existing java-parser and VS Code APIs.

## Rollout Strategy

**Feature Flag**: Not required (feature is additive and safe to enable)

**Deployment Plan**:
1. Merge to feature branch `003-lombok-autowired-support`
2. Run full test suite (unit + integration + E2E)
3. Manual testing with real-world Spring Boot + Lombok projects
4. Merge to main branch
5. Release as minor version bump (e.g., 0.3.0)

**Documentation Updates**:
- Update README.md with Lombok support description
- Add Lombok usage examples to quickstart guide
- Update CHANGELOG.md with feature description

**User Communication**:
- Release notes highlighting Lombok constructor injection support
- Example screenshot showing CodeLens on @NonNull fields
- Migration guide: None needed (feature is transparent to existing users)

## Success Metrics

**Quantitative Metrics** (from spec.md):
- SC-002: CodeLens appears within 500ms ✓
- SC-004: Indexing overhead <10% ✓
- SC-005: All three onConstructor syntax variants recognized ✓

**Qualitative Metrics**:
- Users with Lombok projects report seamless navigation experience
- No reported bugs or edge cases in common Lombok usage patterns
- Positive feedback on GitHub issues/discussions

**Monitoring**:
- Track extension activation telemetry (if enabled) for performance regressions
- Monitor GitHub issues for Lombok-related bug reports
- Collect user feedback on feature completeness

---

**Next Steps**: Run `/speckit.tasks` to generate detailed implementation tasks from this plan.
