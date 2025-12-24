# Feature Specification: Lombok Constructor Injection Support

**Feature Branch**: `005-lombok-interface-injection`
**Created**: 2024-12-24
**Status**: Draft
**Input**: User description: "当前插件只能识别显式标注了Spring注入注解（如@Autowired、@Resource等）的依赖注入点。对于使用Lombok的@RequiredArgsConstructor(onConstructor = @__({@Autowired}))等方式生成的构造器注入，插件无法识别。用户希望插件能够识别Lombok生成的构造器注入，并为带有@NonNull或final修饰的字段提供与显式注解相同的代码导航功能。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Lombok Field Recognition (Priority: P1)

As a developer using Lombok to generate constructor injection, I want the plugin to recognize `@NonNull private final` fields in classes with `@RequiredArgsConstructor` as injection points, so that I can navigate to bean definitions just like with explicit `@Autowired` annotations.

**Why this priority**: This is the core MVP functionality. Without this, Lombok users cannot use the plugin's navigation features at all. It delivers immediate value by enabling basic navigation for the most common Lombok injection pattern.

**Independent Test**: Can be fully tested by creating a class with `@RequiredArgsConstructor` and `@NonNull private final` fields, then verifying CodeLens appears and navigates to concrete bean implementations. Delivers value independently without requiring interface resolution.

**Acceptance Scenarios**:

1. **Given** a Spring @Service class with `@RequiredArgsConstructor` and `@NonNull private final UserService userService` field, **When** I open the file, **Then** CodeLens should appear above the field showing "→ UserServiceImpl"
2. **Given** a class with `@RequiredArgsConstructor(onConstructor = @__({@Autowired}))` and multiple `@NonNull` final fields, **When** I hover over any field, **Then** each field should have its own CodeLens pointing to the corresponding bean
3. **Given** a class with both `@NonNull` final fields and non-final fields, **When** CodeLens is displayed, **Then** only `@NonNull` final fields should show injection CodeLens

---

### User Story 2 - Lombok with Interface Resolution (Priority: P2)

As a developer injecting interfaces via Lombok, I want the plugin to resolve interface-typed `@NonNull private final` fields to their bean implementations (using @Primary or single implementation), so that I can navigate directly to the actual implementation class.

**Why this priority**: Builds on P1 by adding interface resolution. Most Spring applications use interface-based design, so this significantly increases the feature's usefulness. Still valuable independently as it enhances the P1 navigation with smart resolution.

**Independent Test**: Can be tested by creating Lombok-injected interface fields with single or @Primary implementations, verifying CodeLens resolves to the correct implementation. Delivers value by making navigation smarter for interface-based designs.

**Acceptance Scenarios**:

1. **Given** `@NonNull private final IExampleService exampleService` in a `@RequiredArgsConstructor` class with single implementation `ExampleServiceImpl`, **When** I view the file, **Then** CodeLens shows "→ ExampleServiceImpl"
2. **Given** an interface with two implementations where one is marked `@Primary`, **When** Lombok-injected field uses that interface, **Then** CodeLens shows "→ PrimaryImpl (@Primary)"
3. **Given** an interface with no implementations, **When** Lombok-injected field uses that interface, **Then** CodeLens shows "No implementations found"

---

### User Story 3 - Lombok with @Qualifier Support (Priority: P3)

As a developer using @Qualifier with Lombok injection, I want the plugin to parse `@Qualifier("beanName")` annotations on `@NonNull private final` fields and resolve to the specifically qualified bean, so that I can navigate to the exact implementation I'm using.

**Why this priority**: This is an enhancement for advanced use cases. While important for disambiguation, most projects rely on @Primary or single implementations. Can be added later without breaking P1/P2 functionality.

**Independent Test**: Can be tested by annotating a Lombok field with `@Qualifier` and verifying it resolves to the matching bean name, not the @Primary. Delivers value independently for complex DI scenarios.

**Acceptance Scenarios**:

1. **Given** `@Qualifier("paypalService") @NonNull private final PaymentService paymentService` in a `@RequiredArgsConstructor` class, **When** multiple PaymentService implementations exist, **Then** CodeLens shows "→ paypalServiceImpl (@Qualifier)"
2. **Given** a qualified Lombok field where the qualifier doesn't match any bean, **When** I view the file, **Then** CodeLens shows "No matching bean for qualifier 'xxx'"
3. **Given** a qualified Lombok field with multiple implementations, **When** qualifier matches the @Primary bean, **Then** CodeLens shows "→ BeanName (@Qualifier overrides @Primary)"

---

### Edge Cases

- What happens when a class has both `@RequiredArgsConstructor` and `@AllArgsConstructor`? (Should prioritize explicit constructor)
- How does the system handle mixed injection (some fields Lombok, some @Autowired)?
- What if `@NonNull` is used without `final`? (Should still be recognized as Lombok will inject it)
- How to handle `@RequiredArgsConstructor(staticName = "of")` factory methods?
- What if Lombok is configured with custom annotation retention in lombok.config?
- How to handle fields with both `@NonNull` and `@Autowired` (redundant but valid)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect `@RequiredArgsConstructor` annotation on Spring-managed classes (@Component, @Service, @Repository, @Controller)
- **FR-002**: System MUST identify fields eligible for Lombok constructor injection: fields that are `final` and either annotated with `@NonNull` or are in a class with `@RequiredArgsConstructor`
- **FR-003**: System MUST parse `@RequiredArgsConstructor` with `onConstructor` parameter (e.g., `onConstructor = @__({@Autowired})`)
- **FR-004**: System MUST treat Lombok-eligible fields as injection points equivalent to `@Autowired` constructor parameters
- **FR-005**: System MUST extract field type information from Lombok-eligible fields to determine bean type to inject
- **FR-006**: System MUST support `@AllArgsConstructor` similarly to `@RequiredArgsConstructor` for comprehensive Lombok support
- **FR-007**: System MUST parse `@Qualifier` annotations on Lombok-eligible fields and use them for bean resolution
- **FR-008**: System MUST integrate Lombok field detection with existing interface resolution logic (InterfaceResolver)
- **FR-009**: CodeLens MUST appear at the same line as the field declaration for Lombok-injected fields
- **FR-010**: CodeLens click action MUST navigate to the resolved bean definition (class or @Bean method)
- **FR-011**: System MUST handle generic types in Lombok fields (e.g., `@NonNull private final List<String> items`)
- **FR-012**: System MUST gracefully handle cases where Lombok annotation processor is not configured in the project

### UX Requirements (per Constitution Principle III)

- Navigation commands MUST follow existing convention: `happy-java.navigateToBean`
- Error messages for unresolved Lombok beans MUST be actionable (e.g., "No bean found for IExampleService. Ensure implementation is annotated with @Component.")
- CodeLens appearance MUST be consistent with existing injection-point CodeLens style
- All Lombok detection MUST respect VS Code themes (syntax highlighting compatibility)
- Performance: Lombok field parsing MUST complete within 100ms per file to avoid UI lag

### Key Entities *(include if feature involves data)*

- **LombokInjectionPoint**: Represents a Lombok-detected field eligible for constructor injection
  - Extends or similar to existing `BeanInjectionPoint` model
  - Attributes: field name, field type, qualifiers, location, source annotation (@RequiredArgsConstructor vs @AllArgsConstructor)
- **LombokAnnotationMetadata**: Metadata extracted from Lombok constructor annotations
  - Attributes: annotation type, onConstructor parameters, staticName (if present)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: CodeLens appears on 100% of valid Lombok-injected fields (`@NonNull private final` in `@RequiredArgsConstructor` classes) within 200ms of file opening
- **SC-002**: Navigation from Lombok field CodeLens to bean definition succeeds in 95%+ of cases (excluding genuinely missing beans)
- **SC-003**: Interface resolution for Lombok fields matches accuracy of explicit @Autowired resolution (verified by shared test suite)
- **SC-004**: Extension continues to function correctly in projects without Lombok (no false positives)
- **SC-005**: All 3 user stories pass their independent acceptance tests with 100% success rate

## Dependencies

- **Existing Features**:
  - Interface resolution system (InterfaceResolver, InterfaceRegistry) - Required for P2
  - Bean indexing (BeanIndexer) - Required for all priorities
  - CodeLens provider (SpringBeanCodeLensProvider) - Required for all priorities

- **External Libraries**:
  - java-parser (already in use) - May need enhancement to parse Lombok annotations
  - Lombok annotation definitions - May need type definitions for TypeScript

- **Technical Constraints**:
  - Must work without Lombok annotation processor being active (parse source, not compiled bytecode)
  - Must handle both old-style (`onConstructor = @__({@Autowired})`) and new-style (`onConstructor_ = {@Autowired}`) syntax

## Implementation Notes

This specification intentionally avoids implementation details, but notes the following considerations for the planning phase:

1. **CST Parsing**: Need to enhance Java CST parser to recognize Lombok constructor annotations and their parameters
2. **Field Analysis**: Need to determine field finality and @NonNull presence from CST
3. **Integration Point**: LombokInjectionDetector should feed into existing InjectionPointExtractor workflow
4. **Testing Strategy**: Unit tests for Lombok annotation parsing, integration tests for end-to-end navigation, fixture files with various Lombok patterns

## Open Questions

- Should we support `@Builder` with `@Singular` injection (rare edge case)?
- How to handle Lombok delombok output if present in project?
- Should we provide configuration option to disable Lombok injection detection?
