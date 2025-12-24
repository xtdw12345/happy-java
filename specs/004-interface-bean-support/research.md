# Research: Interface-Based Bean Resolution

**Date**: 2025-12-24
**Feature**: 004-interface-bean-support
**Phase**: 0 - Research & Analysis

## Overview

This document captures technical research findings for implementing interface-based bean resolution in the Happy Java VS Code extension. All technical decisions and implementation patterns documented here resolve the "NEEDS CLARIFICATION" markers from the technical context.

---

## 1. Interface Detection in java-parser CST

### Research Question
How do we detect Java interface declarations and extract their fully qualified names from the java-parser CST?

### Findings

**Decision**: Use `interfaceDeclaration` nodes in the CST, accessed via `typeDeclaration → classOrInterfaceDeclaration → interfaceDeclaration`

**Implementation Pattern**:
```typescript
// CST navigation path:
ordinaryCompilationUnit
  → typeDeclaration[]
    → classOrInterfaceDeclaration
      → interfaceDeclaration
        → normalInterfaceDeclaration
          → typeIdentifier (interface name)
```

**Rationale**:
- java-parser v3.0.1 provides explicit `interfaceDeclaration` nodes separate from class declarations
- Interface names available via `typeIdentifier` child node (same as class names)
- Package resolution already implemented in `beanMetadataExtractor.ts` (reuse existing `extractPackageName()` and `extractClassName()` methods)

**Code Example** (from existing `annotationScanner.ts` pattern):
```typescript
const typeDeclarations = ordinaryCompilationUnit.children?.typeDeclaration || [];
for (const typeDecl of typeDeclarations) {
  const interfaceDecl = typeDecl.children?.classOrInterfaceDeclaration?.[0]
    ?.children?.interfaceDeclaration?.[0];
  if (interfaceDecl) {
    const normalInterfaceDecl = interfaceDecl.children?.normalInterfaceDeclaration?.[0];
    const interfaceName = normalInterfaceDecl.children?.typeIdentifier?.[0]?.children?.Identifier?.[0]?.image;
    // interfaceName now contains the simple name (e.g., "UserRepository")
  }
}
```

**Alternatives Considered**:
- Regex parsing of source code: Rejected due to fragility with comments, multiline declarations, and nested types
- Full AST analysis: Rejected as CST provides sufficient information without semantic analysis overhead

---

## 2. Implementation Relationship Tracking

### Research Question
How do we extract which interfaces a class implements, including handling multiple interfaces and fully qualified names?

### Findings

**Decision**: Extract `implements` clauses from `classDeclaration → normalClassDeclaration → superInterfaces`

**Implementation Pattern**:
```typescript
// CST navigation for implements clause:
classDeclaration
  → normalClassDeclaration
    → superInterfaces (optional)
      → interfaceTypeList
        → interfaceType[]
          → classType
            → Identifier (interface name)
```

**Extraction Algorithm**:
1. Traverse to `normalClassDeclaration`
2. Check for `superInterfaces` node (null if class implements nothing)
3. Extract all `interfaceType` nodes from `interfaceTypeList`
4. For each interface type, extract the identifier (simple name)
5. Resolve to FQN using:
   - Import statements from the same file (already parsed by existing code)
   - Fallback: Same package as implementing class
   - Fallback: `java.lang.*` for core interfaces

**Rationale**:
- Handles multiple interfaces: `class Foo implements A, B, C`
- Consistent with existing type resolution logic in `beanMetadataExtractor.ts`
- CST structure matches actual Java grammar for interface lists

**Code Example**:
```typescript
function extractImplementedInterfaces(classDecl: any, imports: Map<string, string>): string[] {
  const normalClassDecl = classDecl.children?.normalClassDeclaration?.[0];
  const superInterfaces = normalClassDecl?.children?.superInterfaces?.[0];
  if (!superInterfaces) return [];

  const interfaceTypeList = superInterfaces.children?.interfaceTypeList?.[0];
  const interfaceTypes = interfaceTypeList?.children?.interfaceType || [];

  return interfaceTypes.map(interfaceType => {
    const simpleName = interfaceType.children?.classType?.[0]
      ?.children?.Identifier?.[0]?.image;
    return resolveFQN(simpleName, imports); // Reuse existing FQN resolution
  });
}
```

**Special Cases Handled**:
- Generic interfaces: `class Repo implements Repository<User>` → Extract raw type `Repository`, discard `<User>`
- Qualified names in implements: `class Foo implements com.example.Bar` → Already FQN, no resolution needed
- Abstract classes: Same CST structure, detect via `Abstract` modifier on class

---

## 3. Type Matching Algorithm

### Research Question
How do we match interface types to bean types, handling fully qualified names, simple names, and generic type erasure?

### Findings

**Decision**: Implement a three-tier matching strategy with FQN normalization

**Matching Algorithm** (precedence order):
1. **Exact FQN Match**: `com.example.UserRepository` == `com.example.UserRepository`
2. **Simple Name Match**: If FQNs unavailable, match `UserRepository` == `UserRepository` (warn about potential ambiguity)
3. **Generic Type Erasure**: Extract raw type before matching: `Repository<User>` → `Repository`

**Normalization Rules**:
```typescript
function normalizeFQN(type: string): string {
  // 1. Remove generic type parameters: Repository<User> → Repository
  const rawType = type.replace(/<.*>/, '');

  // 2. Trim whitespace
  return rawType.trim();
}

function matchesInterface(beanType: string, interfaceType: string): boolean {
  const normalizedBean = normalizeFQN(beanType);
  const normalizedInterface = normalizeFQN(interfaceType);

  // Try FQN match first
  if (normalizedBean === normalizedInterface) return true;

  // Fallback: Simple name match (extract last component after final dot)
  const beanSimpleName = normalizedBean.split('.').pop();
  const interfaceSimpleName = normalizedInterface.split('.').pop();
  return beanSimpleName === interfaceSimpleName;
}
```

**Rationale**:
- FQN match prevents false positives when multiple packages have same-named interfaces
- Simple name fallback handles cases where FQN resolution failed (rare, but defensive)
- Generic erasure matches Spring runtime behavior (Spring ignores type parameters for bean resolution)

**Performance Optimization**:
- Normalize types once during indexing (not on every lookup)
- Store normalized types in `InterfaceDefinition` and `BeanDefinition` for O(1) comparison
- Use `Map<string, Set<BeanDefinition>>` for interface→implementations (O(1) lookup)

**Alternatives Considered**:
- Fuzzy matching: Rejected as too error-prone (could match unrelated types)
- Full semantic type checking: Rejected as requires Java compiler integration (massive complexity)

---

## 4. Disambiguation Strategies

### Research Question
When multiple implementations exist for an interface, how do we select the correct one? How do we integrate with Spring's @Primary and @Qualifier behavior?

### Findings

**Decision**: Implement a cascading resolution strategy matching Spring's precedence rules

**Resolution Precedence** (try in order, stop at first match):

1. **Qualifier Match** (highest priority):
   - If injection point has `@Qualifier("name")`, match beans with same qualifier
   - Match by bean name if no explicit qualifier on bean (Spring default behavior)
   - Return single match or error if multiple/no matches

2. **Primary Bean** (medium priority):
   - If exactly one implementation has `@Primary`, return it
   - If multiple @Primary beans exist → error (misconfiguration)
   - If no @Primary and no qualifier → proceed to step 3

3. **Single Implementation** (auto-selection):
   - If exactly one implementation exists, return it (no ambiguity)
   - This covers 80% of cases (most interfaces have one impl)

4. **User Selection** (fallback):
   - If multiple implementations and no clear winner → show VS Code quick-pick menu
   - Display: `[BeanName] - com.example.BeanClass (/path/to/file.java:42)`
   - Remember user selection in workspace state for this injection point (optional enhancement, P4)

**Implementation Pattern**:
```typescript
interface DisambiguationContext {
  interfaceType: string;
  qualifier?: string;
  candidateImplementations: BeanDefinition[];
}

function resolveInterfaceImplementation(context: DisambiguationContext): BeanDefinition | BeanDefinition[] {
  const { interfaceType, qualifier, candidateImplementations } = context;

  // Step 1: Qualifier match
  if (qualifier) {
    const qualifiedBeans = candidateImplementations.filter(bean =>
      bean.qualifier === qualifier || bean.name === qualifier
    );
    if (qualifiedBeans.length === 1) return qualifiedBeans[0];
    if (qualifiedBeans.length === 0) throw new Error(`No bean with qualifier "${qualifier}"`);
    if (qualifiedBeans.length > 1) throw new Error(`Multiple beans with qualifier "${qualifier}"`);
  }

  // Step 2: Primary bean
  const primaryBeans = candidateImplementations.filter(bean => bean.isPrimary);
  if (primaryBeans.length === 1) return primaryBeans[0];
  if (primaryBeans.length > 1) throw new Error(`Multiple @Primary beans for ${interfaceType}`);

  // Step 3: Single implementation
  if (candidateImplementations.length === 1) return candidateImplementations[0];

  // Step 4: User selection (return all candidates for CodeLens to show quick-pick)
  return candidateImplementations;
}
```

**Rationale**:
- Matches Spring's actual runtime behavior (developers expect consistency)
- Qualifier takes precedence (explicit intent)
- @Primary is Spring's standard disambiguation mechanism
- Fallback to user selection prevents blocking navigation entirely

**Existing Code Reuse**:
- `@Primary` detection already implemented in `beanMetadataExtractor.ts` (see `isPrimary` field in BeanDefinition)
- `@Qualifier` extraction already implemented (see `qualifier` field in BeanInjectionPoint from Lombok feature #003)
- Can directly reuse these fields without modifications

**UX for Multi-Selection**:
```typescript
// In codeLensProvider.ts
if (Array.isArray(resolvedBeans)) {
  // Multiple candidates - show quick pick
  const codeLens = new vscode.CodeLens(range, {
    title: `Multiple implementations found (${resolvedBeans.length})`,
    command: 'happy-java.selectImplementation',
    arguments: [resolvedBeans]
  });
}
```

---

## 5. Performance Optimization

### Research Question
How do we efficiently index and query interface→implementation relationships for large codebases without degrading IDE performance?

### Findings

**Decision**: Use bidirectional Map-based index with lazy initialization and incremental updates

**Data Structure**:
```typescript
class InterfaceRegistry {
  // Interface FQN → Set of implementing bean names
  private interfaceToImpls = new Map<string, Set<string>>();

  // Bean name → Set of interface FQNs it implements
  private beanToInterfaces = new Map<string, Set<string>>();

  // Interface FQN → InterfaceDefinition
  private interfaces = new Map<string, InterfaceDefinition>();
}
```

**Performance Characteristics**:
- Registration: O(I) where I = number of interfaces implemented by one bean (typically 1-3)
- Lookup: O(1) to get all implementations for an interface
- Memory: ~100 bytes per interface-implementation relationship (10KB for 100 relationships)
- Indexing: Parallelizable across files (already done by existing BeanIndexer)

**Optimization Strategies**:

1. **Incremental Indexing**:
   - Only re-index modified files (already implemented in BeanIndexer)
   - When file changes:
     - Remove old interface/implementation records for that file
     - Re-extract and add new records
   - Preserves O(1) lookup performance even with frequent changes

2. **Lazy Interface Resolution**:
   - Don't resolve all interfaces during initial workspace scan
   - Only resolve interfaces when CodeLens provider requests them
   - Cache resolved implementations in `InterfaceDefinition` object

3. **Async Indexing with Progress**:
   ```typescript
   async function indexInterfaces(files: vscode.Uri[]): Promise<void> {
     await vscode.window.withProgress({
       location: vscode.ProgressLocation.Notification,
       title: "Indexing interface implementations...",
       cancellable: false
     }, async (progress) => {
       for (let i = 0; i < files.length; i++) {
         await indexFile(files[i]);
         progress.report({ increment: 100 / files.length });
       }
     });
   }
   ```

**Benchmark Targets** (from plan.md):
- 500 Java files with 50 interfaces and 200 beans
- Indexing: <5 seconds total (10ms per file average)
- Lookup: <1ms per interface (O(1) hash map lookup)
- Memory: <10MB for entire registry (within 50MB extension budget)

**Testing Strategy**:
- Unit tests: Measure indexing time for synthetic 500-file project
- Integration tests: Verify incremental updates don't re-index entire workspace
- Memory profiling: Use Chrome DevTools to monitor heap usage during indexing

**Rationale**:
- Map-based index is industry standard for O(1) lookups
- Bidirectional mapping enables both forward (interface→impls) and reverse (bean→interfaces) queries
- Incremental updates prevent full re-indexing on every file change
- Async with progress prevents UI blocking for large workspaces

---

## 6. Abstract Class Handling

### Research Question
Should abstract classes be treated the same as interfaces? How do we detect them?

### Findings

**Decision**: Treat abstract classes identically to interfaces for bean resolution purposes

**Detection Pattern**:
```typescript
// Check for Abstract modifier on class declaration
const modifiers = classDecl.children?.classModifier || [];
const isAbstract = modifiers.some(modifier =>
  modifier.children?.Abstract?.[0] !== undefined
);

if (isAbstract) {
  // Index as interface-like type
  registerInterface(fullyQualifiedName, location);
}
```

**Rationale**:
- Spring treats abstract classes and interfaces identically for injection purposes
- Abstract classes can be injected and require implementation resolution
- Same disambiguation rules apply (@Primary, @Qualifier)
- Minimal code duplication (reuse interface resolution logic)

**Example**:
```java
@Service
public abstract class BaseService { }

@Service
public class ConcreteService extends BaseService { }

// Injection point
@Autowired
private BaseService service; // Should resolve to ConcreteService
```

**Implementation Notes**:
- Store abstract classes in same `InterfaceRegistry`
- Use `InterfaceDefinition` type for both interfaces and abstract classes (add `isAbstract` flag if needed for debugging)
- No separate resolution logic required

---

## 7. @Bean Method Return Type Handling

### Research Question
How do we extract return types from @Bean methods and register them as implementations?

### Findings

**Decision**: Extract method return type from CST and treat @Bean methods as implementations

**CST Navigation**:
```typescript
// Path to method return type:
methodDeclaration
  → methodHeader
    → result
      → unannType
        → classOrInterfaceType
          → classType
            → Identifier (return type name)
```

**Implementation Pattern**:
```typescript
function extractBeanMethodReturnType(methodDecl: any): string | undefined {
  const methodHeader = methodDecl.children?.methodHeader?.[0];
  const result = methodHeader?.children?.result?.[0];
  const unannType = result?.children?.unannType?.[0];
  const classType = unannType?.children?.classOrInterfaceType?.[0]
    ?.children?.classType?.[0];
  const returnTypeName = classType?.children?.Identifier?.[0]?.image;

  return returnTypeName; // e.g., "UserRepository"
}
```

**Registration Logic**:
```typescript
// When indexing @Bean method:
const returnType = extractBeanMethodReturnType(methodDecl);
if (isInterfaceType(returnType)) {
  // Register this @Bean method as an implementation of the interface
  registry.registerImplementation(
    returnType,  // interface FQN
    beanDefinition  // Bean definition from @Bean method
  );
}
```

**Rationale**:
- @Bean methods are valid bean sources (Spring standard practice)
- Return type determines what can be injected (not the method name)
- Existing BeanMetadataExtractor already indexes @Bean methods, just need to extract return type
- Enables navigation to @Bean factory methods (not just @Component classes)

**Example**:
```java
@Configuration
public class DataSourceConfig {
  @Bean
  @Primary
  public DataSource primaryDataSource() {
    return new HikariDataSource();
  }

  @Bean
  @Qualifier("secondary")
  public DataSource secondaryDataSource() {
    return new HikariDataSource();
  }
}

// Injection point
@Autowired
private DataSource dataSource; // Should resolve to primaryDataSource() method
```

**Implementation Note**: @Bean methods already have `isPrimary` and `qualifier` fields in BeanDefinition (reuse existing logic)

---

## Summary of Technical Decisions

| Area | Decision | Rationale |
|------|----------|-----------|
| **Interface Detection** | Use CST `interfaceDeclaration` nodes | Explicit nodes, no regex parsing needed |
| **Implementation Tracking** | Extract `superInterfaces` from class declarations | Matches Java grammar, handles multiple interfaces |
| **Type Matching** | Three-tier: FQN → simple name → generic erasure | Balance precision and robustness |
| **Disambiguation** | Cascading: Qualifier → @Primary → Single → User pick | Matches Spring precedence rules |
| **Performance** | Bidirectional Map index with incremental updates | O(1) lookup, <10MB memory, <5s indexing |
| **Abstract Classes** | Treat same as interfaces | Spring runtime equivalence |
| **@Bean Methods** | Extract return type, register as implementation | Supports factory pattern |

All "NEEDS CLARIFICATION" items from Technical Context are now resolved with concrete implementation patterns. Ready for Phase 1 design.
