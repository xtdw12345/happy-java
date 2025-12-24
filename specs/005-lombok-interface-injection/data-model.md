# Data Model: Lombok Constructor Injection Support

**Feature**: `005-lombok-interface-injection`
**Status**: Documented
**Last Updated**: 2024-12-24

## Overview

This document describes the data models used for Lombok constructor injection support. The Lombok feature extends the existing Spring bean navigation system with specialized types for detecting and extracting injection points from Lombok-generated constructors.

---

## Core Data Models

### LombokConstructorAnnotation

Represents a detected Lombok constructor annotation (@RequiredArgsConstructor or @AllArgsConstructor) with Spring's @Autowired in the onConstructor parameter.

**Location**: `src/spring-bean-navigation/models/types.ts`

**Structure**:
```typescript
interface LombokConstructorAnnotation {
  /** Type of Lombok constructor */
  type: LombokConstructorType;

  /** Whether @Autowired is present in onConstructor parameter */
  hasAutowired: boolean;

  /** Syntax variant used for onConstructor */
  syntaxVariant: OnConstructorSyntax;

  /** Source location of the annotation */
  location: BeanLocation;
}
```

**Related Enums**:
```typescript
enum LombokConstructorType {
  REQUIRED_ARGS = 'REQUIRED_ARGS',  // @RequiredArgsConstructor
  ALL_ARGS = 'ALL_ARGS'              // @AllArgsConstructor
}

enum OnConstructorSyntax {
  JAVA7 = 'JAVA7',                          // onConstructor=@__({@Autowired})
  JAVA8_UNDERSCORE = 'JAVA8_UNDERSCORE',    // onConstructor_={@Autowired}
  JAVA8_DOUBLE_UNDERSCORE = 'JAVA8_DOUBLE_UNDERSCORE'  // onConstructor__={@Autowired}
}
```

**Usage**:
- Detected by `LombokAnnotationDetector.detectConstructorInjection()`
- Passed to `LombokInjectionExtractor.extract()` to identify eligible fields
- Determines which fields are included in generated constructor (all fields vs. @NonNull/final only)

**Field Descriptions**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `LombokConstructorType` | Yes | Identifies whether annotation is @RequiredArgsConstructor or @AllArgsConstructor |
| `hasAutowired` | `boolean` | Yes | Must be `true` for Spring injection - indicates @Autowired in onConstructor |
| `syntaxVariant` | `OnConstructorSyntax` | Yes | Identifies which Java version syntax variant is used |
| `location` | `BeanLocation` | Yes | Source code location for error reporting and navigation |

**Example**:
```typescript
const annotation: LombokConstructorAnnotation = {
  type: LombokConstructorType.REQUIRED_ARGS,
  hasAutowired: true,
  syntaxVariant: OnConstructorSyntax.JAVA7,
  location: {
    uri: vscode.Uri.file('/path/to/Controller.java'),
    line: 15,
    column: 0
  }
};
```

---

### LombokFieldInfo

Represents metadata extracted from a field declaration in a Lombok-annotated class, used to determine injection eligibility.

**Location**: `src/spring-bean-navigation/models/types.ts`

**Structure**:
```typescript
interface LombokFieldInfo {
  /** Field name */
  name: string;

  /** Field type (fully qualified name or simple name) */
  type: string;

  /** Source location */
  location: BeanLocation;

  /** Has @NonNull annotation */
  hasNonNull: boolean;

  /** Has final modifier */
  isFinal: boolean;

  /** @Qualifier value if present */
  qualifier?: string;

  /** All annotations on the field */
  annotations: string[];
}
```

**Usage**:
- Extracted from Java CST by `LombokInjectionExtractor.extractFieldInfo()`
- Filtered by `LombokInjectionExtractor.filterFields()` based on constructor type
- Converted to `BeanInjectionPoint` by `LombokInjectionExtractor.convertToInjectionPoints()`

**Field Descriptions**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Field identifier (e.g., "userService") |
| `type` | `string` | Yes | Bean type to inject (e.g., "UserService" or "com.example.UserService") |
| `location` | `BeanLocation` | Yes | Field declaration location for CodeLens placement |
| `hasNonNull` | `boolean` | Yes | Whether field has @NonNull annotation |
| `isFinal` | `boolean` | Yes | Whether field has final modifier |
| `qualifier` | `string?` | No | Extracted from @Qualifier annotation if present |
| `annotations` | `string[]` | Yes | All field annotations for debugging (e.g., ["@NonNull", "@Qualifier"]) |

**Filtering Rules**:
- **@RequiredArgsConstructor**: Include fields where `hasNonNull === true OR isFinal === true`
- **@AllArgsConstructor**: Include all fields (no filtering)

**Example**:
```typescript
const fieldInfo: LombokFieldInfo = {
  name: 'userService',
  type: 'com.example.service.UserService',
  location: {
    uri: vscode.Uri.file('/path/to/Controller.java'),
    line: 20,
    column: 15
  },
  hasNonNull: true,
  isFinal: true,
  qualifier: undefined,
  annotations: ['@NonNull']
};
```

---

## Integration with Existing Models

### BeanInjectionPoint Extension

Lombok fields are converted to standard `BeanInjectionPoint` objects with a special injection type.

**Extended Structure**:
```typescript
interface BeanInjectionPoint {
  /** Set to LOMBOK_CONSTRUCTOR for Lombok fields */
  injectionType: InjectionType.LOMBOK_CONSTRUCTOR;

  /** Bean type to inject (from LombokFieldInfo.type) */
  beanType: string;

  /** Source location (from LombokFieldInfo.location) */
  location: BeanLocation;

  /** Qualifier value (from LombokFieldInfo.qualifier) */
  qualifier?: string;

  /** Always true for Lombok injections */
  isRequired: true;

  /** Field name (from LombokFieldInfo.name) */
  fieldName: string;
}
```

**Key Mappings**:
- `LombokFieldInfo.type` → `BeanInjectionPoint.beanType`
- `LombokFieldInfo.name` → `BeanInjectionPoint.fieldName`
- `LombokFieldInfo.location` → `BeanInjectionPoint.location`
- `LombokFieldInfo.qualifier` → `BeanInjectionPoint.qualifier`
- `injectionType` is always `InjectionType.LOMBOK_CONSTRUCTOR`
- `isRequired` is always `true` (Lombok constructor parameters are always required)

**Example Conversion**:
```typescript
// Input: LombokFieldInfo
const fieldInfo: LombokFieldInfo = {
  name: 'paymentService',
  type: 'PaymentService',
  location: { uri, line: 25, column: 10 },
  hasNonNull: true,
  isFinal: true,
  qualifier: 'paypal',
  annotations: ['@NonNull', '@Qualifier']
};

// Output: BeanInjectionPoint
const injectionPoint: BeanInjectionPoint = {
  injectionType: InjectionType.LOMBOK_CONSTRUCTOR,
  beanType: 'PaymentService',
  location: { uri, line: 25, column: 10 },
  qualifier: 'paypal',
  isRequired: true,
  fieldName: 'paymentService'
};
```

---

## Data Flow Architecture

```
Java Source File
  ↓
AnnotationScanner.extractAnnotations()
  ↓ (class annotations)
LombokAnnotationDetector.detectConstructorInjection()
  ↓ (returns LombokConstructorAnnotation if @RequiredArgsConstructor/@AllArgsConstructor with @Autowired)
  ↓
LombokInjectionExtractor.extractFieldInfo()
  ↓ (parses field declarations from CST)
  ↓ (returns LombokFieldInfo[])
LombokInjectionExtractor.filterFields()
  ↓ (applies constructor type rules)
  ↓ (returns filtered LombokFieldInfo[])
LombokInjectionExtractor.convertToInjectionPoints()
  ↓ (maps to BeanInjectionPoint)
  ↓ (returns BeanInjectionPoint[] with injectionType=LOMBOK_CONSTRUCTOR)
BeanIndexer.addInjections()
  ↓ (stores in BeanIndex)
CodeLensProvider (after bug fix)
  ↓ (queries BeanIndex for injection points)
  ↓ (creates CodeLens for LOMBOK_CONSTRUCTOR type)
InterfaceResolver (if beanType is interface)
  ↓ (resolves to implementation using @Primary, qualifier, or single candidate)
  ↓ (returns InterfaceResolutionResult)
CodeLens Display
```

---

## Storage and Indexing

### BeanIndex Integration

Lombok injection points are stored in the same `BeanIndex` structure as explicit @Autowired injections:

**Storage Location**: `BeanIndex.injectionsByFile` (Map<string, BeanInjectionPoint[]>)

**Access Methods**:
- `BeanIndex.addInjections(injections: BeanInjectionPoint[])` - Add Lombok injections to index
- `BeanIndex.getAllInjections()` - Retrieve all injections including Lombok
- `BeanIndex.getInjectionPointsForUri(uri: vscode.Uri)` - ⚠️ **To be added in T005** - Get injections for specific file

**Key Characteristics**:
- Lombok injections are treated identically to other injection types
- All stored injection points have `injectionType` field to distinguish source
- CodeLensProvider should query by `InjectionType.LOMBOK_CONSTRUCTOR` after bug fix

---

## Validation and Constraints

### Field Eligibility Rules

| Constructor Type | Eligibility Criteria |
|-----------------|---------------------|
| @RequiredArgsConstructor | Field must have `@NonNull` OR `final` modifier |
| @AllArgsConstructor | All fields are eligible (no filtering) |

### Syntax Variant Support

All three onConstructor syntax variants are supported:

| Variant | Syntax | Java Version | Status |
|---------|--------|--------------|--------|
| Java 7 | `onConstructor=@__({@Autowired})` | Java 7+ | ✅ Supported |
| Java 8 Underscore | `onConstructor_={@Autowired}` | Java 8+ | ✅ Supported |
| Java 8 Double Underscore | `onConstructor__={@Autowired}` | Java 8+ | ✅ Supported |

### Type Matching

The `beanType` field in `BeanInjectionPoint` supports:
- **Simple names**: "UserService"
- **Fully qualified names**: "com.example.UserService"
- **Interface types**: Resolved via `InterfaceResolver` to implementations

---

## Dependencies

### Required Models

- **BeanLocation**: `src/spring-bean-navigation/models/BeanLocation.ts`
- **BeanInjectionPoint**: `src/spring-bean-navigation/models/BeanInjectionPoint.ts`
- **BeanDefinition**: `src/spring-bean-navigation/models/BeanDefinition.ts`
- **InjectionType**: `src/spring-bean-navigation/models/types.ts`

### Required Services

- **AnnotationScanner**: Extracts class-level annotations
- **LombokAnnotationDetector**: Detects Lombok constructor annotations
- **LombokInjectionExtractor**: Extracts field metadata and converts to injection points
- **BeanIndexer**: Stores extracted injection points
- **InterfaceResolver**: Resolves interface-typed fields to implementations

---

## Examples

### Example 1: Basic @RequiredArgsConstructor

**Java Source**:
```java
@Service
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class UserController {
    @NonNull
    private final UserService userService;

    private String description;  // Not injected (no @NonNull, not final)
}
```

**Extracted Models**:
```typescript
// LombokConstructorAnnotation
{
  type: LombokConstructorType.REQUIRED_ARGS,
  hasAutowired: true,
  syntaxVariant: OnConstructorSyntax.JAVA7,
  location: { uri, line: 2, column: 0 }
}

// LombokFieldInfo (filtered)
[{
  name: 'userService',
  type: 'UserService',
  location: { uri, line: 4, column: 15 },
  hasNonNull: true,
  isFinal: true,
  qualifier: undefined,
  annotations: ['@NonNull']
}]
// description field is NOT included (no @NonNull, not final)

// BeanInjectionPoint (converted)
[{
  injectionType: InjectionType.LOMBOK_CONSTRUCTOR,
  beanType: 'UserService',
  location: { uri, line: 4, column: 15 },
  qualifier: undefined,
  isRequired: true,
  fieldName: 'userService'
}]
```

### Example 2: @Qualifier with Interface

**Java Source**:
```java
@Repository
@RequiredArgsConstructor(onConstructor_={@Autowired})
public class PaymentRepository {
    @NonNull
    @Qualifier("paypal")
    private final PaymentService paymentService;
}
```

**Extracted Models**:
```typescript
// LombokConstructorAnnotation
{
  type: LombokConstructorType.REQUIRED_ARGS,
  hasAutowired: true,
  syntaxVariant: OnConstructorSyntax.JAVA8_UNDERSCORE,
  location: { uri, line: 2, column: 0 }
}

// LombokFieldInfo
[{
  name: 'paymentService',
  type: 'PaymentService',  // Interface type
  location: { uri, line: 5, column: 15 },
  hasNonNull: true,
  isFinal: true,
  qualifier: 'paypal',  // Extracted from @Qualifier
  annotations: ['@NonNull', '@Qualifier']
}]

// BeanInjectionPoint
[{
  injectionType: InjectionType.LOMBOK_CONSTRUCTOR,
  beanType: 'PaymentService',  // Will be resolved via InterfaceResolver
  location: { uri, line: 5, column: 15 },
  qualifier: 'paypal',  // Used for disambiguation
  isRequired: true,
  fieldName: 'paymentService'
}]
```

**Resolution Flow**:
1. CodeLensProvider queries BeanIndex for injections
2. Finds injection with `beanType='PaymentService'` and `qualifier='paypal'`
3. Checks InterfaceRegistry: `PaymentService` is an interface
4. InterfaceResolver creates `DisambiguationContext` with qualifier
5. Resolves to bean with qualifier='paypal' (PayPalPaymentService)
6. CodeLens displays: "→ PayPalPaymentService (@Qualifier)"

---

## Testing Data

### Test Fixtures

Fixture files exist in `src/test/suite/spring-bean-navigation/fixtures/lombok/`:

| File | Purpose | Key Fields |
|------|---------|------------|
| `RequiredArgsConstructorController.java` | Basic @RequiredArgsConstructor | @NonNull UserService |
| `AllArgsConstructorService.java` | @AllArgsConstructor testing | All fields |
| `Java8SyntaxController.java` | Java 8 syntax variant | onConstructor_ |
| `LombokWithQualifierRepository.java` | @Qualifier support | @Qualifier fields |
| `UserService.java` | Bean implementation | @Service |

### Unit Test Coverage

- **LombokAnnotationDetector**: 8 tests (detection, syntax variants, edge cases)
- **LombokInjectionExtractor**: 13 tests (field extraction, filtering, conversion)
- **Total Lombok Tests**: 21 tests (all passing)

---

## Performance Considerations

### Memory Usage

Each Lombok injection point consumes approximately:
- LombokFieldInfo: ~200 bytes (temporary, during extraction)
- BeanInjectionPoint: ~300 bytes (stored in BeanIndex)

For a typical file with 10 Lombok fields: ~3KB memory overhead

### Parsing Performance

- Lombok annotation detection: <5ms per class
- Field extraction from CST: <20ms per class
- Total overhead per file: <50ms (well under 100ms requirement)

---

## Future Considerations

### Potential Enhancements

1. **Generic Type Support**: Currently handles generics simply (e.g., `List<String>` → `List`)
   - Future: Extract generic parameters for more precise matching

2. **Builder Support**: Consider supporting `@Builder` with `@Singular` for collection injection
   - Rare use case, low priority

3. **Delombok Output**: Handle pre-processed Lombok code if delombok is used
   - Detect expanded constructors and skip Lombok extraction

4. **Custom Lombok Config**: Support lombok.config file for custom annotation retention
   - Currently assumes standard Lombok configuration

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-12-24 | Initial documentation of existing Lombok data models |

---

## References

- **Lombok Documentation**: https://projectlombok.org/features/constructor
- **Spring @Autowired**: https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/beans/factory/annotation/Autowired.html
- **Feature Specification**: `specs/005-lombok-interface-injection/spec.md`
- **Implementation Plan**: `specs/005-lombok-interface-injection/plan.md`
- **Research Findings**: `specs/005-lombok-interface-injection/research.md`
