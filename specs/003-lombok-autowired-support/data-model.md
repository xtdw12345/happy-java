# Data Model: Lombok Annotation Support for Constructor Injection

**Feature**: 003-lombok-autowired-support
**Date**: 2025-12-22
**Status**: Complete

## Overview

This document defines the data model extensions and new types required to support Lombok constructor injection in the Spring bean navigation plugin. The design extends existing models minimally while adding Lombok-specific types for internal processing.

## Model Extensions

### 1. BeanInjectionPoint (Modified)

**File**: `src/spring-bean-navigation/models/BeanInjectionPoint.ts`

**Current Structure**:
```typescript
export interface BeanInjectionPoint {
  /** Field or parameter name */
  name: string;

  /** Injection type (fully qualified class name) */
  type: string;

  /** Location in source code */
  location: BeanLocation;

  /** Optional qualifier from @Qualifier annotation */
  qualifier?: string;

  /** Optional resource name from @Resource annotation */
  resourceName?: string;
}
```

**Extended Structure**:
```typescript
export interface BeanInjectionPoint {
  /** Field or parameter name */
  name: string;

  /** Injection type (fully qualified class name) */
  type: string;

  /** Location in source code */
  location: BeanLocation;

  /** Optional qualifier from @Qualifier annotation */
  qualifier?: string;

  /** Optional resource name from @Resource annotation */
  resourceName?: string;

  /** Source of injection point (NEW) */
  injectionType: InjectionType;
}
```

**New Enum**:
```typescript
/**
 * Type of injection point source
 */
export enum InjectionType {
  /** Explicit @Autowired/@Inject/@Resource on field */
  EXPLICIT_FIELD = 'explicit-field',

  /** @Autowired on constructor parameter */
  CONSTRUCTOR_PARAM = 'constructor-param',

  /** Lombok-generated constructor with @Autowired (NEW) */
  LOMBOK_CONSTRUCTOR = 'lombok-constructor'
}
```

**Rationale**:
- `injectionType` distinguishes Lombok-generated injections from explicit annotations
- Enables filtering, debugging, and potential future feature toggles
- Backward compatible: existing code can continue using objects without this property (with TypeScript optional chaining)

**Impact**:
- `BeanMetadataExtractor`: Set `injectionType` when creating injection points
- `BeanIndex`: No changes (stores injection points as-is)
- `CodeLensProvider`: No changes (treats all injection types identically)
- `BeanResolver`: No changes (resolves all injection types identically)

---

### 2. Lombok-Specific Types (New)

**File**: `src/spring-bean-navigation/models/types.ts`

#### LombokConstructorAnnotation

```typescript
/**
 * Detected Lombok constructor annotation with dependency injection
 */
export interface LombokConstructorAnnotation {
  /** Type of Lombok constructor */
  type: LombokConstructorType;

  /** Whether onConstructor contains @Autowired */
  hasAutowired: boolean;

  /** OnConstructor syntax variant detected */
  syntaxVariant: OnConstructorSyntax;

  /** Location of the annotation */
  location: BeanLocation;
}
```

**Purpose**: Represents a detected Lombok constructor annotation that generates dependency injection. Created by `LombokAnnotationDetector`, consumed by `LombokInjectionExtractor`.

**Lifecycle**: Created during CST traversal, used immediately to determine field filtering rules, discarded after injection points extracted.

#### LombokConstructorType

```typescript
/**
 * Type of Lombok constructor annotation
 */
export enum LombokConstructorType {
  /** @RequiredArgsConstructor - includes @NonNull and final fields */
  REQUIRED_ARGS = 'required-args',

  /** @AllArgsConstructor - includes all fields */
  ALL_ARGS = 'all-args'
}
```

**Purpose**: Determines field filtering logic. `REQUIRED_ARGS` requires checking field modifiers; `ALL_ARGS` includes all fields unconditionally.

#### OnConstructorSyntax

```typescript
/**
 * OnConstructor parameter syntax variant
 */
export enum OnConstructorSyntax {
  /** Java 7 style: onConstructor=@__({@Autowired}) */
  JAVA7 = 'java7',

  /** Java 8+ style: onConstructor_={@Autowired} */
  JAVA8_UNDERSCORE = 'java8-underscore',

  /** Java 8+ style: onConstructor__={@Autowired} */
  JAVA8_DOUBLE_UNDERSCORE = 'java8-double-underscore'
}
```

**Purpose**: Track which syntax variant was detected. Useful for debugging and logging. Not used in business logic (all variants treated identically).

#### LombokFieldInfo

```typescript
/**
 * Field information extracted from CST for Lombok processing
 */
export interface LombokFieldInfo {
  /** Field name */
  name: string;

  /** Field type (fully qualified if possible, simple name otherwise) */
  type: string;

  /** Location in source code */
  location: BeanLocation;

  /** Whether field has @NonNull annotation */
  hasNonNull: boolean;

  /** Whether field is final */
  isFinal: boolean;

  /** Optional @Qualifier value */
  qualifier?: string;

  /** Field annotations (for future extensibility) */
  annotations: string[];
}
```

**Purpose**: Intermediate representation of field data during Lombok injection extraction. Created by field scanning logic, filtered based on Lombok constructor type, converted to `BeanInjectionPoint` objects.

**Lifecycle**: Short-lived - created during field extraction, filtered, converted to injection points, then discarded.

---

## Entity Relationships

```
LombokAnnotationDetector
  ├─> Scans class annotations
  ├─> Detects @RequiredArgsConstructor / @AllArgsConstructor
  ├─> Extracts onConstructor parameter
  └─> Returns: LombokConstructorAnnotation | null

LombokInjectionExtractor
  ├─> Receives: LombokConstructorAnnotation
  ├─> Scans class fields
  ├─> Creates: LombokFieldInfo[] (all fields)
  ├─> Filters based on: LombokConstructorType
  │   ├─> REQUIRED_ARGS: Only fields with hasNonNull=true OR isFinal=true
  │   └─> ALL_ARGS: All fields unconditionally
  ├─> Converts to: BeanInjectionPoint[]
  │   └─> Sets: injectionType = LOMBOK_CONSTRUCTOR
  └─> Returns: BeanInjectionPoint[]

BeanMetadataExtractor.extractInjectionPoints()
  ├─> Extracts explicit field injections (@Autowired, etc.)
  ├─> Extracts constructor parameter injections
  ├─> Calls: LombokAnnotationDetector.detect()
  ├─> If Lombok annotation found:
  │   └─> Calls: LombokInjectionExtractor.extract()
  └─> Merges all injection points into single array

BeanIndex
  ├─> Stores: BeanInjectionPoint[] (including Lombok)
  └─> Used by: CodeLensProvider, DefinitionProvider

CodeLensProvider
  ├─> Queries: BeanIndex.getInjectionPoints(file)
  ├─> For each injection point (including Lombok):
  │   ├─> Queries: BeanIndex.findCandidates(injection)
  │   └─> Creates: CodeLens with navigation command
  └─> No special handling for injectionType
```

---

## Data Flow Example

**Scenario**: User opens a file with Lombok constructor injection

```java
@RestController
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class UserController {
    @NonNull
    private final UserService userService;

    @NonNull
    @Qualifier("userRepository")
    private final UserRepository userRepository;
}
```

**Data Flow**:

1. **File Indexing Triggered**
   ```
   BeanIndexer.indexFile(uri)
     ├─> BeanMetadataExtractor.extractFromFile(uri)
     │   ├─> JavaParser.getCST(uri) → CST
     │   └─> Returns: BeanMetadata
     └─> BeanIndex.addBeans() / addInjections()
   ```

2. **Lombok Annotation Detection**
   ```
   LombokAnnotationDetector.detect(classAnnotations)
     ├─> Find: @RequiredArgsConstructor
     ├─> Extract: onConstructor=@__({@Autowired})
     ├─> Parse: Syntax variant = JAVA7
     ├─> Validate: Contains @Autowired = true
     └─> Return: LombokConstructorAnnotation {
           type: REQUIRED_ARGS,
           hasAutowired: true,
           syntaxVariant: JAVA7,
           location: { line: 2, ... }
         }
   ```

3. **Field Information Extraction**
   ```
   LombokInjectionExtractor.extractFieldInfo(cst)
     ├─> Scan all fields in class body
     ├─> Extract: [
     │     {
     │       name: "userService",
     │       type: "UserService",
     │       hasNonNull: true,
     │       isFinal: true,
     │       qualifier: undefined,
     │       location: { line: 4, ... }
     │     },
     │     {
     │       name: "userRepository",
     │       type: "UserRepository",
     │       hasNonNull: true,
     │       isFinal: true,
     │       qualifier: "userRepository",
     │       location: { line: 7, ... }
     │     }
     │   ]
     └─> Return: LombokFieldInfo[]
   ```

4. **Field Filtering (REQUIRED_ARGS logic)**
   ```
   LombokInjectionExtractor.filterFields(fields, REQUIRED_ARGS)
     ├─> Check each field: hasNonNull OR isFinal
     ├─> userService: hasNonNull=true → INCLUDE
     ├─> userRepository: hasNonNull=true → INCLUDE
     └─> Return: Both fields (all passed filter)
   ```

5. **Convert to BeanInjectionPoint**
   ```
   LombokInjectionExtractor.convertToInjectionPoints(filteredFields)
     ├─> Map each LombokFieldInfo to BeanInjectionPoint
     └─> Return: [
           {
             name: "userService",
             type: "UserService",
             location: { line: 4, ... },
             qualifier: undefined,
             injectionType: LOMBOK_CONSTRUCTOR
           },
           {
             name: "userRepository",
             type: "UserRepository",
             location: { line: 7, ... },
             qualifier: "userRepository",
             injectionType: LOMBOK_CONSTRUCTOR
           }
         ]
   ```

6. **Store in BeanIndex**
   ```
   BeanIndex.addInjections(file, injectionPoints)
     ├─> Store: Map<file, BeanInjectionPoint[]>
     └─> Index by: file path
   ```

7. **CodeLens Display**
   ```
   CodeLensProvider.provideCodeLenses(document)
     ├─> Query: BeanIndex.getInjectionPoints(document.uri)
     ├─> For userService injection:
     │   ├─> Query: BeanIndex.findCandidates({ type: "UserService" })
     │   ├─> Found: 1 candidate (UserServiceImpl)
     │   └─> Create: CodeLens at line 4 with "→ go to bean definition"
     ├─> For userRepository injection:
     │   ├─> Query: BeanIndex.findCandidates({ type: "UserRepository", qualifier: "userRepository" })
     │   ├─> Found: 1 candidate (UserRepositoryImpl with matching qualifier)
     │   └─> Create: CodeLens at line 7 with "→ go to bean definition"
     └─> Return: CodeLens[]
   ```

---

## Validation Rules

### LombokConstructorAnnotation Validation

```typescript
function isValid(annotation: LombokConstructorAnnotation): boolean {
  // Must have Autowired in onConstructor
  if (!annotation.hasAutowired) {
    return false;
  }

  // Must be valid constructor type
  if (![LombokConstructorType.REQUIRED_ARGS, LombokConstructorType.ALL_ARGS].includes(annotation.type)) {
    return false;
  }

  return true;
}
```

### LombokFieldInfo Validation

```typescript
function isValidForInjection(field: LombokFieldInfo, constructorType: LombokConstructorType): boolean {
  // For REQUIRED_ARGS: Must have @NonNull OR be final
  if (constructorType === LombokConstructorType.REQUIRED_ARGS) {
    return field.hasNonNull || field.isFinal;
  }

  // For ALL_ARGS: All fields are valid
  if (constructorType === LombokConstructorType.ALL_ARGS) {
    return true;
  }

  return false;
}
```

### BeanInjectionPoint Validation (Extended)

```typescript
function isValid(injection: BeanInjectionPoint): boolean {
  // Existing validation
  if (!injection.name || !injection.type || !injection.location) {
    return false;
  }

  // New: Validate injectionType enum
  const validTypes = [InjectionType.EXPLICIT_FIELD, InjectionType.CONSTRUCTOR_PARAM, InjectionType.LOMBOK_CONSTRUCTOR];
  if (!validTypes.includes(injection.injectionType)) {
    return false;
  }

  return true;
}
```

---

## Migration Strategy

### Backward Compatibility

**Existing BeanInjectionPoint objects** (created before this feature):
- Will lack `injectionType` property
- TypeScript: Make `injectionType` optional initially
- Runtime: Treat missing `injectionType` as `EXPLICIT_FIELD` (default)
- Migration script: Not needed (extension state is in-memory only, resets on reload)

**Code that creates BeanInjectionPoint**:
- Must set `injectionType` explicitly
- Compile-time enforcement: Make `injectionType` required after initial development
- Tests: Verify all injection points have valid `injectionType`

### Testing Strategy

1. **Unit tests**: Verify model serialization/deserialization
2. **Integration tests**: Verify injection points persist correctly in BeanIndex
3. **E2E tests**: Verify CodeLens works for all injection types

---

## Performance Considerations

### Memory Impact

**Additional Memory per Lombok Field**:
- `injectionType`: 4 bytes (enum)
- `LombokFieldInfo` (temporary): ~100 bytes per field during extraction
- `LombokConstructorAnnotation` (temporary): ~50 bytes per class during extraction

**Estimated Total**: <1KB per class with Lombok (temporary during indexing)

**Impact**: Negligible - existing `BeanInjectionPoint` objects are ~200 bytes each

### Processing Impact

**Lombok Detection**: +30-50ms per file with Lombok annotations
**Field Filtering**: +5-10ms per field for `REQUIRED_ARGS` logic
**Total**: <100ms per file (within target)

---

## Future Extensibility

### Potential Future Lombok Annotations

This data model can be extended to support:
- `@Setter(onMethod_={@Autowired})` - setter injection
- `@Builder` with dependency injection
- Custom Lombok annotations via configuration

**Extension Points**:
- Add new `LombokConstructorType` enum values
- Add new properties to `LombokConstructorAnnotation`
- Extend `LombokFieldInfo` with additional metadata

**Backward Compatibility**: Use optional properties and enum extensions to avoid breaking changes

---

## Summary

**Modified Entities**: 1 (`BeanInjectionPoint` - added `injectionType` enum)
**New Entities**: 5 (`LombokConstructorAnnotation`, `LombokConstructorType`, `OnConstructorSyntax`, `LombokFieldInfo`, `InjectionType`)
**Breaking Changes**: None (all modifications are additive)
**Memory Impact**: Negligible (<1KB per Lombok class)
**Performance Impact**: Minimal (<100ms per file)

**Data Model Status**: ✅ Complete - Ready for implementation
