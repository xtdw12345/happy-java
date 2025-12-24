# Implementation Plan: Lombok Constructor Injection Support

**Branch**: `005-lombok-interface-injection` | **Date**: 2024-12-24 | **Spec**: [spec.md](./spec.md)

## Summary

**IMPORTANT DISCOVERY**: Lombok constructor injection support is **already fully implemented** in the codebase at `src/spring-bean-navigation/indexer/lombok/`. This plan focuses on validating the implementation, completing E2E tests, and documenting the feature rather than reimplementing from scratch.

**Existing Implementation**:
- `LombokAnnotationDetector`: Detects @RequiredArgsConstructor/@AllArgsConstructor with onConstructor parameter
- `LombokInjectionExtractor`: Extracts @NonNull and final fields as injection points
- Integration: BeanMetadataExtractor.extractInjectionPoints() (lines 134-141)
- Test Coverage: Unit tests passing (199 tests total)
- **Gap**: E2E test for Lombok + interface resolution is a placeholder (CodeLensIntegration.test.ts:208)

**Recommended Approach**: Validate existing implementation → Complete E2E tests → Document → Add fixtures if needed

## Technical Context

**Language/Version**: TypeScript 5.9+ with strict mode enabled (✓ Already compliant)
**Primary Dependencies**:
- VS Code Extension API ^1.107.0
- java-parser (for CST parsing) - Already in use for Lombok support
- @vscode/test-electron (for E2E tests)

**Storage**: In-memory BeanIndex (BeanIndexer) with FileWatcher for incremental updates
**Testing**: @vscode/test-cli, Mocha (src/test/suite/spring-bean-navigation/lombok/)
**Target Platform**: VS Code 1.107.0+ (cross-platform)
**Project Type**: VS Code Extension (Happy Java)

**Performance Goals**:
- Lombok field parsing: <100ms per file (requirement from FR-012 in spec)
- Activation: <200ms (already met by extension)
- CodeLens appearance: <200ms (requirement from SC-001 in spec)

**Constraints**:
- Bundle size <5MB (currently met)
- Memory usage <50MB (currently met)
- TypeScript strict mode (✓ enforced)
- 80% test coverage (validate for Lombok components)

**Scale/Scope**: Single workspace, multi-file Java projects with Spring + Lombok

**Existing Architecture**:
```
BeanMetadataExtractor
├─> AnnotationScanner (explicit @Autowired, @Resource, @Inject)
├─> LombokAnnotationDetector (detect @RequiredArgsConstructor with onConstructor)
└─> LombokInjectionExtractor (extract @NonNull/final fields)
     └─> Returns BeanInjectionPoint[] with InjectionType.LOMBOK_CONSTRUCTOR

BeanIndexer
├─> Calls BeanMetadataExtractor.extractFromFile()
└─> Stores injectionPoints in BeanIndex

CodeLensProvider
└─> Queries BeanIndex for injection points (should work with LOMBOK_CONSTRUCTOR type)
```

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature MUST comply with all principles in `.specify/memory/constitution.md`:

- [x] **Code Quality**: TypeScript strict mode is maintained in existing Lombok components. ESLint rules respected.
- [x] **Testing Standards**: Unit tests exist and pass. E2E test needs completion (TDD for gap filling).
- [x] **UX Consistency**: Commands use existing `happy-java.navigateToBean`. CodeLens uses consistent format.
- [x] **Performance**: Lombok detection is integrated into existing indexing flow. No additional activation time impact.

**Validation Result**: ✅ **PASS** - No constitution violations. Existing implementation follows all principles.

## Project Structure

### Documentation (this feature)

```text
specs/005-lombok-interface-injection/
├── plan.md              # This file
├── spec.md              # Feature specification (completed)
├── research.md          # Phase 0: Validation findings (to be created)
├── data-model.md        # Phase 1: Existing data models documentation (to be created)
├── quickstart.md        # Phase 1: User guide for Lombok support (to be created)
└── contracts/           # Phase 1: N/A for this feature (validation, not new API)
```

### Source Code (repository root)

**Existing Structure** (no changes needed):
```text
src/spring-bean-navigation/
├── indexer/
│   ├── beanMetadataExtractor.ts  # ✓ Integrates Lombok extraction (line 134-141)
│   └── lombok/
│       ├── lombokAnnotationDetector.ts  # ✓ Detects Lombok annotations
│       └── lombokInjectionExtractor.ts  # ✓ Extracts injection points
├── models/
│   ├── BeanInjectionPoint.ts     # ✓ Supports InjectionType.LOMBOK_CONSTRUCTOR
│   └── types.ts                  # ✓ Defines Lombok types
├── providers/
│   └── beanCodeLensProvider.ts   # ✓ Should handle LOMBOK_CONSTRUCTOR (validate)
└── test/
    └── suite/
        └── spring-bean-navigation/
            ├── lombok/
            │   ├── lombokAnnotationDetector.test.ts  # ✓ Passing
            │   └── lombokInjectionExtractor.test.ts  # ✓ Passing
            └── interface-resolution/
                └── CodeLensIntegration.test.ts  # ⚠️ Placeholder E2E test (line 208)
```

**Structure Decision**: **Validation Mode** - No new structure needed. All components exist. Focus on:
1. Completing E2E test implementation (CodeLensIntegration.test.ts:208-217)
2. Adding fixture files for E2E scenarios if missing
3. Documenting the existing architecture

## Complexity Tracking

**No Violations** - Existing implementation follows all constitution principles.

## Phase 0: Research & Validation

### Research Tasks

**R001: Validate Existing Lombok Implementation**
- **Objective**: Verify that LombokAnnotationDetector and LombokInjectionExtractor work correctly
- **Method**:
  1. Review unit test coverage for all spec requirements (FR-001 to FR-012)
  2. Run coverage report for lombok/ directory
  3. Identify any missing test scenarios from spec
- **Output**: Coverage report + gap analysis

**R002: Validate CodeLens Integration**
- **Objective**: Verify that CodeLensProvider correctly handles InjectionType.LOMBOK_CONSTRUCTOR
- **Method**:
  1. Trace code path from BeanIndexer → BeanIndex → CodeLensProvider
  2. Check if CodeLensProvider filters/handles LOMBOK_CONSTRUCTOR type
  3. Test manually with sample Lombok project
- **Output**: Integration flow diagram + validation result

**R003: Validate Interface Resolution Integration**
- **Objective**: Confirm that Lombok injection points work with InterfaceResolver (from 002-spring-bean-navigation)
- **Method**:
  1. Check if beanType from Lombok fields is passed to InterfaceResolver
  2. Verify DisambiguationContext is created correctly for Lombok injections
  3. Test with interface-typed Lombok fields
- **Output**: Integration validation + test scenarios

**R004: Identify E2E Test Gaps**
- **Objective**: Determine what E2E scenarios need implementation
- **Method**:
  1. Review placeholder test at CodeLensIntegration.test.ts:208
  2. Map spec user stories (P1, P2, P3) to existing tests
  3. Identify missing fixture files
- **Output**: E2E test implementation plan

**R005: Validate Qualifier Support**
- **Objective**: Verify @Qualifier extraction from Lombok fields works end-to-end
- **Method**:
  1. Check LombokInjectionExtractor.extractQualifier() implementation (line 310-334)
  2. Verify qualifier is passed through to BeanInjectionPoint
  3. Test with interface resolution + qualifier disambiguation
- **Output**: Qualifier flow validation

### Research Questions to Answer

1. **Does CodeLensProvider handle LOMBOK_CONSTRUCTOR injection type?**
   - Where: src/spring-bean-navigation/providers/beanCodeLensProvider.ts
   - What to check: Filter logic, type handling, message formatting

2. **Are there fixture files for Lombok scenarios?**
   - Where: src/test/suite/spring-bean-navigation/fixtures/
   - What to check: Lombok-annotated Java files for E2E tests

3. **What is test coverage percentage for lombok/ directory?**
   - How: Run `npm run test:coverage` and check lombok/ folder
   - Target: 80% per constitution

4. **Do all three user stories from spec have test coverage?**
   - P1: Basic Lombok field recognition
   - P2: Lombok with interface resolution
   - P3: Lombok with @Qualifier support

## Phase 1: Design & Contracts

### Data Model Documentation

**Existing Models** (already implemented, need documentation):

**LombokConstructorAnnotation** (from types.ts):
```typescript
interface LombokConstructorAnnotation {
  type: LombokConstructorType;          // REQUIRED_ARGS | ALL_ARGS
  hasAutowired: boolean;                 // True if onConstructor has @Autowired
  syntaxVariant: OnConstructorSyntax;   // JAVA7 | JAVA8_UNDERSCORE | JAVA8_DOUBLE_UNDERSCORE
  location: BeanLocation;
}
```

**LombokFieldInfo** (from types.ts):
```typescript
interface LombokFieldInfo {
  name: string;                // Field name
  type: string;                // Field type (class/interface FQN)
  location: BeanLocation;      // Source location
  hasNonNull: boolean;         // Has @NonNull annotation
  isFinal: boolean;            // Has final modifier
  qualifier?: string;          // @Qualifier value if present
  annotations: string[];       // All annotations on field
}
```

**BeanInjectionPoint Integration**:
- Lombok fields converted to BeanInjectionPoint with `injectionType: InjectionType.LOMBOK_CONSTRUCTOR`
- Field type → `beanType` (used for interface resolution)
- Field name → `fieldName`
- Qualifier → `qualifier` (used for disambiguation)

### API Contracts

**No new APIs required** - This is a validation/completion task.

Existing internal API:
```typescript
// BeanMetadataExtractor
extractInjectionPoints(annotations: Annotation[], uri: Uri, cst: any): BeanInjectionPoint[]
  ├─> Detects Lombok annotations via LombokAnnotationDetector
  └─> Extracts Lombok injections via LombokInjectionExtractor

// LombokAnnotationDetector
detectConstructorInjection(annotations: Annotation[]): LombokConstructorAnnotation | null

// LombokInjectionExtractor
extract(cst: any, uri: Uri, annotation: LombokConstructorAnnotation): BeanInjectionPoint[]
```

### E2E Test Plan

**Tests to Implement** (based on spec user stories):

**Test Suite: Lombok + Basic Navigation (P1)**
```typescript
test('should show CodeLens for @NonNull final field in @RequiredArgsConstructor', async () => {
  // Given: Class with @RequiredArgsConstructor + @NonNull private final UserService
  // When: Open file
  // Then: CodeLens appears → UserServiceImpl
});

test('should navigate to concrete bean when Lombok field CodeLens clicked', async () => {
  // Given: Lombok field with concrete class type
  // When: Click CodeLens
  // Then: Navigate to bean definition
});
```

**Test Suite: Lombok + Interface Resolution (P2)**
```typescript
test('should resolve interface-typed Lombok field to single implementation', async () => {
  // Given: @NonNull private final IExampleService with single implementation
  // When: CodeLens rendered
  // Then: Shows "→ ExampleServiceImpl"
});

test('should resolve interface-typed Lombok field to @Primary implementation', async () => {
  // Given: Interface with 2 implementations, one @Primary
  // When: CodeLens rendered
  // Then: Shows "→ PrimaryImpl (@Primary)"
});
```

**Test Suite: Lombok + Qualifier (P3)**
```typescript
test('should resolve @Qualifier on Lombok field to correct bean', async () => {
  // Given: @Qualifier("paypal") @NonNull private final PaymentService
  // When: CodeLens rendered
  // Then: Shows "→ paypalServiceImpl (@Qualifier)"
});
```

### Quickstart Guide Outline

**User Documentation** (to be created in quickstart.md):

1. **Feature Overview**: What Lombok injection support provides
2. **Prerequisites**: Lombok dependency in project
3. **Supported Annotations**: @RequiredArgsConstructor, @AllArgsConstructor with onConstructor
4. **Supported Syntax Variants**: Java 7, Java 8 underscore, Java 8 double underscore
5. **Field Eligibility**: @NonNull, final (for @RequiredArgsConstructor)
6. **Interface Resolution**: How it works with interface-typed fields
7. **Qualifier Support**: Using @Qualifier on Lombok fields
8. **Example Code**: Sample Java classes
9. **Troubleshooting**: Common issues

## Phase 2: Task Breakdown

**Not included in plan.md per workflow** - Use `/speckit.tasks` after plan approval.

Key task categories for tasks.md generation:
1. **Validation Tasks**: Run existing tests, verify integration, measure coverage
2. **E2E Test Implementation**: Complete CodeLensIntegration.test.ts placeholders
3. **Fixture Creation**: Add Lombok + interface Java files if missing
4. **Documentation**: Create quickstart.md and data-model.md
5. **Manual Testing**: Test with real Spring + Lombok project
6. **Bug Fixes**: Address any issues found during validation

## Success Criteria Validation

**From spec.md** - Validate these against existing implementation:

- **SC-001**: CodeLens appears on 100% of valid Lombok-injected fields within 200ms
  - **Validation**: Measure performance in E2E test, check BeanMetadataExtractor logs

- **SC-002**: Navigation from Lombok field CodeLens succeeds in 95%+ of cases
  - **Validation**: E2E test suite with various scenarios (concrete, interface, @Primary, @Qualifier)

- **SC-003**: Interface resolution for Lombok fields matches @Autowired accuracy
  - **Validation**: Compare integration test results between LOMBOK_CONSTRUCTOR and CONSTRUCTOR types

- **SC-004**: Extension works correctly in projects without Lombok (no false positives)
  - **Validation**: Test with non-Lombok project, verify no spurious injection points

- **SC-005**: All 3 user stories pass independent acceptance tests 100%
  - **Validation**: Implement E2E tests for P1, P2, P3 from spec

## Dependencies

**Existing Dependencies** (no new dependencies needed):
- ✅ InterfaceResolver (002-spring-bean-navigation) - Already integrated
- ✅ BeanIndexer - Already calls BeanMetadataExtractor
- ✅ CodeLens Provider - Should handle LOMBOK_CONSTRUCTOR (validate)
- ✅ java-parser - Already used by LombokInjectionExtractor

**External Libraries**:
- ✅ java-parser - Already supports Lombok annotation parsing
- ✅ No new dependencies required

**Technical Constraints**:
- ✅ Works without Lombok annotation processor (parses source, not bytecode)
- ✅ Supports all onConstructor syntax variants (already implemented in LombokAnnotationDetector)

## Open Questions & Risks

**Questions for Research Phase**:

1. **Q1**: Does CodeLensProvider explicitly filter by InjectionType, or does it handle all types generically?
   - **Impact**: If filtered, need to ensure LOMBOK_CONSTRUCTOR is included
   - **Resolution**: Code review of beanCodeLensProvider.ts

2. **Q2**: Are there fixture files for Lombok E2E tests, or do we need to create them?
   - **Impact**: E2E test implementation effort
   - **Resolution**: Check src/test/suite/spring-bean-navigation/fixtures/

3. **Q3**: What is current test coverage for lombok/ directory?
   - **Impact**: Compliance with 80% coverage requirement
   - **Resolution**: Run coverage tool

**Risks**:

- **Risk 1**: CodeLensProvider might not handle LOMBOK_CONSTRUCTOR type
  - **Mitigation**: Validate in R002, add handling if needed (minimal code change)
  - **Likelihood**: Low (architecture supports generic injection point handling)

- **Risk 2**: E2E tests might reveal integration issues not caught by unit tests
  - **Mitigation**: Validation-first approach catches issues before claiming completion
  - **Likelihood**: Medium (E2E test is placeholder for a reason)

- **Risk 3**: User might have specific scenario that doesn't work
  - **Mitigation**: Comprehensive E2E test coverage for all spec user stories
  - **Likelihood**: Medium (need to test all combinations: concrete, interface, @Primary, @Qualifier)

## Next Steps

1. ✅ **Plan Approval**: Review this plan with user
2. **Phase 0 Execution**: Run research tasks R001-R005, create research.md
3. **Phase 1 Execution**: Create data-model.md and quickstart.md
4. **Phase 2 Preparation**: Use `/speckit.tasks` to generate tasks.md

**Estimated Effort**: Low - Implementation exists, focus on validation and E2E tests (2-3 days)

---

**Plan Status**: Ready for Research Phase
**Next Command**: `/speckit.tasks` (after completing research and design phases)
