# Tasks: Lombok Constructor Injection Support

**Input**: Design documents from `/specs/005-lombok-interface-injection/`
**Prerequisites**: plan.md (validation approach), spec.md (3 user stories), research.md (integration gap identified)

**Context**: Lombok extraction backend is **already fully implemented** (LombokAnnotationDetector + LombokInjectionExtractor with 21 passing unit tests). This task list focuses on **fixing the CodeLensProvider integration bug** and **completing E2E tests** for the 3 user stories.

**Critical Discovery**: CodeLensProvider uses manual document parsing instead of querying BeanIndexer for pre-extracted Lombok injections. This causes Lombok fields to not display CodeLens despite backend support being complete.

**Organization**: Tasks are grouped by user story to enable independent testing and validation of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup & Validation

**Purpose**: Validate existing implementation and verify BeanIndex API

- [X] T001 Run all existing unit tests to verify Lombok extraction works (verify 21 Lombok tests pass in src/test/suite/spring-bean-navigation/lombok/)
- [X] T002 [P] Verify BeanIndex has API to query injection points by URI in src/spring-bean-navigation/models/BeanIndex.ts
- [X] T003 [P] Document existing Lombok data models in specs/005-lombok-interface-injection/data-model.md (LombokConstructorAnnotation, LombokFieldInfo)
- [X] T004 [P] Create quickstart guide outline in specs/005-lombok-interface-injection/quickstart.md

---

## Phase 2: Foundational - Fix CodeLens Integration Bug 🔧

**Purpose**: Core bug fix that enables ALL user stories - MUST complete before any E2E testing

**⚠️ CRITICAL**: This fix unblocks all three user stories. CodeLens will not display for Lombok fields until this is complete.

**Bug Location**: `src/spring-bean-navigation/providers/beanCodeLensProvider.ts:119-172`

- [X] T005 Add getInjectionPointsForUri() method to BeanIndex if missing in src/spring-bean-navigation/models/BeanIndex.ts (filter injectionPoints by location.uri)
- [X] T006 Refactor SpringBeanCodeLensProvider.findInjectionPoints() to query BeanIndexer for pre-extracted injection points in src/spring-bean-navigation/providers/beanCodeLensProvider.ts
- [X] T007 Add fallback to manual parsing for backward compatibility in src/spring-bean-navigation/providers/beanCodeLensProvider.ts (combine indexed + manual injections)
- [X] T008 Verify CodeLensProvider handles InjectionType.LOMBOK_CONSTRUCTOR in createCodeLensFromInjection() in src/spring-bean-navigation/providers/beanCodeLensProvider.ts
- [X] T009 Run all existing tests to ensure no regression (verify 199 tests still pass)

**Checkpoint**: CodeLensProvider now queries BeanIndexer - Lombok CodeLens should appear

---

## Phase 3: User Story 1 - Basic Lombok Field Recognition (Priority: P1) 🎯 MVP

**Goal**: CodeLens appears on @NonNull/final fields in @RequiredArgsConstructor classes and navigates to concrete bean implementations

**Independent Test**: Open RequiredArgsConstructorController.java fixture, verify CodeLens appears above @NonNull private final UserService field showing "→ UserServiceImpl", click to navigate

**Acceptance Criteria** (from spec.md):
1. CodeLens appears above @NonNull final field showing bean name
2. Multiple @NonNull fields each get their own CodeLens
3. Non-@NonNull non-final fields do NOT get CodeLens

### E2E Tests for User Story 1 (TDD: Write FIRST, ensure FAIL)

- [X] T010 [P] [US1] Write E2E test: CodeLens appears on @NonNull final field in @RequiredArgsConstructor class in src/test/suite/spring-bean-navigation/lombok/lombokCodeLensIntegration.test.ts
- [X] T011 [P] [US1] Write E2E test: Multiple @NonNull fields each get CodeLens in src/test/suite/spring-bean-navigation/lombok/lombokCodeLensIntegration.test.ts
- [X] T012 [P] [US1] Write E2E test: Non-@NonNull non-final fields do NOT get CodeLens in src/test/suite/spring-bean-navigation/lombok/lombokCodeLensIntegration.test.ts
- [X] T013 [P] [US1] Write E2E test: CodeLens click navigates to concrete bean definition in src/test/suite/spring-bean-navigation/lombok/lombokCodeLensIntegration.test.ts
- [X] T014 [P] [US1] Write E2E test: @AllArgsConstructor includes all fields in src/test/suite/spring-bean-navigation/lombok/lombokCodeLensIntegration.test.ts

### Validation for User Story 1

- [X] T015 [US1] Run E2E tests for User Story 1 and verify all pass (T010-T014)
- [X] T016 [US1] Manual test with RequiredArgsConstructorController.java fixture (verify CodeLens appears and navigation works)
- [X] T017 [US1] Manual test with AllArgsConstructorService.java fixture (verify all fields get CodeLens)
- [X] T018 [US1] Verify SC-001: CodeLens appears within 200ms of file opening
- [X] T019 [US1] Verify SC-002: Navigation succeeds in 95%+ of test cases
- [X] T020 [US1] Verify SC-004: Extension works correctly in non-Lombok projects (no false positives)

**Checkpoint**: User Story 1 complete - Lombok CodeLens works for concrete class injections

---

## Phase 4: User Story 2 - Lombok with Interface Resolution (Priority: P2)

**Goal**: CodeLens on interface-typed Lombok fields resolves to correct implementation using InterfaceResolver (@Primary or single implementation)

**Independent Test**: Open LombokInterfaceInjectionController.java fixture, verify @NonNull private final IExampleService field shows "→ ExampleServiceImpl" for single implementation, and "→ PrimaryImpl (@Primary)" for multiple implementations with @Primary

**Acceptance Criteria** (from spec.md):
1. Interface with single implementation → CodeLens shows "→ ImplName"
2. Interface with @Primary → CodeLens shows "→ PrimaryImpl (@Primary)"
3. Interface with no implementations → CodeLens shows "No implementations found"

### Fixture Creation for User Story 2

- [X] T021 [US2] Create LombokInterfaceInjectionController.java fixture in src/test/suite/spring-bean-navigation/fixtures/lombok/ (interface-typed Lombok fields)
- [X] T022 [P] [US2] Create IExampleService.java interface in src/test/suite/spring-bean-navigation/fixtures/lombok/
- [X] T023 [P] [US2] Create ExampleServiceImpl.java bean (single implementation) in src/test/suite/spring-bean-navigation/fixtures/lombok/
- [X] T024 [P] [US2] Create PaymentService.java interface with 2 implementations in src/test/suite/spring-bean-navigation/fixtures/lombok/
- [X] T025 [P] [US2] Create StripePaymentService.java (@Primary) and PayPalPaymentService.java in src/test/suite/spring-bean-navigation/fixtures/lombok/

### E2E Tests for User Story 2 (TDD: Write FIRST, ensure FAIL)

- [X] T026 [P] [US2] Write E2E test: Interface with single implementation shows "→ ImplName" in src/test/suite/spring-bean-navigation/lombok/lombokInterfaceResolution.test.ts
- [X] T027 [P] [US2] Write E2E test: Interface with @Primary shows "→ PrimaryImpl (@Primary)" in src/test/suite/spring-bean-navigation/lombok/lombokInterfaceResolution.test.ts
- [X] T028 [P] [US2] Write E2E test: Interface with no implementations shows "No implementations found" in src/test/suite/spring-bean-navigation/lombok/lombokInterfaceResolution.test.ts
- [X] T029 [P] [US2] Write E2E test: Interface with multiple implementations (no @Primary) shows picker in src/test/suite/spring-bean-navigation/lombok/lombokInterfaceResolution.test.ts

### Validation for User Story 2

- [X] T030 [US2] Run E2E tests for User Story 2 and verify all pass (T026-T029)
- [X] T031 [US2] Manual test with LombokInterfaceInjectionController.java fixture (verify interface resolution)
- [X] T032 [US2] Verify SC-003: Interface resolution accuracy matches explicit @Autowired resolution
- [X] T033 [US2] Verify integration with existing InterfaceResolver from 002-spring-bean-navigation works seamlessly

**Checkpoint**: User Story 2 complete - Lombok CodeLens works with interface resolution

---

## Phase 5: User Story 3 - Lombok with @Qualifier Support (Priority: P3)

**Goal**: @Qualifier annotations on Lombok fields resolve to the specifically qualified bean, overriding @Primary

**Independent Test**: Open LombokWithQualifierRepository.java fixture, verify @Qualifier("paypal") @NonNull private final PaymentService field shows "→ paypalServiceImpl (@Qualifier)"

**Acceptance Criteria** (from spec.md):
1. @Qualifier matches bean name → CodeLens shows "→ BeanName (@Qualifier)"
2. @Qualifier doesn't match any bean → CodeLens shows "No matching bean for qualifier 'xxx'"
3. @Qualifier overrides @Primary → CodeLens shows qualified bean, not @Primary

### E2E Tests for User Story 3 (TDD: Write FIRST, ensure FAIL)

- [X] T034 [P] [US3] Write E2E test: @Qualifier on Lombok field resolves to qualified bean in src/test/suite/spring-bean-navigation/lombok/lombokQualifierResolution.test.ts
- [X] T035 [P] [US3] Write E2E test: @Qualifier with no matching bean shows error message in src/test/suite/spring-bean-navigation/lombok/lombokQualifierResolution.test.ts
- [X] T036 [P] [US3] Write E2E test: @Qualifier overrides @Primary in src/test/suite/spring-bean-navigation/lombok/lombokQualifierResolution.test.ts
- [X] T037 [P] [US3] Write E2E test: Multiple @Qualifier fields in same class resolve correctly in src/test/suite/spring-bean-navigation/lombok/lombokQualifierResolution.test.ts

### Validation for User Story 3

- [X] T038 [US3] Run E2E tests for User Story 3 and verify all pass (T034-T037)
- [X] T039 [US3] Manual test with LombokWithQualifierRepository.java fixture (verify qualifier resolution)
- [X] T040 [US3] Verify qualifier extraction works end-to-end (LombokInjectionExtractor → BeanInjectionPoint → InterfaceResolver)
- [X] T041 [US3] Verify qualifier takes precedence over @Primary and single implementation

**Checkpoint**: User Story 3 complete - All Lombok features working (basic + interface + qualifier)

---

## Phase 6: Edge Cases & Robustness

**Purpose**: Handle edge cases from spec.md to ensure production readiness

- [X] T042 [P] Write test: Mixed injection (some Lombok, some @Autowired) works correctly in src/test/suite/spring-bean-navigation/lombok/lombokEdgeCases.test.ts
- [X] T043 [P] Write test: @NonNull without final is recognized for @RequiredArgsConstructor in src/test/suite/spring-bean-navigation/lombok/lombokEdgeCases.test.ts
- [X] T044 [P] Write test: Class with both @RequiredArgsConstructor and explicit constructor prioritizes explicit in src/test/suite/spring-bean-navigation/lombok/lombokEdgeCases.test.ts
- [X] T045 [P] Write test: Generic types in Lombok fields (e.g., List<String>) are handled gracefully in src/test/suite/spring-bean-navigation/lombok/lombokEdgeCases.test.ts
- [X] T046 [P] Write test: Java 8 syntax variants (onConstructor_, onConstructor__) work correctly in src/test/suite/spring-bean-navigation/lombok/lombokEdgeCases.test.ts
- [X] T047 Run edge case tests and verify all pass (T042-T046)

---

## Phase 7: Documentation & Polish

**Purpose**: Complete user documentation and validate overall success criteria

- [X] T048 [P] Complete quickstart.md with usage examples and troubleshooting in specs/005-lombok-interface-injection/quickstart.md
- [X] T049 [P] Add code examples to quickstart.md showing all 3 user stories in specs/005-lombok-interface-injection/quickstart.md
- [X] T050 [P] Document supported syntax variants (Java 7, Java 8 underscore, Java 8 double underscore) in specs/005-lombok-interface-injection/quickstart.md
- [X] T051 [P] Add troubleshooting section for common issues (Lombok not detected, CodeLens not appearing) in specs/005-lombok-interface-injection/quickstart.md
- [X] T052 Verify SC-001: CodeLens appears on 100% of valid Lombok fields within 200ms (run performance test)
- [X] T053 Verify SC-005: All 3 user stories pass independent acceptance tests with 100% success rate
- [X] T054 Run full test suite and verify all 199+ tests pass (original 199 + new E2E tests)
- [X] T055 Verify 80% code coverage threshold met for Lombok components
- [X] T056 Code cleanup: Remove any debug logging added during development in src/spring-bean-navigation/providers/beanCodeLensProvider.ts
- [X] T057 ESLint and TypeScript strict mode compliance check
- [X] T058 Update CLAUDE.md if needed with Lombok support details

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational Bug Fix)**: Depends on Phase 1 completion - **BLOCKS all user stories**
- **Phase 3 (User Story 1)**: Depends on Phase 2 completion - P1 MVP
- **Phase 4 (User Story 2)**: Depends on Phase 2 completion - Can run in parallel with Phase 3 if staffed
- **Phase 5 (User Story 3)**: Depends on Phase 2 completion - Can run in parallel with Phase 3/4 if staffed
- **Phase 6 (Edge Cases)**: Depends on Phase 2 completion - Can run in parallel with user stories
- **Phase 7 (Documentation)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Phase 2 bug fix - **No dependencies on other stories**
- **User Story 2 (P2)**: Depends only on Phase 2 bug fix - **No dependencies on other stories** (independently testable)
- **User Story 3 (P3)**: Depends only on Phase 2 bug fix - **No dependencies on other stories** (independently testable)

**Key Insight**: All 3 user stories are independently testable after Phase 2. They can be implemented in parallel by different developers.

### Within Each User Story Phase

1. **Fixture creation** (if needed) → must complete before tests
2. **Write E2E tests** → MUST write and verify they FAIL before implementation
3. **Implementation** (already done for this feature - just validating)
4. **Validation** → run tests, verify success criteria
5. **Manual testing** → use fixture files to verify real-world usage

### Parallel Opportunities

**Phase 1 Setup** (all can run in parallel):
- T002 (Verify BeanIndex API)
- T003 (Document data models)
- T004 (Create quickstart outline)

**Phase 2 Bug Fix** (sequential - file conflicts):
- Must run sequentially as all tasks modify beanCodeLensProvider.ts

**Phase 3-5 User Stories** (can run in parallel after Phase 2):
- Entire Phase 3 (User Story 1)
- Entire Phase 4 (User Story 2)
- Entire Phase 5 (User Story 3)
- These are independently testable and can be worked on by different team members

**Within Each User Story** (parallel within phase):
- All fixture creation tasks marked [P]
- All E2E test writing tasks marked [P] (different test files)

**Phase 6 Edge Cases** (all can run in parallel):
- T042-T046 (different test scenarios, same file but independent tests)

**Phase 7 Documentation** (parallel writing):
- T048-T051 (documentation tasks)

---

## Parallel Example: After Phase 2 Bug Fix Complete

```bash
# Team can split into 3 parallel workstreams:

# Developer A: User Story 1 (P1 MVP)
# Complete all of Phase 3: T010-T020

# Developer B: User Story 2 (P2 Enhancement)
# Complete all of Phase 4: T021-T033

# Developer C: User Story 3 (P3 Enhancement)
# Complete all of Phase 5: T034-T041

# All three stories are independently testable and can proceed in parallel
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

**Recommended for solo developer or quick win:**

1. Complete Phase 1: Setup & Validation (T001-T004)
2. Complete Phase 2: Fix CodeLens Bug (T005-T009) → **CRITICAL BLOCKER**
3. Complete Phase 3: User Story 1 (T010-T020) → **MVP COMPLETE**
4. **STOP and VALIDATE**: Test User Story 1 independently with fixtures
5. Deploy/demo Lombok support for concrete class injections (covers 80% of use cases)

**Why This Works**: User Story 1 delivers immediate value - developers can navigate from Lombok fields to concrete beans, which is the most common pattern.

### Incremental Delivery (Recommended)

**For team or phased rollout:**

1. Complete Phase 1 + Phase 2 → **Foundation ready** (all user stories unblocked)
2. Add User Story 1 → Test independently → **Deploy/Demo MVP** (basic Lombok support)
3. Add User Story 2 → Test independently → **Deploy/Demo** (interface resolution added)
4. Add User Story 3 → Test independently → **Deploy/Demo** (qualifier support added)
5. Add Edge Cases + Polish → **Deploy/Demo** (production-ready)

**Why This Works**: Each user story adds value without breaking previous stories. Users get Lombok support incrementally.

### Parallel Team Strategy

**With 3+ developers:**

1. **All team members**: Complete Phase 1 + Phase 2 together (foundation)
2. **Once Phase 2 complete**, split:
   - **Developer A**: User Story 1 (T010-T020) → P1 MVP
   - **Developer B**: User Story 2 (T021-T033) → P2 Enhancement
   - **Developer C**: User Story 3 (T034-T041) → P3 Enhancement
3. **All team members**: Merge and test integration
4. **All team members**: Complete Phase 6 + Phase 7 together

**Why This Works**: Maximizes parallelism after the blocking bug fix. Each developer owns a complete, independently testable feature.

---

## Success Metrics

### Task Completion

- **Total Tasks**: 58 tasks
- **Phase 1 (Setup)**: 4 tasks
- **Phase 2 (Foundational)**: 5 tasks
- **Phase 3 (User Story 1)**: 11 tasks
- **Phase 4 (User Story 2)**: 13 tasks
- **Phase 5 (User Story 3)**: 8 tasks
- **Phase 6 (Edge Cases)**: 6 tasks
- **Phase 7 (Documentation)**: 11 tasks

### User Story Validation

Each user story MUST pass these independent tests:

**User Story 1**: Open RequiredArgsConstructorController.java → Verify CodeLens appears → Click to navigate → Success
**User Story 2**: Open LombokInterfaceInjectionController.java → Verify interface resolution → Navigate to implementation → Success
**User Story 3**: Open LombokWithQualifierRepository.java → Verify @Qualifier resolution → Navigate to qualified bean → Success

### Success Criteria from Spec

- **SC-001**: ✅ CodeLens appears within 200ms (verify with performance test)
- **SC-002**: ✅ Navigation succeeds in 95%+ cases (verify with E2E test suite)
- **SC-003**: ✅ Interface resolution accuracy matches @Autowired (verify with comparison tests)
- **SC-004**: ✅ No false positives in non-Lombok projects (verify with regression tests)
- **SC-005**: ✅ All 3 user stories pass acceptance tests 100% (verify with E2E test suite)

---

## Notes

- **[P] tasks** = different files or independent tests, no dependencies
- **[Story] label** maps task to specific user story for traceability
- **Each user story is independently testable** after Phase 2 bug fix
- **Tests marked TDD**: Write FIRST, verify they FAIL before implementation (Red-Green-Refactor)
- **Checkpoint after each phase**: Validate story works independently before moving on
- **Critical blocker**: Phase 2 must complete before any CodeLens will appear for Lombok fields
- **MVP = User Story 1 only**: Delivers 80% of value with basic Lombok navigation support
- **Existing unit tests**: Already have 21 passing unit tests for Lombok extraction backend
- **Bug location**: src/spring-bean-navigation/providers/beanCodeLensProvider.ts lines 119-172
- **Fixture files**: Already exist in src/test/suite/spring-bean-navigation/fixtures/lombok/ (6 files, 212 lines)
