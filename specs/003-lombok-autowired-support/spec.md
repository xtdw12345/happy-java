# Feature Specification: Lombok Annotation Support for Constructor Injection

**Feature Branch**: `003-lombok-autowired-support`
**Created**: 2025-12-22
**Status**: Draft
**Input**: User description: "现在需要为本插件新增功能:支持lombok的注解识别。比如在类上加了 @RequiredArgsConstructor(onConstructor=@__({@Autowired})),然后在字段上标注@NonNull,lombok会自动生成带有@Autowire注解的构造器,需要在对应的字段上增加codeLens,以跳转到bean定义处。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate from Lombok-generated @Autowired Constructor Field (Priority: P1)

As a Spring Boot developer using Lombok, I want to navigate from `@NonNull` fields to their Spring bean definitions when my class uses `@RequiredArgsConstructor(onConstructor=@__({@Autowired}))`, so that I can quickly understand which bean is being injected without looking at the generated constructor code.

**Why this priority**: This is the core feature that brings Lombok support to the existing Spring bean navigation functionality. Lombok's constructor-based dependency injection is a widely-used pattern in Spring projects, and without this support, users cannot navigate from these injection points, making the plugin incomplete for Lombok-based codebases.

**Independent Test**: Can be fully tested by creating a Java class with `@RequiredArgsConstructor(onConstructor=@__({@Autowired}))` and `@NonNull` fields, opening it in VS Code, and verifying that CodeLens appears on the field lines with clickable navigation to bean definitions.

**Acceptance Scenarios**:

1. **Given** a Java class with `@RequiredArgsConstructor(onConstructor=@__({@Autowired}))` and a `@NonNull` field of type `MyService`, **When** the user opens the file in VS Code, **Then** a CodeLens "→ go to bean definition" appears on the line of the `@NonNull` field
2. **Given** a `@NonNull` field with a matching Spring bean definition, **When** the user clicks the CodeLens, **Then** the editor navigates to the bean definition location
3. **Given** a `@NonNull` field with multiple matching bean candidates, **When** the user clicks the CodeLens, **Then** a QuickPick menu shows all candidates with their types and locations, allowing the user to select which bean definition to navigate to
4. **Given** a `@NonNull` field with no matching bean definition, **When** the file is opened, **Then** no CodeLens appears for that field

---

### User Story 2 - Support Different Lombok Constructor Annotation Variants (Priority: P2)

As a Spring Boot developer, I want the plugin to recognize various Lombok constructor injection patterns including `@RequiredArgsConstructor`, `@AllArgsConstructor`, and different `onConstructor` syntax variations, so that the navigation works regardless of which Lombok pattern I use in my project.

**Why this priority**: Different projects and coding standards use different Lombok patterns. Supporting multiple variants ensures the plugin works across diverse codebases and provides consistent navigation experience.

**Independent Test**: Can be tested by creating test files with each supported Lombok annotation variant and verifying CodeLens appears correctly for each pattern.

**Acceptance Scenarios**:

1. **Given** a class with `@RequiredArgsConstructor(onConstructor_={@Autowired})` (alternative syntax), **When** the file is opened, **Then** CodeLens appears on `@NonNull` fields
2. **Given** a class with `@AllArgsConstructor(onConstructor=@__({@Autowired}))`, **When** the file is opened, **Then** CodeLens appears on all fields (not just `@NonNull` ones)
3. **Given** a class with `@RequiredArgsConstructor` but without `onConstructor` parameter, **When** the file is opened, **Then** no CodeLens appears for `@NonNull` fields (since no @Autowired is generated)

---

### User Story 3 - Lombok Field Injection with @Qualifier Support (Priority: P3)

As a Spring Boot developer using Lombok with multiple bean candidates, I want to use `@Qualifier` annotations on `@NonNull` fields to specify which bean to inject, so that the plugin navigates to the correct qualified bean definition.

**Why this priority**: When multiple beans of the same type exist, developers use `@Qualifier` to disambiguate. Supporting this ensures accurate navigation in complex Spring configurations with multiple bean candidates.

**Independent Test**: Can be tested by creating a scenario with multiple beans of the same type, one with a qualifier matching the field's `@Qualifier`, and verifying that clicking CodeLens navigates directly to the qualified bean without showing a QuickPick menu.

**Acceptance Scenarios**:

1. **Given** a `@NonNull` field with `@Qualifier("myBeanName")` annotation and multiple beans of the same type, **When** the user clicks CodeLens, **Then** the editor navigates directly to the bean with qualifier "myBeanName"
2. **Given** a `@NonNull` field with `@Qualifier` and no matching qualified bean, **When** the file is opened, **Then** CodeLens shows fallback candidates based on type matching only

---

### Edge Cases

- What happens when a class has both explicit constructor parameters with `@Autowired` and Lombok's `@RequiredArgsConstructor`?
  - System should detect both injection patterns and show CodeLens for both
- What happens when a `@NonNull` field is not a valid Spring bean type (e.g., primitive, String, List without generic)?
  - System should attempt bean resolution but only show CodeLens if matching beans are found
- How does the system handle inheritance where superclass fields are marked `@NonNull`?
  - System should detect `@NonNull` fields from superclasses when `@RequiredArgsConstructor` is present
- What happens when Lombok annotations use static imports or fully qualified names?
  - System should recognize both `lombok.NonNull` and `@NonNull` with appropriate imports
- What happens when `onConstructor` syntax is malformed or uses deprecated variants?
  - System should use best-effort parsing and recognize common patterns (`onConstructor=@__()`, `onConstructor_=`, `onConstructor__`)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect `@RequiredArgsConstructor` annotation with `onConstructor` parameter containing `@Autowired` on class declarations
- **FR-002**: System MUST detect `@AllArgsConstructor` annotation with `onConstructor` parameter containing `@Autowired` on class declarations
- **FR-003**: System MUST identify fields annotated with `@NonNull` within classes that have Lombok constructor injection annotations
- **FR-004**: System MUST treat `@NonNull` fields in `@RequiredArgsConstructor` classes as Spring bean injection points equivalent to `@Autowired` field injections
- **FR-005**: System MUST display CodeLens on the line of `@NonNull` fields that are injection points, with text "→ go to bean definition"
- **FR-006**: System MUST support `@Qualifier` annotations on `@NonNull` fields to prioritize qualified bean matches
- **FR-007**: System MUST resolve `@NonNull` field types to matching Spring bean definitions using the existing bean resolution logic (type matching, qualifier matching, @Primary support)
- **FR-008**: System MUST support multiple `onConstructor` syntax variants: `onConstructor=@__({@Autowired})`, `onConstructor_={@Autowired}`, `onConstructor__={@Autowired}`
- **FR-009**: System MUST distinguish between `@RequiredArgsConstructor` (only `@NonNull` and `final` fields) and `@AllArgsConstructor` (all fields)
- **FR-010**: System MUST integrate Lombok injection point detection into the existing `BeanMetadataExtractor` and `AnnotationScanner` architecture
- **FR-011**: When user clicks CodeLens on a Lombok-injected field, system MUST navigate to bean definition using the existing `navigateToBean` command
- **FR-012**: System MUST handle cases where `@NonNull` is imported from `lombok.NonNull` or used as fully qualified name
- **FR-013**: System MUST NOT show CodeLens for `@NonNull` fields when the class lacks `onConstructor` parameter with `@Autowired`

### UX Requirements (per Constitution Principle III)

- CodeLens for Lombok-injected fields MUST have identical appearance to existing `@Autowired` field CodeLens
- Navigation behavior from Lombok fields MUST be identical to navigation from explicit `@Autowired` fields
- When multiple bean candidates exist, QuickPick menu MUST show same format as existing bean navigation
- Error messages (e.g., if Lombok annotations are malformed) MUST be actionable
- Lombok injection point detection MUST NOT introduce noticeable performance degradation (< 100ms additional processing per file)

### Key Entities *(include if feature involves data)*

- **LombokConstructorAnnotation**: Represents detected Lombok constructor annotations
  - Attributes: annotation type (@RequiredArgsConstructor/@AllArgsConstructor), onConstructor syntax variant, presence of @Autowired in onConstructor
  - Relationships: associated with ClassDeclaration

- **LombokFieldInjectionPoint**: Extends existing BeanInjectionPoint model
  - Attributes: field name, field type, @NonNull annotation location, optional @Qualifier value
  - Relationships: belongs to class with LombokConstructorAnnotation, resolves to BeanDefinition candidates
  - Distinction: marked as "lombok-generated" injection type vs "explicit-field" or "constructor-param"

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can navigate from `@NonNull` fields to Spring bean definitions in under 2 seconds (including CodeLens click and editor navigation)
- **SC-002**: CodeLens appears on `@NonNull` fields within 500ms of opening a file containing Lombok constructor injection annotations
- **SC-003**: System correctly resolves Lombok-injected fields to bean definitions with same accuracy as explicit `@Autowired` fields (measured by match score algorithm)
- **SC-004**: Lombok annotation detection adds less than 10% overhead to existing file indexing time
- **SC-005**: All three Lombok constructor annotation variants (`onConstructor=@__`, `onConstructor_=`, `onConstructor__=`) are correctly recognized in test suite
- **SC-006**: Navigation from Lombok fields works identically to navigation from explicit `@Autowired` fields, providing consistent user experience
