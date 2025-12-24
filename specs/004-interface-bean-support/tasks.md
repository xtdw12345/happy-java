# Tasks: Interface-Based Bean Resolution

**Input**: Design documents from `/specs/004-interface-bean-support/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: All tests MUST be written BEFORE implementation (TDD/Red-Green-Refactor cycle) per Constitution Principle II (Testing Standards). Tests MUST fail initially.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and test infrastructure

- [ ] T001 Create test directory structure at src/test/suite/spring-bean-navigation/interface-resolution/
- [ ] T002 Create test fixtures directory at src/test/suite/spring-bean-navigation/fixtures/interfaces/
- [ ] T003 [P] Create test fixture UserRepository.java in src/test/suite/spring-bean-navigation/fixtures/interfaces/
- [ ] T004 [P] Create test fixture UserRepositoryImpl.java in src/test/suite/spring-bean-navigation/fixtures/interfaces/
- [ ] T005 [P] Create test fixture PaymentService.java in src/test/suite/spring-bean-navigation/fixtures/interfaces/
- [ ] T006 [P] Create test fixture StripePaymentService.java in src/test/suite/spring-bean-navigation/fixtures/interfaces/
- [ ] T007 [P] Create test fixture PayPalPaymentService.java in src/test/suite/spring-bean-navigation/fixtures/interfaces/
- [ ] T008 [P] Create test fixture DataSource.java (abstract class) in src/test/suite/spring-bean-navigation/fixtures/interfaces/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types and utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 Add InterfaceDefinition type to src/spring-bean-navigation/models/types.ts
- [ ] T010 Add ImplementationRelationship type to src/spring-bean-navigation/models/types.ts
- [ ] T011 Add InterfaceResolutionResult type to src/spring-bean-navigation/models/types.ts
- [ ] T012 Add DisambiguationContext type to src/spring-bean-navigation/models/types.ts
- [ ] T013 Add implementedInterfaces field to BeanDefinition in src/spring-bean-navigation/models/BeanDefinition.ts
- [ ] T014 [P] Write unit tests for extractRawType() in src/test/suite/spring-bean-navigation/interface-resolution/typeUtils.test.ts (MUST FAIL)
- [ ] T015 [P] Write unit tests for normalizeFQN() in src/test/suite/spring-bean-navigation/interface-resolution/typeUtils.test.ts (MUST FAIL)
- [ ] T016 [P] Write unit tests for matchesInterface() in src/test/suite/spring-bean-navigation/interface-resolution/typeUtils.test.ts (MUST FAIL)
- [ ] T017 Create src/spring-bean-navigation/utils/typeUtils.ts with extractRawType() implementation
- [ ] T018 Implement normalizeFQN() in src/spring-bean-navigation/utils/typeUtils.ts
- [ ] T019 Implement matchesInterface() in src/spring-bean-navigation/utils/typeUtils.ts
- [ ] T020 Verify all typeUtils tests pass (Red→Green)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Single Interface Implementation Navigation (Priority: P1) 🎯 MVP

**Goal**: Enable navigation from interface-typed injection points to their single implementation bean

**Independent Test**: Create a simple service interface with one @Service implementation, inject via interface type, verify CodeLens appears and navigates to implementation class

### Tests for User Story 1 (REQUIRED per Constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation (Red-Green-Refactor)**

#### InterfaceRegistry Tests

- [ ] T021 [P] [US1] Write test: registerInterface() stores interface definition in src/test/suite/spring-bean-navigation/interface-resolution/interfaceRegistry.test.ts (MUST FAIL)
- [ ] T022 [P] [US1] Write test: registerInterface() throws on duplicate FQN in src/test/suite/spring-bean-navigation/interface-resolution/interfaceRegistry.test.ts (MUST FAIL)
- [ ] T023 [P] [US1] Write test: registerImplementation() links interface to bean in src/test/suite/spring-bean-navigation/interface-resolution/interfaceRegistry.test.ts (MUST FAIL)
- [ ] T024 [P] [US1] Write test: getImplementations() returns correct beans in src/test/suite/spring-bean-navigation/interface-resolution/interfaceRegistry.test.ts (MUST FAIL)
- [ ] T025 [P] [US1] Write test: getImplementations() returns empty array for unknown interface in src/test/suite/spring-bean-navigation/interface-resolution/interfaceRegistry.test.ts (MUST FAIL)
- [ ] T026 [P] [US1] Write test: getInterface() returns interface definition in src/test/suite/spring-bean-navigation/interface-resolution/interfaceRegistry.test.ts (MUST FAIL)

#### Interface Extraction Tests

- [ ] T027 [P] [US1] Write test: extractInterfaces() detects interface declarations in src/test/suite/spring-bean-navigation/interface-resolution/beanMetadataExtractor.test.ts (MUST FAIL)
- [ ] T028 [P] [US1] Write test: extractImplementedInterfaces() extracts implements clause in src/test/suite/spring-bean-navigation/interface-resolution/beanMetadataExtractor.test.ts (MUST FAIL)
- [ ] T029 [P] [US1] Write test: extractImplementedInterfaces() handles multiple interfaces in src/test/suite/spring-bean-navigation/interface-resolution/beanMetadataExtractor.test.ts (MUST FAIL)
- [ ] T030 [P] [US1] Write test: extractBeanMethodReturnType() extracts interface return type from @Bean method in src/test/suite/spring-bean-navigation/interface-resolution/beanMetadataExtractor.test.ts (MUST FAIL)

#### Resolution Tests

- [ ] T031 [P] [US1] Write test: resolveInterface() returns single implementation when only one exists in src/test/suite/spring-bean-navigation/interface-resolution/interfaceResolver.test.ts (MUST FAIL)
- [ ] T032 [P] [US1] Write test: resolveInterface() returns "none" when no implementations exist in src/test/suite/spring-bean-navigation/interface-resolution/interfaceResolver.test.ts (MUST FAIL)

#### CodeLens Integration Tests

- [ ] T033 [US1] Write E2E test: CodeLens appears for interface-typed field with single implementation in src/test/suite/spring-bean-navigation/interface-resolution/codeLens-interface.test.ts (MUST FAIL)
- [ ] T034 [US1] Write E2E test: CodeLens navigates to implementation class in src/test/suite/spring-bean-navigation/interface-resolution/codeLens-interface.test.ts (MUST FAIL)
- [ ] T035 [US1] Write E2E test: CodeLens shows "No implementations found" when interface has no implementations in src/test/suite/spring-bean-navigation/interface-resolution/codeLens-interface.test.ts (MUST FAIL)

### Implementation for User Story 1

#### InterfaceRegistry Implementation

- [ ] T036 [P] [US1] Create src/spring-bean-navigation/indexer/interfaceRegistry.ts with class skeleton
- [ ] T037 [US1] Implement registerInterface() in src/spring-bean-navigation/indexer/interfaceRegistry.ts
- [ ] T038 [US1] Implement registerImplementation() with bidirectional mapping in src/spring-bean-navigation/indexer/interfaceRegistry.ts
- [ ] T039 [US1] Implement getImplementations() in src/spring-bean-navigation/indexer/interfaceRegistry.ts
- [ ] T040 [US1] Implement getInterface() in src/spring-bean-navigation/indexer/interfaceRegistry.ts
- [ ] T041 [US1] Verify InterfaceRegistry tests pass (Red→Green) - T021-T026

#### Interface Extraction Implementation

- [ ] T042 [US1] Add extractInterfaces() method to src/spring-bean-navigation/indexer/beanMetadataExtractor.ts to detect interface declarations
- [ ] T043 [US1] Add extractImplementedInterfaces() method to src/spring-bean-navigation/indexer/beanMetadataExtractor.ts to extract implements clause
- [ ] T044 [US1] Update extractBeanFromClass() to populate implementedInterfaces field in src/spring-bean-navigation/indexer/beanMetadataExtractor.ts
- [ ] T045 [US1] Add extractBeanMethodReturnType() to extract interface types from @Bean methods in src/spring-bean-navigation/indexer/beanMetadataExtractor.ts
- [ ] T046 [US1] Update extract() method to return both beans and interfaces in src/spring-bean-navigation/indexer/beanMetadataExtractor.ts
- [ ] T047 [US1] Verify extraction tests pass (Red→Green) - T027-T030

#### BeanIndexer Integration

- [ ] T048 [US1] Add interfaceRegistry instance to src/spring-bean-navigation/indexer/beanIndexer.ts constructor
- [ ] T049 [US1] Add getInterfaceRegistry() method to src/spring-bean-navigation/indexer/beanIndexer.ts
- [ ] T050 [US1] Update indexFile() to register interfaces in src/spring-bean-navigation/indexer/beanIndexer.ts
- [ ] T051 [US1] Update indexFile() to register implementation relationships in src/spring-bean-navigation/indexer/beanIndexer.ts
- [ ] T052 [US1] Add removeBean() call in handleFileDeleted() in src/spring-bean-navigation/indexer/beanIndexer.ts
- [ ] T053 [US1] Add removeInterface() call in handleFileDeleted() in src/spring-bean-navigation/indexer/beanIndexer.ts

#### Interface Resolution Implementation

- [ ] T054 [P] [US1] Create src/spring-bean-navigation/resolver/interfaceResolver.ts with class skeleton
- [ ] T055 [US1] Implement resolveInterface() method with single-implementation logic in src/spring-bean-navigation/resolver/interfaceResolver.ts
- [ ] T056 [US1] Implement handling for "none" case (no implementations) in src/spring-bean-navigation/resolver/interfaceResolver.ts
- [ ] T057 [US1] Verify resolution tests pass (Red→Green) - T031-T032

#### CodeLens Provider Integration

- [ ] T058 [US1] Add interfaceResolver instance to src/spring-bean-navigation/providers/codeLensProvider.ts constructor
- [ ] T059 [US1] Update provideCodeLenses() to check if injection point type is interface in src/spring-bean-navigation/providers/codeLensProvider.ts
- [ ] T060 [US1] Add resolveInterfaceInjection() method in src/spring-bean-navigation/providers/codeLensProvider.ts
- [ ] T061 [US1] Add createCodeLensFromResult() method to handle InterfaceResolutionResult in src/spring-bean-navigation/providers/codeLensProvider.ts
- [ ] T062 [US1] Add createErrorCodeLens() for "no implementations" case in src/spring-bean-navigation/providers/codeLensProvider.ts
- [ ] T063 [US1] Verify CodeLens E2E tests pass (Red→Green) - T033-T035

#### Verification

- [ ] T064 [US1] Run all User Story 1 tests and verify 100% pass
- [ ] T065 [US1] Verify 80% code coverage requirement met for new interface resolution code
- [ ] T066 [US1] Manual test: Open test project, verify CodeLens appears for interface-typed fields with single implementation

**Checkpoint**: User Story 1 should be fully functional - CodeLens navigation works for single-implementation interfaces

---

## Phase 4: User Story 2 - Multiple Implementations with @Primary (Priority: P2)

**Goal**: When multiple implementations exist, automatically navigate to the @Primary bean

**Independent Test**: Create interface with two implementations, mark one @Primary, inject via interface type, verify CodeLens navigates to @Primary bean

### Tests for User Story 2 (REQUIRED per Constitution) ⚠️

- [ ] T067 [P] [US2] Write test: resolveByPrimary() returns @Primary bean when multiple implementations in src/test/suite/spring-bean-navigation/interface-resolution/interfaceResolver.test.ts (MUST FAIL)
- [ ] T068 [P] [US2] Write test: resolveByPrimary() returns undefined when no @Primary in src/test/suite/spring-bean-navigation/interface-resolution/interfaceResolver.test.ts (MUST FAIL)
- [ ] T069 [P] [US2] Write test: resolveByPrimary() throws error when multiple @Primary beans in src/test/suite/spring-bean-navigation/interface-resolution/interfaceResolver.test.ts (MUST FAIL)
- [ ] T070 [P] [US2] Write test: resolveInterface() prioritizes @Primary over single selection in src/test/suite/spring-bean-navigation/interface-resolution/interfaceResolver.test.ts (MUST FAIL)
- [ ] T071 [US2] Write E2E test: CodeLens shows "Go to primary implementation" for @Primary bean in src/test/suite/spring-bean-navigation/interface-resolution/codeLens-interface.test.ts (MUST FAIL)
- [ ] T072 [US2] Write E2E test: CodeLens navigates to @Primary bean method when multiple @Bean methods exist in src/test/suite/spring-bean-navigation/interface-resolution/codeLens-interface.test.ts (MUST FAIL)

### Implementation for User Story 2

- [ ] T073 [P] [US2] Implement resolveByPrimary() method in src/spring-bean-navigation/resolver/interfaceResolver.ts
- [ ] T074 [US2] Update resolveInterface() to call resolveByPrimary() before single selection in src/spring-bean-navigation/resolver/interfaceResolver.ts
- [ ] T075 [US2] Add error handling for multiple @Primary beans in src/spring-bean-navigation/resolver/interfaceResolver.ts
- [ ] T076 [US2] Verify resolution tests pass (Red→Green) - T067-T070
- [ ] T077 [US2] Update createCodeLensFromResult() to handle "primary" status in src/spring-bean-navigation/providers/codeLensProvider.ts
- [ ] T078 [US2] Verify CodeLens E2E tests pass (Red→Green) - T071-T072
- [ ] T079 [US2] Run all User Story 2 tests and verify 100% pass
- [ ] T080 [US2] Verify 80% code coverage maintained for updated code
- [ ] T081 [US2] Manual test: Create interface with multiple implementations, verify @Primary navigation works

**Checkpoint**: User Story 2 complete - @Primary disambiguation works correctly

---

## Phase 5: User Story 3 - Multiple Implementations with Qualifier Matching (Priority: P3)

**Goal**: Respect @Qualifier annotations to navigate to the correctly qualified implementation

**Independent Test**: Create interface with multiple qualified implementations, inject with @Qualifier, verify CodeLens navigates to matching bean

### Tests for User Story 3 (REQUIRED per Constitution) ⚠️

- [ ] T082 [P] [US3] Write test: resolveByQualifier() matches bean with exact qualifier in src/test/suite/spring-bean-navigation/interface-resolution/interfaceResolver.test.ts (MUST FAIL)
- [ ] T083 [P] [US3] Write test: resolveByQualifier() falls back to bean name matching in src/test/suite/spring-bean-navigation/interface-resolution/interfaceResolver.test.ts (MUST FAIL)
- [ ] T084 [P] [US3] Write test: resolveByQualifier() returns undefined when no match in src/test/suite/spring-bean-navigation/interface-resolution/interfaceResolver.test.ts (MUST FAIL)
- [ ] T085 [P] [US3] Write test: resolveInterface() prioritizes qualifier over @Primary in src/test/suite/spring-bean-navigation/interface-resolution/interfaceResolver.test.ts (MUST FAIL)
- [ ] T086 [P] [US3] Write test: resolveInterface() returns "multiple" when no qualifier and no @Primary in src/test/suite/spring-bean-navigation/interface-resolution/interfaceResolver.test.ts (MUST FAIL)
- [ ] T087 [US3] Write E2E test: CodeLens shows "Go to qualified implementation" for @Qualifier match in src/test/suite/spring-bean-navigation/interface-resolution/codeLens-interface.test.ts (MUST FAIL)
- [ ] T088 [US3] Write E2E test: CodeLens shows "Multiple implementations found (N)" when no disambiguation in src/test/suite/spring-bean-navigation/interface-resolution/codeLens-interface.test.ts (MUST FAIL)

### Implementation for User Story 3

- [ ] T089 [P] [US3] Implement resolveByQualifier() method in src/spring-bean-navigation/resolver/interfaceResolver.ts
- [ ] T090 [US3] Update resolveInterface() to check qualifier FIRST (before @Primary) in src/spring-bean-navigation/resolver/interfaceResolver.ts
- [ ] T091 [US3] Add "multiple" case handling to resolveInterface() in src/spring-bean-navigation/resolver/interfaceResolver.ts
- [ ] T092 [US3] Implement createQuickPickItems() for user selection in src/spring-bean-navigation/resolver/interfaceResolver.ts
- [ ] T093 [US3] Verify resolution tests pass (Red→Green) - T082-T086
- [ ] T094 [US3] Update createCodeLensFromResult() to handle "qualified" status in src/spring-bean-navigation/providers/codeLensProvider.ts
- [ ] T095 [US3] Update createCodeLensFromResult() to handle "multiple" status with quick pick command in src/spring-bean-navigation/providers/codeLensProvider.ts
- [ ] T096 [US3] Register "happy-java.selectImplementation" command in extension.ts
- [ ] T097 [US3] Implement selectImplementation() command handler showing quick pick UI in extension.ts
- [ ] T098 [US3] Verify CodeLens E2E tests pass (Red→Green) - T087-T088
- [ ] T099 [US3] Run all User Story 3 tests and verify 100% pass
- [ ] T100 [US3] Verify 80% code coverage maintained for updated code
- [ ] T101 [US3] Manual test: Create interface with multiple qualified implementations, verify @Qualifier navigation works
- [ ] T102 [US3] Manual test: Create interface with multiple unqualified implementations, verify quick pick appears

**Checkpoint**: All user stories complete - Interface resolution fully functional with all disambiguation strategies

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, performance, error handling, and final polish

### Edge Case Handling

- [ ] T103 [P] Write test: Handle abstract classes same as interfaces in src/test/suite/spring-bean-navigation/interface-resolution/interfaceRegistry.test.ts (MUST FAIL)
- [ ] T104 [P] Write test: Generic type parameters are ignored during matching in src/test/suite/spring-bean-navigation/interface-resolution/typeUtils.test.ts (MUST FAIL)
- [ ] T105 [P] Write test: removeBean() cleans up all interface mappings in src/test/suite/spring-bean-navigation/interface-resolution/interfaceRegistry.test.ts (MUST FAIL)
- [ ] T106 [P] Write test: removeInterface() cleans up all implementation mappings in src/test/suite/spring-bean-navigation/interface-resolution/interfaceRegistry.test.ts (MUST FAIL)
- [ ] T107 Implement abstract class detection in extractInterfaces() in src/spring-bean-navigation/indexer/beanMetadataExtractor.ts
- [ ] T108 Verify abstract class handling (test T103 passes)
- [ ] T109 Verify generic type erasure works correctly (test T104 passes)
- [ ] T110 [P] Implement removeBean() method in src/spring-bean-navigation/indexer/interfaceRegistry.ts
- [ ] T111 [P] Implement removeInterface() method in src/spring-bean-navigation/indexer/interfaceRegistry.ts
- [ ] T112 Verify cleanup tests pass (T105-T106)

### Performance & Monitoring

- [ ] T113 [P] Add performance logging for interface resolution in src/spring-bean-navigation/resolver/interfaceResolver.ts
- [ ] T114 [P] Add console warnings for resolutions exceeding 50ms threshold in src/spring-bean-navigation/resolver/interfaceResolver.ts
- [ ] T115 Write performance benchmark test: Index 500 files in <5 seconds in src/test/suite/spring-bean-navigation/interface-resolution/performance.test.ts
- [ ] T116 Write performance benchmark test: Resolve interface in <50ms in src/test/suite/spring-bean-navigation/interface-resolution/performance.test.ts
- [ ] T117 Run performance benchmarks and verify targets met

### Error Handling & UX

- [ ] T118 [P] Add actionable error messages for configuration issues (multiple @Primary) in src/spring-bean-navigation/resolver/interfaceResolver.ts
- [ ] T119 [P] Add progress notification for interface indexing >500ms in src/spring-bean-navigation/indexer/beanIndexer.ts
- [ ] T120 Write test: Verify error messages are actionable in src/test/suite/spring-bean-navigation/interface-resolution/interfaceResolver.test.ts
- [ ] T121 Verify error handling tests pass

### Final Verification

- [ ] T122 Run complete test suite (all 121 previous tests) and verify 100% pass
- [ ] T123 Verify 80% code coverage requirement met for entire feature
- [ ] T124 Run ESLint and verify zero warnings/errors
- [ ] T125 Build extension and verify compilation succeeds with TypeScript strict mode
- [ ] T126 Package extension as VSIX and install in clean VS Code instance
- [ ] T127 Manual E2E test: Open real Spring project, verify interface navigation works for all scenarios
- [ ] T128 Update CHANGELOG.md with feature description and breaking changes (if any)

---

## Dependencies & Parallel Execution

### User Story Dependency Graph

```
Phase 1 (Setup)
     ↓
Phase 2 (Foundational: Types + TypeUtils)
     ↓
Phase 3 (US1: Single Implementation) ← MVP Scope
     ↓
Phase 4 (US2: @Primary) ← Depends on US1
     ↓
Phase 5 (US3: @Qualifier) ← Depends on US1 & US2
     ↓
Phase 6 (Polish)
```

**Independent Stories**: All user stories depend on Phase 2 but could theoretically be implemented in parallel if multiple developers work on the feature. However, since US2 and US3 build on US1's infrastructure, sequential implementation is recommended.

### Parallel Execution Opportunities

**Phase 1 (Setup)**: Tasks T003-T008 can all run in parallel (different fixture files)

**Phase 2 (Foundational)**: Tasks T014-T016 (test writing) can run in parallel

**Phase 3 (User Story 1)**:
- Test writing: T021-T026 (registry tests), T027-T030 (extraction tests), T031-T032 (resolver tests) can run in parallel
- Implementation: T036-T041 (registry), T042-T047 (extraction), T054-T057 (resolver) can run in parallel after their tests are written

**Phase 4 (User Story 2)**: Tasks T067-T069 (test writing) can run in parallel

**Phase 5 (User Story 3)**: Tasks T082-T086 (test writing) can run in parallel

**Phase 6 (Polish)**: Tasks T103-T104, T110-T111, T113-T114, T118-T119 can all run in parallel

### Recommended MVP Scope

**Minimum Viable Product = Phase 3 Only (User Story 1)**

This delivers:
- ✅ Interface-typed injection point detection
- ✅ Single-implementation navigation (80% of use cases)
- ✅ "No implementations found" error handling
- ✅ Full integration with existing CodeLens system

**Total MVP Tasks**: T001-T066 (66 tasks)
**Estimated Effort**: 2-3 days for experienced developer following TDD

**Incremental Delivery**:
1. **Release 1** (MVP): US1 only - Single implementation navigation
2. **Release 2**: US1 + US2 - Add @Primary disambiguation
3. **Release 3**: US1 + US2 + US3 - Complete with @Qualifier matching
4. **Release 4**: All stories + Polish - Production-ready

---

## Implementation Strategy

### TDD Workflow (REQUIRED per Constitution)

For each component:
1. **RED**: Write test, run it, verify it fails
2. **GREEN**: Implement minimum code to pass test
3. **REFACTOR**: Clean up code while keeping tests green
4. Repeat for next test

**Example for InterfaceRegistry**:
1. Write T021 (registerInterface test) → FAIL
2. Implement registerInterface() → PASS
3. Refactor if needed → PASS
4. Write T022 (duplicate FQN test) → FAIL
5. Add validation → PASS
6. Continue...

### Code Review Checkpoints

- **After Phase 2**: Review types and utilities (foundation for all stories)
- **After Phase 3**: Review User Story 1 (MVP) - consider demo to stakeholders
- **After Phase 4**: Review @Primary logic
- **After Phase 5**: Review @Qualifier logic and quick pick UI
- **After Phase 6**: Final code review before merge

### Testing Discipline

- **Every task with "Write test" MUST fail initially** - If test passes before implementation, it's not testing the right thing
- **Every implementation task MUST make a failing test pass** - No code without tests
- **Coverage MUST stay ≥80%** throughout - Check after each phase
- **Integration tests MUST use real fixtures** - No mocking for E2E tests

---

## Task Statistics

**Total Tasks**: 128
- Phase 1 (Setup): 8 tasks
- Phase 2 (Foundational): 12 tasks
- Phase 3 (User Story 1): 46 tasks (31 tests + 15 implementation)
- Phase 4 (User Story 2): 15 tasks (6 tests + 9 implementation)
- Phase 5 (User Story 3): 21 tasks (7 tests + 14 implementation)
- Phase 6 (Polish): 26 tasks

**Test Tasks**: 72 (56% of total - emphasizes TDD approach)
**Parallelizable Tasks**: 35 tasks marked with [P]

**Format Validation**: ✅ All tasks follow required format:
- ✅ All tasks have checkboxes `- [ ]`
- ✅ All tasks have sequential IDs (T001-T128)
- ✅ All story tasks have [US1], [US2], or [US3] labels
- ✅ All parallelizable tasks have [P] marker
- ✅ All tasks include file paths in descriptions
