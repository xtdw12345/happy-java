# Feature Specification: Interface-Based Bean Resolution

**Feature Branch**: `004-interface-bean-support`
**Created**: 2025-12-24
**Status**: Draft
**Input**: User description: "当前版本中，本项目仅支持在 以具体实现类类型直接引用 Bean 的场景下，对 Bean 定义位置进行识别与定位。然而，在实际的 Spring 应用开发中，更为常见的实践是 面向接口编程：业务逻辑通常通过接口进行抽象，并由具体实现类完成实现，从而提升系统的可扩展性与可维护性。在 Spring 框架中，这类 Bean 通常通过以下方式进行定义：在接口实现类上标注 @Component、@Service、@Repository 等注解，或通过 @Bean 方法返回接口实现类的实例。在上述模式下，Bean 的注入点往往以 接口类型 进行声明，而非直接依赖具体实现类。当前项目尚无法在此类场景中正确解析接口与其实现类之间的关系，从而无法为接口类型的注入点提供 Bean 定义定位能力。因此，有必要对现有的 Bean 查找与解析能力进行升级：当某个 Field 以接口类型引入 Bean 时，项目应能够解析该接口对应的实现类 Bean，并在该 Field 上方提供相应的 CodeLens，以支持快速定位到具体的 Bean 定义位置（包括实现类或 @Bean 方法）。"

## User Scenarios & Testing

### User Story 1 - Single Interface Implementation Navigation (Priority: P1)

A developer declares a field with an interface type that has exactly one implementation class annotated with a Spring bean annotation. They want to quickly navigate from the injection point to the concrete implementation.

**Why this priority**: This is the most common scenario in Spring applications (80%+ of interface-based injections have single implementations). It provides immediate value by enabling navigation for the majority of interface-based dependency injections, which is currently completely blocked.

**Independent Test**: Can be fully tested by creating a simple service interface with one @Service implementation, injecting it via interface type, and verifying that CodeLens appears and navigates to the implementation class. Delivers immediate navigation capability for single-implementation interfaces without requiring any disambiguation logic.

**Acceptance Scenarios**:

1. **Given** a Java interface `UserRepository` and a single implementation class `UserRepositoryImpl` annotated with `@Repository`, **When** a developer hovers over or views a field declared as `private UserRepository userRepository`, **Then** CodeLens appears showing "Go to implementation: UserRepositoryImpl" and clicking navigates to the implementation class location
2. **Given** an interface-typed field with `@Autowired` annotation, **When** the implementation class is in a different package, **Then** CodeLens still correctly identifies and navigates to the implementation
3. **Given** an interface with a single `@Bean` method returning its implementation, **When** viewing the interface-typed injection point, **Then** CodeLens shows "Go to bean definition: [methodName]" and navigates to the @Bean method location

---

### User Story 2 - Multiple Implementations with @Primary (Priority: P2)

A developer has an interface with multiple implementations, where one is marked with `@Primary`. They expect navigation to go directly to the primary implementation, matching Spring's runtime behavior.

**Why this priority**: This is the second most common pattern (15-20% of interface injections) and aligns with Spring's built-in disambiguation strategy. Supports standard Spring best practices for managing multiple implementations.

**Independent Test**: Create an interface with two implementations, mark one with @Primary, inject via interface type, and verify CodeLens navigates to the @Primary bean. Can be tested independently and demonstrates Spring-compatible disambiguation without requiring qualifiers.

**Acceptance Scenarios**:

1. **Given** interface `PaymentService` with two implementations `StripePaymentService` and `PayPalPaymentService`, where `StripePaymentService` is annotated with `@Primary`, **When** viewing field `private PaymentService paymentService`, **Then** CodeLens shows "Go to primary implementation: StripePaymentService" and navigates there
2. **Given** multiple @Bean methods returning the same interface type, where one method is annotated with `@Primary`, **When** viewing the interface-typed injection point, **Then** CodeLens navigates to the @Primary @Bean method
3. **Given** multiple implementations where only one is @Primary, **When** the field has no @Qualifier annotation, **Then** CodeLens automatically selects the @Primary bean without requiring user interaction

---

### User Story 3 - Multiple Implementations with Qualifier Matching (Priority: P3)

A developer uses `@Qualifier` annotations to specify which implementation should be injected when multiple candidates exist. They want navigation to respect the qualifier and go directly to the matched implementation.

**Why this priority**: This covers the remaining 5-10% of cases and provides complete disambiguation support. While less common, it's essential for complex applications with multiple implementations and no single primary bean.

**Independent Test**: Create an interface with multiple implementations, each with different qualifier names, inject with @Qualifier("specificName"), and verify CodeLens navigates to the correctly qualified bean. Tests the most sophisticated disambiguation scenario independently.

**Acceptance Scenarios**:

1. **Given** interface `DataSource` with implementations qualified as `@Qualifier("primaryDB")` and `@Qualifier("secondaryDB")`, **When** viewing field `@Qualifier("primaryDB") private DataSource dataSource`, **Then** CodeLens navigates to the implementation with matching qualifier "primaryDB"
2. **Given** a @Bean method with a qualifier and an interface return type, **When** the injection point specifies the same qualifier, **Then** CodeLens correctly matches and navigates to that @Bean method
3. **Given** multiple implementations where none is @Primary, **When** field has no @Qualifier, **Then** CodeLens shows "Multiple implementations found (2)" and clicking presents a quick-pick menu with all candidates

---

### Edge Cases

- What happens when an interface has no implementations at all?
  - CodeLens should show "No implementations found" and be non-clickable, or show a warning icon
- How does the system handle multiple implementations with neither @Primary nor @Qualifier?
  - CodeLens should show "Multiple implementations found (N)" and clicking displays a quick-pick list of all candidates
- What about abstract classes vs interfaces?
  - Abstract classes should be treated the same as interfaces (they can have implementing classes)
- How are generic interfaces handled (e.g., `Repository<User>`)?
  - Generic type parameters should be ignored for matching; match on the raw interface type (e.g., `Repository`)
- What happens with interface inheritance chains (Interface A extends Interface B, Class C implements A)?
  - Should match direct implementations of the injected interface type only (not search up the hierarchy)
- What if an interface is in an external JAR (not in the workspace)?
  - Only index and match implementations within the workspace; external interfaces with workspace implementations should still work

## Requirements

### Functional Requirements

- **FR-001**: System MUST identify Java interface declarations and maintain an interface registry in the bean index
- **FR-002**: System MUST detect class declarations that implement interfaces (via `implements` keyword) and record implementation relationships
- **FR-003**: System MUST detect @Bean methods that return interface types and record them as interface implementations
- **FR-004**: System MUST match injection points (fields, constructor parameters, method parameters) that have interface types to their corresponding implementation beans
- **FR-005**: When an interface has exactly one implementation bean, system MUST provide CodeLens showing "Go to implementation: [ClassName]"
- **FR-006**: When an interface has multiple implementations and one is marked @Primary, system MUST prioritize that implementation in CodeLens navigation
- **FR-007**: When an injection point uses @Qualifier, system MUST match only implementations with the same qualifier value
- **FR-008**: When an interface has multiple implementations without @Primary and without @Qualifier on injection point, system MUST show "Multiple implementations found (N)" and provide a quick-pick selection menu
- **FR-009**: System MUST support navigation from interface-typed fields in Lombok constructor injection (@RequiredArgsConstructor with @NonNull interface-typed fields)
- **FR-010**: System MUST re-index interface→implementation mappings when Java files are modified, created, or deleted
- **FR-011**: System MUST handle abstract classes the same way as interfaces (track their concrete implementations)
- **FR-012**: System MUST ignore generic type parameters when matching interfaces (match on raw type only)

### UX Requirements (per Constitution Principle III)

- CodeLens for interface-typed injection points MUST use clear, action-oriented text: "Go to implementation: [ClassName]" or "Go to primary implementation: [ClassName]"
- When multiple implementations exist without clear disambiguation, CodeLens MUST show count: "Multiple implementations found (N)"
- Quick-pick selection menu MUST display implementation bean names, fully qualified class names, and file locations for easy identification
- If interface resolution takes longer than 500ms during indexing, system MUST show progress notification: "Indexing interface implementations..."
- Error messages for missing implementations MUST be actionable: "No implementations found for interface [InterfaceName]. Ensure implementation classes are annotated with @Component, @Service, or @Repository."
- All CodeLens elements MUST respect VS Code themes (dark/light mode)

### Key Entities

- **Interface Definition**: Represents a Java interface or abstract class that can be implemented, including its fully qualified name, location, and whether it's within the workspace
- **Implementation Relationship**: Links an interface to its implementing class or @Bean method, including qualifier values and @Primary status for disambiguation
- **Interface-Typed Injection Point**: An injection point (field, constructor param, method param) declared with an interface type rather than a concrete class, requiring interface→implementation resolution

## Success Criteria

### Measurable Outcomes

- **SC-001**: Developers can navigate from interface-typed injection points to their implementations in under 2 clicks (1 click for single implementation, 2 clicks for multiple with selection)
- **SC-002**: CodeLens appears for at least 95% of interface-typed injection points where implementations exist in the workspace
- **SC-003**: Interface→implementation indexing completes within 5 seconds for projects with up to 500 Java files
- **SC-004**: Navigation accuracy reaches 98%+ (correct implementation is shown/selected in 98%+ of cases)
- **SC-005**: User satisfaction: 90% of developers using interface-based injection report that the feature saves them time compared to manual search

## Assumptions

- Interface and implementation classes are in the same workspace (external JARs are out of scope for implementation discovery)
- Standard Spring bean annotations are used (@Component, @Service, @Repository, @Controller, @RestController, @Configuration)
- Standard Spring disambiguation annotations are used (@Primary, @Qualifier)
- Java source files follow standard naming conventions (interfaces do not require specific naming patterns like "I" prefix)
- Generic type parameters are not used for bean matching (raw type matching is sufficient)
- Default Spring bean naming conventions apply (bean name = decapitalized class name unless explicitly specified)

## Dependencies

- Extends existing bean indexer to include interface registry and implementation relationships
- Relies on java-parser library for CST traversal to detect `implements` clauses and method return types
- Depends on existing bean resolution logic for @Primary and @Qualifier support
- Works with existing CodeLens provider infrastructure

## Out of Scope

- Navigation to interfaces from implementation classes (reverse direction)
- Detection of interface implementations in external JARs or compiled .class files
- Support for JSR-330 annotations beyond @Inject (if not already supported)
- Advanced generic type matching (e.g., matching `Repository<User>` specifically vs `Repository<Order>`)
- Interface method-level navigation (e.g., navigating from interface method to overridden implementation method)
- Refactoring support (e.g., renaming interfaces and auto-updating implementations)
