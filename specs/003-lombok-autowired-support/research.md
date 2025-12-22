# Research: Lombok Annotation Support for Constructor Injection

**Feature**: 003-lombok-autowired-support
**Date**: 2025-12-22
**Status**: Complete

## Purpose

This document captures research findings and technical decisions for implementing Lombok annotation support in the Spring bean navigation plugin. The goal is to enable CodeLens navigation from Lombok-generated constructor injection fields to their Spring bean definitions.

## Research Questions

### Q1: How does Lombok's onConstructor parameter work?

**Finding**: Lombok supports three syntax variants for adding annotations to generated constructors:

1. **Java 7 style**: `@RequiredArgsConstructor(onConstructor=@__({@Autowired}))`
   - Uses `@__` as a placeholder that gets replaced with the annotations in curly braces
   - The double underscore is a workaround for Java 7 compatibility

2. **Java 8+ style (underscore before equals)**: `@RequiredArgsConstructor(onConstructor_={@Autowired})`
   - Uses single underscore before equals
   - More concise syntax for Java 8+

3. **Java 8+ style (double underscore)**: `@RequiredArgsConstructor(onConstructor__={@Autowired})`
   - Uses double underscore directly
   - Alternative Java 8+ syntax

**Source**: Lombok documentation, common Spring Boot + Lombok project patterns

**Decision**: Support all three syntax variants using regex pattern matching. Pattern: `onConstructor(_*)=@__\({(.+)}\)|onConstructor(_*)=\{(.+)\}`

**Rationale**: Real-world codebases use all three variants. Partial support would leave gaps in coverage.

**Alternatives Considered**:
- Support only Java 8+ syntax → Rejected: Many legacy projects use Java 7 style
- Support only most common syntax → Rejected: Would frustrate users with different code styles

---

### Q2: How to parse annotation parameters from java-parser CST?

**Finding**: The existing `AnnotationScanner.extractAnnotationParameters()` method extracts annotation parameters from CST by:

1. Navigating to `elementValuePairList` in the annotation CST node
2. Extracting key-value pairs from `elementValuePair` nodes
3. For single-value annotations like `@Service("name")`, extracting from `elementValue` directly

For Lombok's `onConstructor` parameter:
- Parameter name: "onConstructor" or "onConstructor_" or "onConstructor__"
- Parameter value: Expression containing annotation(s), e.g., `@__({@Autowired})`

**Decision**: Extend existing parameter extraction to:
1. Extract raw `onConstructor*` parameter value as string
2. Use regex to detect `@Autowired` within the value
3. Store boolean flag indicating presence of @Autowired (don't parse full nested annotation structure)

**Rationale**: We only need to know if @Autowired is present, not parse its full structure. Simple boolean check is sufficient and more robust than parsing nested annotation syntax.

**Alternatives Considered**:
- Parse full nested annotation structure → Rejected: Overly complex for our needs
- Require exact syntax match → Rejected: Too brittle for syntax variations

---

### Q3: How to distinguish @NonNull fields vs all fields for RequiredArgsConstructor?

**Finding**: Lombok constructor generation rules:

| Annotation | Fields Included |
|------------|----------------|
| `@RequiredArgsConstructor` | Only `final` fields and `@NonNull` fields |
| `@AllArgsConstructor` | All fields (regardless of modifiers) |
| `@NoArgsConstructor` | No fields (not relevant for our feature) |

**Key Insight**: For `@RequiredArgsConstructor`, we must filter fields to match Lombok's actual code generation behavior. Otherwise, CodeLens would appear on fields that aren't actually injected.

**Decision**: Implement field filtering logic in `LombokInjectionExtractor`:
- For `@RequiredArgsConstructor`: Check field modifiers for `final` OR field annotations for `@NonNull`
- For `@AllArgsConstructor`: Include all fields unconditionally

**Rationale**: Matches Lombok's documented behavior precisely, preventing false positives in CodeLens.

**Alternatives Considered**:
- Show CodeLens on all fields → Rejected: Would show CodeLens on non-injected fields, confusing users
- Only check @NonNull, ignore final → Rejected: Would miss valid injection points

---

### Q4: How to integrate Lombok detection into existing architecture?

**Finding**: Current injection point detection flow:

```
BeanMetadataExtractor.extractFromFile()
  ├─> JavaParser.getCST()
  ├─> AnnotationScanner.extractAnnotations()
  ├─> Extract bean definitions (from class annotations)
  ├─> Extract injection points (from field/constructor annotations)
  └─> Return BeanMetadata
```

Existing injection point extraction:
- Scans field declarations for `@Autowired`, `@Resource`, `@Inject`
- Scans constructor parameters for injection annotations
- Creates `BeanInjectionPoint` objects with location and type

**Decision**: Add Lombok extraction as parallel path:
1. In `BeanMetadataExtractor.extractInjectionPoints()`, call new `LombokInjectionExtractor.extract()` method
2. Lombok extractor receives full CST and class annotations
3. Detects Lombok constructor annotations with `onConstructor` containing `@Autowired`
4. Extracts eligible fields based on annotation type
5. Returns array of `BeanInjectionPoint` objects with `injectionType: 'lombok-constructor'`
6. Merge Lombok injection points with existing injection points

**Rationale**: Minimal changes to existing code. Lombok detection is additive and can be toggled independently. Reuses existing `BeanInjectionPoint` model and all downstream infrastructure (CodeLensProvider, BeanResolver).

**Alternatives Considered**:
- Modify existing field extraction to handle Lombok → Rejected: Would complicate existing logic
- Create separate CodeLens provider for Lombok → Rejected: Code duplication, inconsistent UX

---

### Q5: How to extract field type information from CST?

**Finding**: Existing field extraction in `BeanMetadataExtractor` already extracts field types using this CST navigation:

```
classBodyDeclaration
  → classMemberDeclaration
    → fieldDeclaration
      → unannType (type information)
        → classOrInterfaceType
          → Identifier (type name)
```

Type can be:
- Simple name: `UserService`
- Qualified name: `com.example.UserService`
- Generic type: `List<User>` (we extract base type `List`)

**Decision**: Reuse exact same CST navigation logic from existing field extraction code. Create shared utility method if needed: `extractFieldType(fieldDeclarationNode) → string`

**Rationale**: Consistency with existing implementation. Already handles edge cases (generics, arrays, qualified names).

**Alternatives Considered**:
- Re-implement type extraction → Rejected: Code duplication, risk of inconsistency
- Parse type from field declaration string → Rejected: More error-prone than CST traversal

---

### Q6: How to handle @Qualifier on Lombok fields?

**Finding**: `@Qualifier` is already supported on explicit `@Autowired` fields. The existing `BeanInjectionPoint` model has an optional `qualifier?: string` property.

When present, `BeanResolver` prioritizes beans with matching qualifier in the resolution process:
1. Qualifier match: score 100
2. Explicit name match: score 90
3. Type + @Primary: score 80
4. Type match: score 70

**Decision**: Extend Lombok field extraction to:
1. Check field modifiers for `@Qualifier` annotation
2. Extract qualifier value using existing `AnnotationScanner.extractAnnotationParameter()` method
3. Store in `BeanInjectionPoint.qualifier` property
4. Let existing `BeanResolver` handle qualification logic (no changes needed)

**Rationale**: Lombok fields with `@Qualifier` work identically to explicit `@Autowired` fields with `@Qualifier`. Reuse existing qualifier matching logic.

**Alternatives Considered**:
- Skip qualifier support for Lombok fields → Rejected: Common use case, users would report as bug
- Implement separate qualifier matching for Lombok → Rejected: Code duplication

---

### Q7: Performance impact of Lombok detection?

**Finding**: Potential performance bottlenecks:

1. **CST traversal overhead**: Need to traverse class annotations to find Lombok annotations
2. **Field filtering logic**: For `@RequiredArgsConstructor`, need to check each field's modifiers
3. **Regex matching**: Need to match onConstructor parameter value against patterns

**Benchmarks** (estimated based on existing annotation scanning performance):
- Class annotation extraction: ~5ms per file (already done for Spring annotations)
- Lombok annotation detection: +10ms (regex matching onConstructor)
- Field filtering: +20ms per 10 fields (checking modifiers)
- Total estimated overhead: ~30-50ms per file with Lombok annotations

**Decision**:
- Implement Lombok detection as opt-in per file (only run if class has Lombok constructor annotation)
- Cache Lombok annotation detection result at class level
- Use efficient regex patterns (pre-compiled)
- Skip field filtering for `@AllArgsConstructor` (include all fields immediately)

**Target**: <100ms per file (well within target, leaves room for overhead)

**Rationale**: Performance overhead is minimal and only affects files actually using Lombok. Most files in a project don't use Lombok, so average overhead across project is very low.

**Alternatives Considered**:
- Lazy detection (only when CodeLens requested) → Rejected: Would delay CodeLens appearance, worse UX
- Background thread for Lombok detection → Rejected: Adds complexity, not needed for this overhead level

---

### Q8: How to handle import variations (lombok.NonNull vs @NonNull)?

**Finding**: Lombok annotations can be imported in different ways:

1. Direct import: `import lombok.NonNull;` → Usage: `@NonNull`
2. Wildcard import: `import lombok.*;` → Usage: `@NonNull`
3. Fully qualified: No import → Usage: `@lombok.NonNull`

The existing `AnnotationScanner` already handles this for Spring annotations by:
- Extracting simple name from CST: `@NonNull` → `NonNull`
- Storing as `@NonNull` in annotation name
- Mapping to fully qualified name in `getFullyQualifiedName()` method

**Decision**: Add Lombok annotations to the FQN mapping in `AnnotationScanner.getFullyQualifiedName()`:

```typescript
'NonNull': 'lombok.NonNull',
'RequiredArgsConstructor': 'lombok.RequiredArgsConstructor',
'AllArgsConstructor': 'lombok.AllArgsConstructor'
```

Extract annotation names consistently regardless of import style.

**Rationale**: Reuses existing import handling logic. No special cases needed for Lombok.

**Alternatives Considered**:
- Parse import statements to resolve FQN → Rejected: Overly complex, existing approach works
- Require explicit imports → Rejected: Would break for fully qualified usage

---

## Technical Decisions Summary

| Decision | Choice | Key Reason |
|----------|--------|-----------|
| OnConstructor syntax support | All 3 variants | Cover all real-world usage patterns |
| Parameter extraction | Boolean flag for @Autowired presence | Simple, robust, sufficient for needs |
| Field filtering | Match Lombok rules exactly | Prevent false positive CodeLens |
| Integration approach | Parallel extraction path | Minimal changes, additive feature |
| Type extraction | Reuse existing CST navigation | Consistency with current code |
| Qualifier support | Reuse existing logic | Identical behavior to explicit @Autowired |
| Performance optimization | Opt-in per file with caching | Minimize overhead for non-Lombok files |
| Import handling | Extend existing FQN mapping | Consistent with Spring annotation handling |

## Implementation Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| CST structure changes in java-parser | Low | Isolate CST traversal; extensive tests; version pinning |
| Edge cases in annotation parameter parsing | Medium | Comprehensive test coverage for syntax variations |
| Performance regression in large projects | Low | Benchmark testing; opt-in detection; caching |
| False positives in field detection | Medium | Match Lombok rules exactly; thorough testing |

## Assumptions

1. **Lombok version compatibility**: Implementation targets Lombok 1.18.x (most common version). Earlier versions may have different onConstructor syntax.
2. **No Lombok configuration file**: Assumes default Lombok behavior. Custom lombok.config files could change constructor generation rules.
3. **Standard Spring annotations**: Assumes `@Autowired` is from Spring Framework, not custom annotation with same name.
4. **Single Lombok constructor annotation**: Assumes class has at most one of @RequiredArgsConstructor/@AllArgsConstructor/@NoArgsConstructor. Multiple constructor annotations would be invalid Java.
5. **Java-parser CST stability**: Assumes CST structure remains stable across minor versions of java-parser library.

## Next Steps

- **Phase 1**: Create data model extensions and API contracts
- **Phase 2**: Implement with TDD approach (tests first)
- **Phase 3**: E2E testing with real-world Lombok projects

---

**Research Status**: ✅ Complete - All unknowns resolved, ready for implementation
