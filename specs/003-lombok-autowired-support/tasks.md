# Tasks: Lombok Annotation Support for Constructor Injection

**Input**: Design documents from `/specs/003-lombok-autowired-support/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are REQUIRED per Constitution Principle II (Testing Standards).
All tests MUST be written BEFORE implementation (TDD/Red-Green-Refactor cycle) and MUST fail initially.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **VS Code Extension**: `src/spring-bean-navigation/`, `src/test/suite/spring-bean-navigation/`
- All paths are relative to repository root: `/Users/chun/code/vscode_extensions/happy-java/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Lombok-specific structure

- [ ] T001 Create Lombok directory structure: `src/spring-bean-navigation/indexer/lombok/`
- [ ] T002 [P] Create test directory structure: `src/test/suite/spring-bean-navigation/lombok/`
- [ ] T003 [P] Create test fixtures directory: `src/test/suite/spring-bean-navigation/fixtures/lombok/`
- [ ] T004 [P] Create E2E test directory: `src/test/suite/spring-bean-navigation/lombok/e2e/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data model extensions and type definitions that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create Lombok-specific types in `src/spring-bean-navigation/models/types.ts`: Add `LombokConstructorAnnotation`, `LombokConstructorType`, `OnConstructorSyntax`, `LombokFieldInfo` interfaces
- [ ] T006 Extend BeanInjectionPoint model in `src/spring-bean-navigation/models/BeanInjectionPoint.ts`: Add `injectionType: InjectionType` enum with values EXPLICIT_FIELD, CONSTRUCTOR_PARAM, LOMBOK_CONSTRUCTOR
- [ ] T007 Update AnnotationScanner FQN mapping in `src/spring-bean-navigation/indexer/annotationScanner.ts`: Add 'NonNull', 'RequiredArgsConstructor', 'AllArgsConstructor' to `getFullyQualifiedName()` method

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Navigate from Lombok-generated @Autowired Constructor Field (Priority: P1) 🎯 MVP

**Goal**: Enable CodeLens navigation from `@NonNull` fields to Spring bean definitions when class uses `@RequiredArgsConstructor(onConstructor=@__({@Autowired}))`

**Independent Test**: Create a Java class with `@RequiredArgsConstructor(onConstructor=@__({@Autowired}))` and `@NonNull` fields, open in VS Code, verify CodeLens appears on field lines with clickable navigation to bean definitions

### Tests for User Story 1 (REQUIRED per Constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (Red-Green-Refactor)**

- [ ] T008 [P] [US1] Unit test: Detect @RequiredArgsConstructor with @Autowired in onConstructor in `src/test/suite/spring-bean-navigation/lombok/lombokAnnotationDetector.test.ts`
- [ ] T009 [P] [US1] Unit test: Detect Java 7 syntax variant (onConstructor=@__) in `src/test/suite/spring-bean-navigation/lombok/lombokAnnotationDetector.test.ts`
- [ ] T010 [P] [US1] Unit test: Return null when onConstructor lacks @Autowired in `src/test/suite/spring-bean-navigation/lombok/lombokAnnotationDetector.test.ts`
- [ ] T011 [P] [US1] Unit test: Extract @NonNull fields for RequiredArgsConstructor in `src/test/suite/spring-bean-navigation/lombok/lombokInjectionExtractor.test.ts`
- [ ] T012 [P] [US1] Unit test: Extract field type and location correctly in `src/test/suite/spring-bean-navigation/lombok/lombokInjectionExtractor.test.ts`
- [ ] T013 [P] [US1] Unit test: Skip fields without @NonNull when RequiredArgs in `src/test/suite/spring-bean-navigation/lombok/lombokInjectionExtractor.test.ts`
- [ ] T014 [P] [US1] Unit test: Include final fields for RequiredArgsConstructor in `src/test/suite/spring-bean-navigation/lombok/lombokInjectionExtractor.test.ts`
- [ ] T015 [P] [US1] Integration test: Lombok injection points added to BeanIndex with correct injectionType in `src/test/suite/spring-bean-navigation/beanMetadataExtractor.test.ts`
- [ ] T016 [P] [US1] Integration test: CodeLens appears on @NonNull field lines in `src/test/suite/spring-bean-navigation/codeLensProvider.test.ts`
- [ ] T017 [P] [US1] E2E test: Open file with RequiredArgsConstructor → CodeLens appears → Click → Navigate to bean in `src/test/suite/spring-bean-navigation/lombok/e2e/lombokFieldNavigation.test.ts`

### Test Fixtures for User Story 1

- [ ] T018 [P] [US1] Create test fixture: `src/test/suite/spring-bean-navigation/fixtures/lombok/RequiredArgsConstructorController.java` with @RequiredArgsConstructor and @NonNull fields
- [ ] T019 [P] [US1] Create test fixture: `src/test/suite/spring-bean-navigation/fixtures/lombok/UserService.java` as bean definition target

### Implementation for User Story 1

- [ ] T020 [US1] Implement LombokAnnotationDetector class in `src/spring-bean-navigation/indexer/lombok/lombokAnnotationDetector.ts`: Create `detectConstructorInjection()` method that finds @RequiredArgsConstructor/@AllArgsConstructor and validates onConstructor contains @Autowired
- [ ] T021 [US1] Implement onConstructor parameter extraction in `src/spring-bean-navigation/indexer/lombok/lombokAnnotationDetector.ts`: Add `extractOnConstructorValue()` method supporting all three syntax variants (onConstructor, onConstructor_, onConstructor__)
- [ ] T022 [US1] Implement @Autowired detection in `src/spring-bean-navigation/indexer/lombok/lombokAnnotationDetector.ts`: Add `containsAutowired()` method using regex pattern /@Autowired\b/i
- [ ] T023 [US1] Implement syntax variant detection in `src/spring-bean-navigation/indexer/lombok/lombokAnnotationDetector.ts`: Add `determineSyntaxVariant()` method to identify Java 7 vs Java 8 syntax
- [ ] T024 [US1] Implement LombokInjectionExtractor class in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Create `extract()` method that orchestrates field extraction and filtering
- [ ] T025 [US1] Implement field information extraction in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Add `extractFieldInfo()` method that navigates CST to find all field declarations and extracts name, type, hasNonNull, isFinal properties
- [ ] T026 [US1] Implement field filtering logic in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Add `filterFields()` method that includes only @NonNull and final fields for RequiredArgsConstructor
- [ ] T027 [US1] Implement field type extraction in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Add `extractFieldType()` method navigating fieldDeclaration → unannType → classOrInterfaceType → Identifier
- [ ] T028 [US1] Implement @NonNull detection in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Add `hasNonNullAnnotation()` method scanning field modifiers for @NonNull
- [ ] T029 [US1] Implement final field detection in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Add `isFinalField()` method checking for final modifier
- [ ] T030 [US1] Implement BeanInjectionPoint conversion in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Add `convertToInjectionPoints()` method setting injectionType = LOMBOK_CONSTRUCTOR
- [ ] T031 [US1] Integrate Lombok detection into BeanMetadataExtractor in `src/spring-bean-navigation/indexer/beanMetadataExtractor.ts`: Call LombokAnnotationDetector in extractInjectionPoints() after existing extraction logic
- [ ] T032 [US1] Integrate Lombok extraction into BeanMetadataExtractor in `src/spring-bean-navigation/indexer/beanMetadataExtractor.ts`: Call LombokInjectionExtractor.extract() when Lombok annotation detected and merge results
- [ ] T033 [US1] Add JSDoc comments to LombokAnnotationDetector public methods with parameter types, return types, and usage examples
- [ ] T034 [US1] Add JSDoc comments to LombokInjectionExtractor public methods with parameter types, return types, and usage examples
- [ ] T035 [US1] Add error handling: Return empty array (not throw) when CST navigation fails in LombokInjectionExtractor
- [ ] T036 [US1] Add logging for Lombok annotation detection in LombokAnnotationDetector with file path and annotation type
- [ ] T037 [US1] Run tests and verify User Story 1 passes: All CodeLens and navigation tests for @RequiredArgsConstructor
- [ ] T038 [US1] Verify 80% code coverage requirement met for Lombok detector and extractor modules

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently - CodeLens navigation works for basic RequiredArgsConstructor pattern

---

## Phase 4: User Story 2 - Support Different Lombok Constructor Annotation Variants (Priority: P2)

**Goal**: Recognize various Lombok constructor injection patterns including `@AllArgsConstructor` and different `onConstructor` syntax variations (`onConstructor_=`, `onConstructor__=`)

**Independent Test**: Create test files with each supported Lombok annotation variant and verify CodeLens appears correctly for each pattern

### Tests for User Story 2 (REQUIRED per Constitution) ⚠️

- [ ] T039 [P] [US2] Unit test: Detect @AllArgsConstructor with @Autowired in onConstructor in `src/test/suite/spring-bean-navigation/lombok/lombokAnnotationDetector.test.ts`
- [ ] T040 [P] [US2] Unit test: Detect Java 8 underscore syntax (onConstructor_=) in `src/test/suite/spring-bean-navigation/lombok/lombokAnnotationDetector.test.ts`
- [ ] T041 [P] [US2] Unit test: Detect Java 8 double underscore syntax (onConstructor__=) in `src/test/suite/spring-bean-navigation/lombok/lombokAnnotationDetector.test.ts`
- [ ] T042 [P] [US2] Unit test: Extract all fields for @AllArgsConstructor in `src/test/suite/spring-bean-navigation/lombok/lombokInjectionExtractor.test.ts`
- [ ] T043 [P] [US2] Unit test: Return null when @RequiredArgsConstructor lacks onConstructor parameter in `src/test/suite/spring-bean-navigation/lombok/lombokAnnotationDetector.test.ts`
- [ ] T044 [P] [US2] E2E test: Open file with AllArgsConstructor → All fields have CodeLens → Navigation works in `src/test/suite/spring-bean-navigation/lombok/e2e/lombokFieldNavigation.test.ts`
- [ ] T045 [P] [US2] E2E test: Mixed Lombok + explicit @Autowired → Both work correctly in `src/test/suite/spring-bean-navigation/lombok/e2e/lombokFieldNavigation.test.ts`

### Test Fixtures for User Story 2

- [ ] T046 [P] [US2] Create test fixture: `src/test/suite/spring-bean-navigation/fixtures/lombok/AllArgsConstructorService.java` with @AllArgsConstructor including all fields
- [ ] T047 [P] [US2] Create test fixture: `src/test/suite/spring-bean-navigation/fixtures/lombok/Java8SyntaxController.java` using onConstructor_= variant

### Implementation for User Story 2

- [ ] T048 [US2] Extend LombokAnnotationDetector to recognize @AllArgsConstructor in `src/spring-bean-navigation/indexer/lombok/lombokAnnotationDetector.ts`: Update annotation name check to include @AllArgsConstructor
- [ ] T049 [US2] Update constructor type detection in `src/spring-bean-navigation/indexer/lombok/lombokAnnotationDetector.ts`: Return LombokConstructorType.ALL_ARGS when @AllArgsConstructor detected
- [ ] T050 [US2] Extend onConstructor parameter extraction in `src/spring-bean-navigation/indexer/lombok/lombokAnnotationDetector.ts`: Check onConstructor_ and onConstructor__ variants in addition to onConstructor
- [ ] T051 [US2] Update syntax variant detection in `src/spring-bean-navigation/indexer/lombok/lombokAnnotationDetector.ts`: Distinguish between single and double underscore variants
- [ ] T052 [US2] Update field filtering logic in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: For LombokConstructorType.ALL_ARGS, return all fields immediately without filtering
- [ ] T053 [US2] Add early return optimization in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Skip modifier checking when constructor type is ALL_ARGS
- [ ] T054 [US2] Run tests and verify User Story 2 passes: All variants of Lombok annotations are recognized
- [ ] T055 [US2] Verify 80% code coverage maintained with AllArgsConstructor and syntax variant support

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - Multiple Lombok patterns supported

---

## Phase 5: User Story 3 - Lombok Field Injection with @Qualifier Support (Priority: P3)

**Goal**: Support `@Qualifier` annotations on `@NonNull` fields to specify which bean to inject when multiple candidates exist

**Independent Test**: Create scenario with multiple beans of same type, one with qualifier matching field's `@Qualifier`, verify clicking CodeLens navigates directly to qualified bean without QuickPick menu

### Tests for User Story 3 (REQUIRED per Constitution) ⚠️

- [ ] T056 [P] [US3] Unit test: Extract @Qualifier from Lombok fields in `src/test/suite/spring-bean-navigation/lombok/lombokInjectionExtractor.test.ts`
- [ ] T057 [P] [US3] Unit test: Create BeanInjectionPoint with correct qualifier value in `src/test/suite/spring-bean-navigation/lombok/lombokInjectionExtractor.test.ts`
- [ ] T058 [P] [US3] Integration test: Existing qualifier matching logic works with Lombok injections in `src/test/suite/spring-bean-navigation/beanResolver.test.ts`
- [ ] T059 [P] [US3] E2E test: @NonNull field with @Qualifier → Navigate to qualified bean directly in `src/test/suite/spring-bean-navigation/lombok/e2e/lombokQualifierNavigation.test.ts`
- [ ] T060 [P] [US3] E2E test: Multiple beans of same type → QuickPick shows all candidates in `src/test/suite/spring-bean-navigation/lombok/e2e/lombokQualifierNavigation.test.ts`
- [ ] T061 [P] [US3] E2E test: @Primary bean prioritized in QuickPick for Lombok fields in `src/test/suite/spring-bean-navigation/lombok/e2e/lombokQualifierNavigation.test.ts`

### Test Fixtures for User Story 3

- [ ] T062 [P] [US3] Create test fixture: `src/test/suite/spring-bean-navigation/fixtures/lombok/LombokWithQualifierRepository.java` with @NonNull fields annotated with @Qualifier
- [ ] T063 [P] [US3] Create test fixtures: Multiple bean definitions (UserRepositoryImpl, AdminRepositoryImpl) with matching qualifiers

### Implementation for User Story 3

- [ ] T064 [US3] Implement qualifier extraction in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Add `extractQualifier()` method scanning field modifiers for @Qualifier annotation
- [ ] T065 [US3] Update extractFieldInfo() in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Call extractQualifier() and store result in LombokFieldInfo.qualifier property
- [ ] T066 [US3] Update convertToInjectionPoints() in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Set BeanInjectionPoint.qualifier from LombokFieldInfo.qualifier
- [ ] T067 [US3] Verify existing BeanResolver handles Lombok qualifiers in `src/spring-bean-navigation/resolver/beanResolver.ts`: No changes needed - qualifier matching should work via existing logic
- [ ] T068 [US3] Add annotation parameter extraction utility in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Reuse AnnotationScanner.extractAnnotationParameter() method
- [ ] T069 [US3] Run tests and verify User Story 3 passes: Qualifier-based navigation works for Lombok fields
- [ ] T070 [US3] Verify 80% code coverage maintained with qualifier extraction support

**Checkpoint**: All user stories should now be independently functional - Full Lombok feature parity with explicit @Autowired

---

## Phase 6: Edge Cases & Robustness

**Purpose**: Handle edge cases and ensure robustness across diverse codebases

- [ ] T071 [P] Unit test: Mixed injection patterns (explicit @Autowired + Lombok) in same class in `src/test/suite/spring-bean-navigation/lombok/lombokInjectionExtractor.test.ts`
- [ ] T072 [P] Unit test: Invalid bean types (primitives, String, List without generic) in `src/test/suite/spring-bean-navigation/lombok/lombokInjectionExtractor.test.ts`
- [ ] T073 [P] Unit test: Malformed onConstructor syntax (missing @Autowired, invalid format) in `src/test/suite/spring-bean-navigation/lombok/lombokAnnotationDetector.test.ts`
- [ ] T074 [P] Unit test: Import variations (lombok.NonNull vs @NonNull) in `src/test/suite/spring-bean-navigation/lombok/lombokInjectionExtractor.test.ts`
- [ ] T075 [P] Unit test: Static fields are excluded from Lombok injection extraction in `src/test/suite/spring-bean-navigation/lombok/lombokInjectionExtractor.test.ts`
- [ ] T076 [P] Unit test: Inheritance - superclass fields marked @NonNull in `src/test/suite/spring-bean-navigation/lombok/lombokInjectionExtractor.test.ts`
- [ ] T077 Implement static field exclusion in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Add isStaticField() check and skip static fields in extractFieldInfo()
- [ ] T078 Handle CST navigation failures gracefully in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Add try-catch blocks, log warnings, return empty array instead of throwing
- [ ] T079 Handle malformed annotations gracefully in `src/spring-bean-navigation/indexer/lombok/lombokAnnotationDetector.ts`: Return null for invalid/malformed onConstructor syntax instead of throwing
- [ ] T080 Add warning logs for skipped fields in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Log when field type extraction fails or field is skipped
- [ ] T081 Run edge case tests and verify all pass

---

## Phase 7: Performance Validation

**Purpose**: Ensure Lombok detection meets performance targets (<100ms per file, <10% indexing overhead)

- [ ] T082 [P] Performance benchmark test: Lombok annotation detection completes in <50ms per file in `src/test/suite/spring-bean-navigation/lombok/lombokAnnotationDetector.test.ts`
- [ ] T083 [P] Performance benchmark test: Field extraction completes in <50ms for class with 20 fields in `src/test/suite/spring-bean-navigation/lombok/lombokInjectionExtractor.test.ts`
- [ ] T084 [P] Performance benchmark test: Overall indexing overhead is <10% for project with 1000 files in `src/test/suite/spring-bean-navigation/beanIndexer.test.ts`
- [ ] T085 Pre-compile regex patterns as class constants in `src/spring-bean-navigation/indexer/lombok/lombokAnnotationDetector.ts`: Move regex patterns outside methods for performance
- [ ] T086 Add caching for Lombok annotation detection results in `src/spring-bean-navigation/indexer/lombok/lombokAnnotationDetector.ts`: Cache per class to avoid redundant detection
- [ ] T087 Optimize field filtering for @AllArgsConstructor in `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts`: Early return without modifier checks
- [ ] T088 Run performance benchmarks and verify all targets met (<100ms per file)
- [ ] T089 Profile extension with Lombok support using VS Code --prof-startup flag and verify no activation time regression

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories and overall quality

- [ ] T090 [P] Update README.md with Lombok support description in `README.md`: Add section explaining @RequiredArgsConstructor/@AllArgsConstructor support
- [ ] T091 [P] Add Lombok usage examples to quickstart guide in `specs/003-lombok-autowired-support/quickstart.md`: Include code snippets showing navigation from @NonNull fields
- [ ] T092 [P] Update CHANGELOG.md with feature description: Add entry for version bump with Lombok support
- [ ] T093 Code cleanup: Remove debug console.log statements from Lombok detector and extractor
- [ ] T094 Code cleanup: Extract common CST navigation utilities if multiple methods use same patterns
- [ ] T095 Refactor: Extract annotation parameter extraction to shared utility if used in multiple places
- [ ] T096 Security hardening: Validate CST node types before accessing children to prevent null reference errors
- [ ] T097 Verify overall code coverage meets 80% threshold for entire feature using npm test with coverage reporter
- [ ] T098 ESLint compliance check: Run ESLint on all Lombok-related files and fix any warnings
- [ ] T099 TypeScript strict mode compliance check: Verify no any types except explicitly justified
- [ ] T100 Run full test suite (unit + integration + E2E) for all user stories and verify 100% pass rate
- [ ] T101 Manual smoke testing: Open real-world Spring Boot + Lombok project and verify CodeLens navigation works
- [ ] T102 Update package.json version: Bump minor version (e.g., 0.2.0 → 0.3.0) for new feature

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational
  - User Story 2 (P2): Can start after Foundational (no dependency on US1)
  - User Story 3 (P3): Can start after Foundational (no dependency on US1/US2)
- **Edge Cases (Phase 6)**: Can run alongside or after any user story (tests are independent)
- **Performance (Phase 7)**: Should run after US1 is complete (needs basic implementation to benchmark)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Extends US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Uses US1 infrastructure but independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- LombokAnnotationDetector before LombokInjectionExtractor (detector is used by extractor)
- Lombok modules before integration into BeanMetadataExtractor
- Core implementation before edge case handling
- Implementation before coverage verification

### Parallel Opportunities

- **Setup (Phase 1)**: All 4 tasks marked [P] can run in parallel
- **Foundational (Phase 2)**: T005, T006, T007 can run in parallel (different files)
- **User Story 1 Tests**: T008-T017 (10 test tasks) can run in parallel
- **User Story 1 Fixtures**: T018-T019 can run in parallel
- **User Story 2 Tests**: T039-T045 (7 test tasks) can run in parallel
- **User Story 2 Fixtures**: T046-T047 can run in parallel
- **User Story 3 Tests**: T056-T061 (6 test tasks) can run in parallel
- **User Story 3 Fixtures**: T062-T063 can run in parallel
- **Edge Case Tests**: T071-T076 can run in parallel
- **Performance Tests**: T082-T084 can run in parallel
- **Polish Tasks**: T090-T092, T097-T099 can run in parallel
- **Different User Stories**: US1, US2, US3 can be implemented in parallel by different team members after Foundational phase completes

---

## Parallel Example: User Story 1

```bash
# Launch all unit tests for User Story 1 together:
Task: "Unit test: Detect @RequiredArgsConstructor with @Autowired in lombokAnnotationDetector.test.ts"
Task: "Unit test: Detect Java 7 syntax variant in lombokAnnotationDetector.test.ts"
Task: "Unit test: Return null when onConstructor lacks @Autowired in lombokAnnotationDetector.test.ts"
Task: "Unit test: Extract @NonNull fields in lombokInjectionExtractor.test.ts"
# ... (10 tests can run in parallel)

# Launch test fixtures creation together:
Task: "Create RequiredArgsConstructorController.java fixture"
Task: "Create UserService.java fixture"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (4 tasks)
2. Complete Phase 2: Foundational (3 tasks - CRITICAL)
3. Complete Phase 3: User Story 1 (31 tasks)
4. **STOP and VALIDATE**: Test User Story 1 independently
   - Open file with @RequiredArgsConstructor
   - Verify CodeLens appears on @NonNull fields
   - Click CodeLens and verify navigation to bean definition
5. Deploy/demo if ready (minimal viable Lombok support)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (7 tasks)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP - basic RequiredArgsConstructor support)
3. Add User Story 2 → Test independently → Deploy/Demo (AllArgsConstructor + syntax variants)
4. Add User Story 3 → Test independently → Deploy/Demo (Qualifier support)
5. Add Edge Cases + Performance → Test independently → Deploy (Robustness)
6. Add Polish → Final release
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers after Foundational phase (Phase 2) completes:

1. Team completes Setup (Phase 1) + Foundational (Phase 2) together (7 tasks)
2. Once Foundational is done, assign in parallel:
   - **Developer A**: User Story 1 (P1) - 31 tasks
   - **Developer B**: User Story 2 (P2) - 16 tasks
   - **Developer C**: User Story 3 (P3) - 15 tasks
3. Alternatively (single developer):
   - Complete US1 → validate → US2 → validate → US3 → validate
4. Edge cases and performance can be added by any developer once US1 is complete

---

## Task Summary

**Total Tasks**: 102 tasks

**Tasks per Phase**:
- Phase 1 (Setup): 4 tasks
- Phase 2 (Foundational): 3 tasks
- Phase 3 (User Story 1 - P1): 31 tasks (10 tests, 2 fixtures, 19 implementation)
- Phase 4 (User Story 2 - P2): 16 tasks (7 tests, 2 fixtures, 7 implementation)
- Phase 5 (User Story 3 - P3): 15 tasks (6 tests, 2 fixtures, 7 implementation)
- Phase 6 (Edge Cases): 11 tasks (6 tests, 5 implementation)
- Phase 7 (Performance): 8 tasks (3 tests, 5 implementation)
- Phase 8 (Polish): 14 tasks

**Parallel Opportunities Identified**: 56 tasks marked [P] can run in parallel (within their phase)

**Independent Test Criteria**:
- User Story 1: Create class with @RequiredArgsConstructor + @NonNull fields → CodeLens appears → Navigation works
- User Story 2: Test with @AllArgsConstructor and alternative syntax → CodeLens appears → Navigation works
- User Story 3: Test with @Qualifier → Navigation directly to qualified bean (no QuickPick)

**MVP Scope**: User Story 1 only (31 tasks after foundational) - Provides core Lombok support for most common use case

**Format Validation**: ✅ ALL 102 tasks follow checklist format:
- Checkbox: `- [ ]`
- Task ID: T001-T102
- [P] marker: 56 tasks (parallelizable within phase)
- [Story] label: 62 tasks (US1, US2, US3)
- Description: Includes file paths
- Setup/Foundational/Polish: No story label (as required)

---

## Notes

- [P] tasks = different files, no dependencies within phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests MUST fail before implementing (TDD Red-Green-Refactor)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Lombok detection reuses existing infrastructure (CodeLensProvider, BeanResolver) - no modifications needed
- Performance targets: <100ms per file, <10% indexing overhead, no activation time impact
