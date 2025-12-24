# API Contracts: Interface Resolution

**Date**: 2025-12-24
**Feature**: 004-interface-bean-support
**Phase**: 1 - Design

## Overview

This document defines the public APIs for interface-based bean resolution. All APIs follow TypeScript strict mode and include comprehensive JSDoc documentation.

---

## InterfaceRegistry API

Central registry for managing interface→implementation relationships.

### Constructor

```typescript
/**
 * Create a new interface registry
 *
 * @example
 * const registry = new InterfaceRegistry();
 */
constructor()
```

---

### registerInterface

Register a discovered interface or abstract class.

```typescript
/**
 * Register an interface in the registry
 *
 * @param interfaceDefinition - The interface to register
 * @throws Error if interface with same FQN already exists
 *
 * @example
 * registry.registerInterface({
 *   fullyQualifiedName: "com.example.UserRepository",
 *   simpleName: "UserRepository",
 *   packageName: "com.example",
 *   location: { uri, line: 5, column: 0 },
 *   isAbstract: false,
 *   rawType: "UserRepository"
 * });
 */
registerInterface(interfaceDefinition: InterfaceDefinition): void
```

**Preconditions**:
- `interfaceDefinition.fullyQualifiedName` must be unique
- `interfaceDefinition.location.uri` must point to valid file

**Postconditions**:
- Interface added to `interfaces` map
- Available for implementation registration

**Side Effects**:
- Logs registration at DEBUG level

---

### registerImplementation

Register a bean as an implementation of an interface.

```typescript
/**
 * Register a bean as implementing an interface
 *
 * @param interfaceFQN - Fully qualified name of the interface
 * @param beanDefinition - Bean that implements the interface
 * @param detectionMethod - How the relationship was detected
 * @throws Error if interface not found in registry
 * @throws Error if bean already registered for this interface
 *
 * @example
 * registry.registerImplementation(
 *   "com.example.UserRepository",
 *   userRepositoryBean,
 *   "implements_clause"
 * );
 */
registerImplementation(
  interfaceFQN: string,
  beanDefinition: BeanDefinition,
  detectionMethod: "implements_clause" | "bean_return_type" | "extends_abstract"
): void
```

**Preconditions**:
- Interface must exist in registry (call `registerInterface` first)
- Bean must not already be registered for this interface

**Postconditions**:
- Bean added to `interfaceToImpls` set for interface
- Interface added to `beanToInterfaces` set for bean
- `ImplementationRelationship` created and stored
- `beanDefinition.implementedInterfaces` updated

**Side Effects**:
- Logs registration at DEBUG level
- Updates bidirectional indices

---

### getImplementations

Retrieve all beans implementing a specific interface.

```typescript
/**
 * Get all beans that implement the specified interface
 *
 * @param interfaceFQN - Fully qualified name of the interface
 * @returns Array of bean definitions implementing the interface (empty if none)
 *
 * @example
 * const impls = registry.getImplementations("com.example.UserRepository");
 * if (impls.length === 0) {
 *   console.log("No implementations found");
 * } else {
 *   console.log(`Found ${impls.length} implementations`);
 * }
 */
getImplementations(interfaceFQN: string): BeanDefinition[]
```

**Preconditions**: None (returns empty array if interface not found)

**Postconditions**: None (read-only operation)

**Performance**: O(1) lookup in `interfaceToImpls` map

---

### getInterface

Retrieve interface definition by FQN.

```typescript
/**
 * Get interface definition by fully qualified name
 *
 * @param interfaceFQN - Fully qualified name of the interface
 * @returns Interface definition or undefined if not found
 *
 * @example
 * const interfaceDef = registry.getInterface("com.example.UserRepository");
 * if (interfaceDef) {
 *   console.log(`Interface location: ${interfaceDef.location.uri}`);
 * }
 */
getInterface(interfaceFQN: string): InterfaceDefinition | undefined
```

**Preconditions**: None

**Postconditions**: None (read-only operation)

**Performance**: O(1) map lookup

---

### removeBean

Remove all implementation relationships for a bean.

```typescript
/**
 * Remove a bean from all interface mappings (called when bean deleted)
 *
 * @param beanName - Name of the bean to remove
 *
 * @example
 * registry.removeBean("userRepositoryImpl");
 */
removeBean(beanName: string): void
```

**Preconditions**: None (safe to call even if bean not in registry)

**Postconditions**:
- Bean removed from all `interfaceToImpls` sets
- Bean removed from `beanToInterfaces` map
- Related `ImplementationRelationship` records removed

**Side Effects**:
- Logs removal at DEBUG level

---

### removeInterface

Remove an interface and all its implementation relationships.

```typescript
/**
 * Remove an interface from the registry (called when interface deleted)
 *
 * @param interfaceFQN - Fully qualified name of the interface to remove
 *
 * @example
 * registry.removeInterface("com.example.UserRepository");
 */
removeInterface(interfaceFQN: string): void
```

**Preconditions**: None (safe to call even if interface not in registry)

**Postconditions**:
- Interface removed from `interfaces` map
- All implementations for this interface removed from `interfaceToImpls`
- Interface FQN removed from all `beanToInterfaces` sets
- Related `ImplementationRelationship` records removed

**Side Effects**:
- Logs removal at DEBUG level

---

### getAllInterfaces

Get all registered interfaces (for debugging/testing).

```typescript
/**
 * Get all registered interfaces
 *
 * @returns Array of all interface definitions
 *
 * @example
 * const all = registry.getAllInterfaces();
 * console.log(`Total interfaces: ${all.length}`);
 */
getAllInterfaces(): InterfaceDefinition[]
```

**Preconditions**: None

**Postconditions**: None (read-only operation)

**Performance**: O(N) where N = number of interfaces

---

## InterfaceResolver API

Resolves interface types to bean implementations using disambiguation logic.

### Constructor

```typescript
/**
 * Create interface resolver
 *
 * @param registry - Interface registry to query
 * @param beanIndexer - Bean indexer for bean lookups
 *
 * @example
 * const resolver = new InterfaceResolver(registry, beanIndexer);
 */
constructor(registry: InterfaceRegistry, beanIndexer: BeanIndexer)
```

---

### resolveInterface

Main resolution method - applies disambiguation logic.

```typescript
/**
 * Resolve an interface to its implementing bean(s)
 *
 * Applies disambiguation in order:
 * 1. Qualifier match (if qualifier provided)
 * 2. @Primary bean (if multiple implementations)
 * 3. Single implementation (auto-select)
 * 4. Multiple implementations (user must select)
 *
 * @param context - Resolution context with interface FQN, qualifier, candidates
 * @returns Resolution result (single bean, multiple candidates, or none)
 *
 * @example
 * const result = resolver.resolveInterface({
 *   interfaceFQN: "com.example.UserRepository",
 *   rawType: "UserRepository",
 *   qualifier: "jpa",
 *   candidates: [...],
 *   injectionLocation: { uri, line: 42, column: 5 }
 * });
 *
 * if (result.status === "qualified") {
 *   console.log(`Resolved to: ${result.bean.name}`);
 * } else if (result.status === "multiple") {
 *   console.log(`${result.candidates.length} candidates - show quick pick`);
 * }
 */
resolveInterface(context: DisambiguationContext): InterfaceResolutionResult
```

**Preconditions**:
- `context.interfaceFQN` must be valid
- `context.candidates` must not be empty for non-"none" results

**Postconditions**:
- Returns exactly one of: single, primary, qualified, multiple, none
- For qualifier match: returns bean with matching qualifier or name
- For primary match: returns bean with `isPrimary === true`
- For single match: returns only candidate
- For multiple: returns all candidates for user selection

**Side Effects**:
- Logs resolution decision at DEBUG level

**Performance**: O(C) where C = number of candidates (typically 1-5)

---

### resolveByQualifier

Resolve using qualifier only (used by resolveInterface).

```typescript
/**
 * Resolve interface using qualifier annotation
 *
 * @param candidates - Candidate beans
 * @param qualifier - Qualifier value from injection point
 * @returns Matching bean or undefined if no/multiple matches
 *
 * @example
 * const bean = resolver.resolveByQualifier(candidates, "jpa");
 */
resolveByQualifier(
  candidates: BeanDefinition[],
  qualifier: string
): BeanDefinition | undefined
```

**Matching Rules**:
1. Match `bean.qualifier === qualifier` (exact match)
2. Fallback: Match `bean.name === qualifier` (Spring default)
3. Return undefined if 0 or >1 matches

---

### resolveByPrimary

Resolve using @Primary annotation (used by resolveInterface).

```typescript
/**
 * Resolve interface using @Primary annotation
 *
 * @param candidates - Candidate beans
 * @returns Primary bean or undefined if no/multiple @Primary beans
 *
 * @example
 * const bean = resolver.resolveByPrimary(candidates);
 */
resolveByPrimary(
  candidates: BeanDefinition[]
): BeanDefinition | undefined
```

**Matching Rules**:
1. Filter `candidates.filter(b => b.isPrimary)`
2. Return undefined if 0 or >1 @Primary beans (misconfiguration)
3. Return the single @Primary bean

---

### createQuickPickItems

Prepare candidate beans for VS Code quick pick UI.

```typescript
/**
 * Create quick pick items for user selection
 *
 * @param candidates - Candidate beans to choose from
 * @returns Array of quick pick items with labels and descriptions
 *
 * @example
 * const items = resolver.createQuickPickItems(candidates);
 * const selected = await vscode.window.showQuickPick(items);
 */
createQuickPickItems(
  candidates: BeanDefinition[]
): vscode.QuickPickItem[]
```

**Item Format**:
- `label`: Bean name (e.g., "userRepositoryImpl")
- `description`: Fully qualified class name (e.g., "com.example.UserRepositoryImpl")
- `detail`: File location (e.g., "/project/src/main/java/com/example/UserRepositoryImpl.java:15")

---

## TypeUtils API

Utility functions for type matching and normalization.

### extractRawType

Extract raw type from generic type string.

```typescript
/**
 * Extract raw type by removing generic parameters
 *
 * @param type - Type string possibly with generics
 * @returns Raw type without generic parameters
 *
 * @example
 * extractRawType("Repository<User>") // => "Repository"
 * extractRawType("Map<String, Object>") // => "Map"
 * extractRawType("UserRepository") // => "UserRepository"
 */
export function extractRawType(type: string): string
```

**Implementation**: Remove everything from first `<` to matching `>` (handle nested generics)

---

### normalizeFQN

Normalize fully qualified name for comparison.

```typescript
/**
 * Normalize FQN for consistent comparison
 *
 * - Removes generic parameters
 * - Trims whitespace
 * - Normalizes package separators
 *
 * @param fqn - Fully qualified name to normalize
 * @returns Normalized FQN
 *
 * @example
 * normalizeFQN("com.example.Repository<User>") // => "com.example.Repository"
 * normalizeFQN("  com.example.Foo  ") // => "com.example.Foo"
 */
export function normalizeFQN(fqn: string): string
```

**Normalization Steps**:
1. Apply `extractRawType` to remove generics
2. Trim leading/trailing whitespace
3. Ensure package separator is `.` (not `/` or `\`)

---

### matchesInterface

Check if a bean type matches an interface type.

```typescript
/**
 * Check if bean type matches interface type
 *
 * Tries in order:
 * 1. Exact FQN match
 * 2. Simple name match (last component after final dot)
 *
 * @param beanType - Type of the bean (may be FQN or simple name)
 * @param interfaceType - Type of the interface (may be FQN or simple name)
 * @returns True if types match
 *
 * @example
 * matchesInterface("com.example.UserRepositoryImpl", "com.example.UserRepository")
 *   // => false (different classes)
 * matchesInterface("com.example.UserRepository", "UserRepository")
 *   // => true (simple name matches)
 * matchesInterface("Repository<User>", "Repository<Order>")
 *   // => true (both normalize to "Repository")
 */
export function matchesInterface(beanType: string, interfaceType: string): boolean
```

**Matching Logic**:
1. Normalize both types (remove generics, trim)
2. Try exact FQN match
3. Fallback: Extract simple names and compare
4. Return true if either match succeeds

---

## Error Handling

### Error Types

```typescript
/**
 * Interface resolution errors
 */
export class InterfaceNotFoundError extends Error {
  constructor(public interfaceFQN: string) {
    super(`Interface not found: ${interfaceFQN}`);
  }
}

export class MultipleQualifiedBeansError extends Error {
  constructor(public qualifier: string, public count: number) {
    super(`Multiple beans (${count}) found with qualifier "${qualifier}"`);
  }
}

export class MultiplePrimaryBeansError extends Error {
  constructor(public interfaceFQN: string, public count: number) {
    super(`Multiple @Primary beans (${count}) found for interface ${interfaceFQN}`);
  }
}
```

### Error Handling Pattern

```typescript
/**
 * Example error handling in CodeLens provider
 */
try {
  const result = interfaceResolver.resolveInterface(context);

  switch (result.status) {
    case "single":
    case "primary":
    case "qualified":
      return createNavigationCodeLens(result.bean);

    case "multiple":
      return createSelectionCodeLens(result.candidates);

    case "none":
      return createErrorCodeLens(`No implementations found for ${context.interfaceFQN}`);
  }
} catch (error) {
  if (error instanceof MultiplePrimaryBeansError) {
    console.error(`Configuration error: ${error.message}`);
    return createErrorCodeLens(`Multiple @Primary beans - check configuration`);
  }
  throw error;
}
```

---

## Integration Points

### BeanIndexer Integration

```typescript
/**
 * Extend BeanIndexer to populate InterfaceRegistry during indexing
 */
class BeanIndexer {
  private interfaceRegistry: InterfaceRegistry;

  async indexFile(uri: vscode.Uri): Promise<void> {
    const metadata = await this.extractMetadata(uri);

    // Register interfaces found in file
    for (const interfaceDef of metadata.interfaces) {
      this.interfaceRegistry.registerInterface(interfaceDef);
    }

    // Register bean implementations
    for (const beanDef of metadata.beans) {
      for (const interfaceFQN of beanDef.implementedInterfaces) {
        this.interfaceRegistry.registerImplementation(
          interfaceFQN,
          beanDef,
          "implements_clause"
        );
      }
    }
  }
}
```

### CodeLensProvider Integration

```typescript
/**
 * Extend CodeLensProvider to handle interface-typed injection points
 */
class CodeLensProvider {
  private interfaceResolver: InterfaceResolver;

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const injectionPoints = this.findInjectionPoints(document);
    const codeLenses: vscode.CodeLens[] = [];

    for (const injectionPoint of injectionPoints) {
      // Check if injection point type is an interface
      const interfaceDef = this.interfaceRegistry.getInterface(injectionPoint.beanType);

      if (interfaceDef) {
        // Resolve via interface resolution
        const candidates = this.interfaceRegistry.getImplementations(injectionPoint.beanType);
        const result = this.interfaceResolver.resolveInterface({
          interfaceFQN: injectionPoint.beanType,
          rawType: interfaceDef.rawType,
          qualifier: injectionPoint.qualifier,
          candidates,
          injectionLocation: injectionPoint.location
        });

        codeLenses.push(this.createCodeLensFromResult(result, injectionPoint));
      } else {
        // Fall back to traditional bean resolution
        codeLenses.push(...this.resolveConcreteBean(injectionPoint));
      }
    }

    return codeLenses;
  }
}
```

---

## Testing Contract

### Unit Test Requirements

All public APIs must have unit tests covering:

1. **Happy Path**: Typical usage with valid inputs
2. **Edge Cases**: Empty inputs, null values, boundary conditions
3. **Error Cases**: Invalid inputs, precondition violations
4. **Performance**: Operations meet performance goals (<50ms for resolution)

### Integration Test Requirements

Integration tests must verify:

1. **End-to-End Flow**: File indexing → interface registration → bean resolution → CodeLens display
2. **Incremental Updates**: File changes correctly update interface registry
3. **Disambiguation**: All 4 resolution strategies (qualifier, primary, single, multiple) work correctly

---

## API Versioning

**Current Version**: 1.0.0

**Stability**: All APIs marked as **Alpha** - subject to breaking changes based on implementation feedback

**Deprecation Policy**: Deprecated APIs will be supported for at least 2 minor versions before removal

---

## Summary

### Public APIs
- `InterfaceRegistry`: 7 methods for interface/implementation management
- `InterfaceResolver`: 5 methods for disambiguation logic
- `TypeUtils`: 3 functions for type matching and normalization

### Integration Points
- `BeanIndexer`: Extended to populate `InterfaceRegistry`
- `CodeLensProvider`: Enhanced to use `InterfaceResolver`

### Error Handling
- 3 custom error types for interface resolution failures
- Structured error handling pattern for CodeLens provider

All APIs follow TypeScript strict mode, include comprehensive JSDoc, and have defined preconditions/postconditions.
