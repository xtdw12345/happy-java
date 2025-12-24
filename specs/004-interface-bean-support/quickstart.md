# Quickstart Guide: Interface-Based Bean Resolution

**Date**: 2025-12-24
**Feature**: 004-interface-bean-support
**Audience**: Developers implementing or extending this feature

## Overview

This guide helps developers understand the interface resolution architecture and how to work with the code. It covers the key components, data flow, and common extension points.

---

## Architecture Overview

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      VS Code Extension Host                  │
│                                                              │
│  ┌──────────────────┐                                       │
│  │ CodeLensProvider │                                       │
│  │                  │                                       │
│  │ provideCodeLenses()                                      │
│  └────────┬─────────┘                                       │
│           │                                                  │
│           │ 1. Find injection points                        │
│           │ 2. Check if type is interface                   │
│           │                                                  │
│           ▼                                                  │
│  ┌────────────────────┐         ┌──────────────────┐      │
│  │  InterfaceResolver │◄────────┤ InterfaceRegistry│      │
│  │                    │         │                  │      │
│  │  resolveInterface()│         │ getImplementations()│   │
│  └────────┬───────────┘         │ getInterface()   │      │
│           │                     └──────────────────┘      │
│           │ 3. Apply disambiguation                        │
│           │    (Qualifier → @Primary → Single)            │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────────┐                                  │
│  │ InterfaceResolutionResult                               │
│  │                      │                                  │
│  │ - single/primary/qualified                             │
│  │ - multiple (show quick pick)                           │
│  │ - none (show error)                                    │
│  └──────────────────────┘                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘

                                  ▲
                                  │
                                  │ Populated during indexing
                                  │
                        ┌─────────┴──────────┐
                        │    BeanIndexer     │
                        │                    │
                        │  indexFile()       │
                        │  ├─ Extract interfaces
                        │  ├─ Extract implements clauses
                        │  └─ Register relationships
                        └────────────────────┘
```

### Data Flow

**Indexing Phase** (when Java files scanned):
```
Java File → BeanIndexer.indexFile()
                ↓
        BeanMetadataExtractor
                ↓
         ┌──────┴──────┐
         ▼             ▼
   Interfaces    Bean Definitions
         │             │
         │             └─→ implementedInterfaces[]
         ↓
   InterfaceRegistry.registerInterface()
         ↓
   InterfaceRegistry.registerImplementation()
         ↓
   Bidirectional Index Updated
```

**Resolution Phase** (when CodeLens requested):
```
Injection Point → CodeLensProvider
                       ↓
                Is interface type?
                  │          │
                Yes         No
                  │          └─→ Traditional bean resolution
                  ↓
          InterfaceRegistry.getImplementations()
                  ↓
          candidates: BeanDefinition[]
                  ↓
          InterfaceResolver.resolveInterface()
                  ↓
        ┌─────────┴─────────┐
        │ Disambiguation     │
        │ 1. Qualifier       │
        │ 2. @Primary        │
        │ 3. Single          │
        │ 4. Multiple (pick) │
        └─────────┬─────────┘
                  ↓
          InterfaceResolutionResult
                  ↓
          CodeLens created
```

---

## Key Components

### 1. InterfaceRegistry

**Purpose**: Central storage for interface→implementation mappings

**Location**: `src/spring-bean-navigation/indexer/interfaceRegistry.ts`

**Responsibilities**:
- Store discovered interfaces (`InterfaceDefinition`)
- Maintain bidirectional maps (interface ↔ implementations)
- Provide O(1) lookup for implementations by interface FQN
- Handle incremental updates when files change

**Usage Example**:
```typescript
// During indexing
const registry = new InterfaceRegistry();

// Register interface
registry.registerInterface({
  fullyQualifiedName: "com.example.UserRepository",
  simpleName: "UserRepository",
  packageName: "com.example",
  location: { uri, line: 5, column: 0 },
  isAbstract: false,
  rawType: "UserRepository"
});

// Register implementation
registry.registerImplementation(
  "com.example.UserRepository",
  userRepositoryBean,
  "implements_clause"
);

// Later, during resolution
const impls = registry.getImplementations("com.example.UserRepository");
console.log(`Found ${impls.length} implementations`);
```

---

### 2. InterfaceResolver

**Purpose**: Resolve interface types to concrete bean implementations using Spring disambiguation rules

**Location**: `src/spring-bean-navigation/resolver/interfaceResolver.ts`

**Responsibilities**:
- Apply qualifier matching (highest priority)
- Apply @Primary selection
- Handle single-implementation auto-selection
- Prepare multiple candidates for user selection
- Return structured resolution results

**Usage Example**:
```typescript
const resolver = new InterfaceResolver(registry, beanIndexer);

const context: DisambiguationContext = {
  interfaceFQN: "com.example.UserRepository",
  rawType: "UserRepository",
  qualifier: "jpa", // Optional
  candidates: registry.getImplementations("com.example.UserRepository"),
  injectionLocation: { uri, line: 42, column: 5 }
};

const result = resolver.resolveInterface(context);

switch (result.status) {
  case "qualified":
    console.log(`Resolved via qualifier to: ${result.bean.name}`);
    break;
  case "primary":
    console.log(`Resolved via @Primary to: ${result.bean.name}`);
    break;
  case "single":
    console.log(`Only one implementation: ${result.bean.name}`);
    break;
  case "multiple":
    console.log(`${result.candidates.length} candidates - show quick pick`);
    break;
  case "none":
    console.log(`No implementations found`);
    break;
}
```

---

### 3. TypeUtils

**Purpose**: Utility functions for type matching and normalization

**Location**: `src/spring-bean-navigation/utils/typeUtils.ts`

**Responsibilities**:
- Extract raw types from generic types (`Repository<User>` → `Repository`)
- Normalize FQNs for consistent comparison
- Match bean types against interface types (FQN or simple name)

**Usage Example**:
```typescript
import { extractRawType, normalizeFQN, matchesInterface } from './typeUtils';

// Remove generics
const rawType = extractRawType("Repository<User>");
// => "Repository"

// Normalize for comparison
const normalized = normalizeFQN("  com.example.Repository<User>  ");
// => "com.example.Repository"

// Check if types match
const matches = matchesInterface("com.example.UserRepository", "UserRepository");
// => true (simple name matches)
```

---

## Integration Points

### Extending BeanIndexer

The `BeanIndexer` must be extended to populate the `InterfaceRegistry` during indexing.

**Modified File**: `src/spring-bean-navigation/indexer/beanIndexer.ts`

**Changes Required**:

1. **Add InterfaceRegistry instance**:
```typescript
export class BeanIndexer {
  private interfaceRegistry: InterfaceRegistry;

  constructor() {
    // ... existing initialization
    this.interfaceRegistry = new InterfaceRegistry();
  }

  getInterfaceRegistry(): InterfaceRegistry {
    return this.interfaceRegistry;
  }
}
```

2. **Index interfaces during file scan**:
```typescript
private async indexFile(uri: vscode.Uri): Promise<void> {
  const metadata = await this.metadataExtractor.extract(uri);

  // NEW: Register interfaces
  for (const interfaceDef of metadata.interfaces) {
    this.interfaceRegistry.registerInterface(interfaceDef);
  }

  // Existing: Register beans
  for (const beanDef of metadata.beans) {
    this.addBean(beanDef);

    // NEW: Register implementation relationships
    for (const interfaceFQN of beanDef.implementedInterfaces) {
      try {
        this.interfaceRegistry.registerImplementation(
          interfaceFQN,
          beanDef,
          "implements_clause"
        );
      } catch (error) {
        console.warn(`Failed to register implementation: ${error.message}`);
      }
    }
  }
}
```

3. **Handle file deletions**:
```typescript
private async handleFileDeleted(uri: vscode.Uri): Promise<void> {
  // Existing: Remove beans
  const removedBeans = this.removeBeansByFile(uri);

  // NEW: Remove from interface registry
  for (const beanName of removedBeans) {
    this.interfaceRegistry.removeBean(beanName);
  }

  // NEW: Remove interfaces from this file
  const removedInterfaces = this.getInterfacesInFile(uri);
  for (const interfaceFQN of removedInterfaces) {
    this.interfaceRegistry.removeInterface(interfaceFQN);
  }
}
```

---

### Extending BeanMetadataExtractor

The `BeanMetadataExtractor` must be extended to extract interface definitions and `implements` clauses.

**Modified File**: `src/spring-bean-navigation/indexer/beanMetadataExtractor.ts`

**Changes Required**:

1. **Add interface extraction method**:
```typescript
export interface ExtractionResult {
  beans: BeanDefinition[];
  interfaces: InterfaceDefinition[]; // NEW
}

private extractInterfaces(cst: any, uri: vscode.Uri): InterfaceDefinition[] {
  const interfaces: InterfaceDefinition[] = [];
  const ordinaryCompilationUnit = cst.children?.ordinaryCompilationUnit?.[0];

  const typeDeclarations = ordinaryCompilationUnit.children?.typeDeclaration || [];

  for (const typeDecl of typeDeclarations) {
    const interfaceDecl = typeDecl.children?.classOrInterfaceDeclaration?.[0]
      ?.children?.interfaceDeclaration?.[0];

    if (interfaceDecl) {
      const interfaceDef = this.parseInterfaceDeclaration(interfaceDecl, uri);
      if (interfaceDef) {
        interfaces.push(interfaceDef);
      }
    }
  }

  return interfaces;
}
```

2. **Extract implemented interfaces from class**:
```typescript
private extractImplementedInterfaces(classDecl: any): string[] {
  const normalClassDecl = classDecl.children?.normalClassDeclaration?.[0];
  const superInterfaces = normalClassDecl?.children?.superInterfaces?.[0];

  if (!superInterfaces) return [];

  const interfaceTypeList = superInterfaces.children?.interfaceTypeList?.[0];
  const interfaceTypes = interfaceTypeList?.children?.interfaceType || [];

  return interfaceTypes.map(interfaceType => {
    const simpleName = interfaceType.children?.classType?.[0]
      ?.children?.Identifier?.[0]?.image;
    return this.resolveFQN(simpleName); // Reuse existing FQN resolution
  }).filter(fqn => fqn !== undefined);
}
```

3. **Update bean extraction to include implemented interfaces**:
```typescript
private extractBeanFromClass(classDecl: any, uri: vscode.Uri): BeanDefinition {
  const beanDef = {
    // ... existing field extraction
    implementedInterfaces: this.extractImplementedInterfaces(classDecl) // NEW
  };
  return beanDef;
}
```

---

### Extending CodeLensProvider

The `CodeLensProvider` must be extended to handle interface-typed injection points.

**Modified File**: `src/spring-bean-navigation/providers/codeLensProvider.ts`

**Changes Required**:

1. **Add InterfaceResolver instance**:
```typescript
export class CodeLensProvider implements vscode.CodeLensProvider {
  private interfaceResolver: InterfaceResolver;

  constructor(
    private beanIndexer: BeanIndexer,
    // ... other dependencies
  ) {
    this.interfaceResolver = new InterfaceResolver(
      beanIndexer.getInterfaceRegistry(),
      beanIndexer
    );
  }
}
```

2. **Check if injection point is interface-typed**:
```typescript
provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
  const injectionPoints = this.findInjectionPoints(document);
  const codeLenses: vscode.CodeLens[] = [];

  for (const injectionPoint of injectionPoints) {
    const interfaceRegistry = this.beanIndexer.getInterfaceRegistry();
    const interfaceDef = interfaceRegistry.getInterface(injectionPoint.beanType);

    if (interfaceDef) {
      // Interface-typed injection point
      codeLenses.push(...this.resolveInterfaceInjection(injectionPoint, interfaceDef));
    } else {
      // Traditional concrete class injection
      codeLenses.push(...this.resolveConcreteInjection(injectionPoint));
    }
  }

  return codeLenses;
}
```

3. **Implement interface resolution logic**:
```typescript
private resolveInterfaceInjection(
  injectionPoint: BeanInjectionPoint,
  interfaceDef: InterfaceDefinition
): vscode.CodeLens[] {
  const registry = this.beanIndexer.getInterfaceRegistry();
  const candidates = registry.getImplementations(interfaceDef.fullyQualifiedName);

  if (candidates.length === 0) {
    return [this.createErrorCodeLens(
      injectionPoint.location,
      `No implementations found for ${interfaceDef.simpleName}`
    )];
  }

  const context: DisambiguationContext = {
    interfaceFQN: interfaceDef.fullyQualifiedName,
    rawType: interfaceDef.rawType,
    qualifier: injectionPoint.qualifier,
    candidates,
    injectionLocation: injectionPoint.location
  };

  const result = this.interfaceResolver.resolveInterface(context);

  return this.createCodeLensFromResult(result, injectionPoint);
}
```

4. **Handle resolution results**:
```typescript
private createCodeLensFromResult(
  result: InterfaceResolutionResult,
  injectionPoint: BeanInjectionPoint
): vscode.CodeLens[] {
  const range = this.createRange(injectionPoint.location);

  switch (result.status) {
    case "single":
      return [new vscode.CodeLens(range, {
        title: `Go to implementation: ${result.bean.name}`,
        command: 'happy-java.navigateToBean',
        arguments: [result.bean.location]
      })];

    case "primary":
      return [new vscode.CodeLens(range, {
        title: `Go to primary implementation: ${result.bean.name}`,
        command: 'happy-java.navigateToBean',
        arguments: [result.bean.location]
      })];

    case "qualified":
      return [new vscode.CodeLens(range, {
        title: `Go to qualified implementation: ${result.bean.name}`,
        command: 'happy-java.navigateToBean',
        arguments: [result.bean.location]
      })];

    case "multiple":
      return [new vscode.CodeLens(range, {
        title: `Multiple implementations found (${result.candidates.length})`,
        command: 'happy-java.selectImplementation',
        arguments: [result.candidates]
      })];

    case "none":
      return [this.createErrorCodeLens(
        injectionPoint.location,
        "No implementations found"
      )];
  }
}
```

---

## Common Extension Scenarios

### Scenario 1: Add Support for Custom Qualifier Annotation

**Requirement**: Support a custom `@CustomQualifier` annotation in addition to Spring's `@Qualifier`.

**Implementation**:

1. Update `AnnotationScanner` to recognize custom annotation:
```typescript
// In annotationScanner.ts
const QUALIFIER_ANNOTATIONS = ['@Qualifier', '@CustomQualifier'];

isQualifierAnnotation(annotation: Annotation): boolean {
  return QUALIFIER_ANNOTATIONS.includes(annotation.name);
}
```

2. Extract qualifier value from custom annotation (reuse existing extraction logic):
```typescript
// No changes needed if custom annotation uses same parameter format
// @CustomQualifier("name") works the same as @Qualifier("name")
```

3. Test with custom annotation:
```java
@Service
@CustomQualifier("custom")
public class CustomUserService implements UserService { }

@Component
public class UserController {
  @Autowired
  @CustomQualifier("custom")
  private UserService userService; // Should resolve to CustomUserService
}
```

---

### Scenario 2: Add Performance Monitoring

**Requirement**: Track interface resolution performance to identify slow resolutions.

**Implementation**:

1. Add timing wrapper in `InterfaceResolver`:
```typescript
resolveInterface(context: DisambiguationContext): InterfaceResolutionResult {
  const startTime = performance.now();

  const result = this.performResolution(context);

  const duration = performance.now() - startTime;
  if (duration > 50) { // Threshold from plan.md
    console.warn(`Slow interface resolution: ${context.interfaceFQN} took ${duration}ms`);
  }

  // Optional: Send telemetry
  this.telemetry.recordResolutionTime(context.interfaceFQN, duration);

  return result;
}
```

2. Add debugging command to dump slow resolutions:
```typescript
// In extension.ts
context.subscriptions.push(
  vscode.commands.registerCommand('happy-java.dumpSlowResolutions', () => {
    const slowResolutions = telemetry.getSlowResolutions();
    vscode.window.showInformationMessage(
      `Found ${slowResolutions.length} slow resolutions (>50ms)`
    );
  })
);
```

---

### Scenario 3: Add Interface Hierarchy Support

**Requirement**: Support interface inheritance (Interface A extends Interface B, Class C implements A, should match injection of type B).

**Implementation**:

1. Track interface inheritance in `InterfaceDefinition`:
```typescript
export interface InterfaceDefinition {
  // ... existing fields
  extendsInterfaces: string[]; // NEW: Parent interface FQNs
}
```

2. Build transitive closure during registration:
```typescript
// In InterfaceRegistry
registerImplementation(
  interfaceFQN: string,
  beanDefinition: BeanDefinition,
  detectionMethod: string
): void {
  // Register for direct interface
  this.addImplementation(interfaceFQN, beanDefinition);

  // NEW: Register for all parent interfaces
  const interfaceDef = this.interfaces.get(interfaceFQN);
  if (interfaceDef) {
    for (const parentFQN of interfaceDef.extendsInterfaces) {
      this.addImplementation(parentFQN, beanDefinition);
    }
  }
}
```

3. Test with interface hierarchy:
```java
interface Repository<T> { }
interface UserRepository extends Repository<User> { }

@Service
class UserRepositoryImpl implements UserRepository { }

@Component
class UserService {
  @Autowired
  private Repository<User> repo; // Should resolve to UserRepositoryImpl
}
```

---

## Testing Strategy

### Unit Tests

**Location**: `src/test/suite/spring-bean-navigation/interface-resolution/`

**Coverage**:
- `interfaceRegistry.test.ts`: Test all registry operations (register, lookup, remove)
- `interfaceResolver.test.ts`: Test all disambiguation strategies
- `typeUtils.test.ts`: Test type matching and normalization

**Example Test**:
```typescript
// interfaceResolver.test.ts
test('should resolve to @Primary bean when multiple implementations', () => {
  const primary = createBean({ name: 'primary', isPrimary: true });
  const secondary = createBean({ name: 'secondary', isPrimary: false });

  const context: DisambiguationContext = {
    interfaceFQN: 'com.example.Foo',
    rawType: 'Foo',
    candidates: [primary, secondary],
    injectionLocation: mockLocation
  };

  const result = resolver.resolveInterface(context);

  assert.strictEqual(result.status, 'primary');
  assert.strictEqual(result.bean.name, 'primary');
});
```

### Integration Tests

**Location**: `src/test/suite/spring-bean-navigation/interface-resolution/integration/`

**Coverage**:
- End-to-end: Index Java file → Resolve interface → Verify CodeLens
- Incremental updates: Modify file → Re-index → Verify registry updated
- Cross-file: Interface in one file, implementation in another

**Example Test**:
```typescript
// integration.test.ts
test('should provide CodeLens for interface-typed field', async () => {
  // Setup: Create interface and implementation
  await createTestFile('UserRepository.java', `
    package com.example;
    public interface UserRepository { }
  `);
  await createTestFile('UserRepositoryImpl.java', `
    package com.example;
    @Service
    public class UserRepositoryImpl implements UserRepository { }
  `);

  // Index files
  await beanIndexer.rebuildIndex();

  // Create injection point
  const doc = await createTestFile('UserService.java', `
    package com.example;
    @Service
    public class UserService {
      @Autowired
      private UserRepository repo; // Should get CodeLens
    }
  `);

  // Verify CodeLens
  const codeLenses = await codeLensProvider.provideCodeLenses(doc);
  assert.strictEqual(codeLenses.length, 1);
  assert.match(codeLenses[0].command.title, /Go to implementation: UserRepositoryImpl/);
});
```

---

## Debugging Tips

### Enable Debug Logging

Set environment variable before launching extension:
```bash
export VSCODE_HAPPY_JAVA_LOG_LEVEL=DEBUG
code --extensionDevelopmentPath=/path/to/happy-java
```

Check logs in Output panel (View → Output → "Happy Java").

### Inspect Interface Registry

Add debugging command to dump registry state:
```typescript
// In extension.ts
context.subscriptions.push(
  vscode.commands.registerCommand('happy-java.dumpInterfaceRegistry', () => {
    const registry = beanIndexer.getInterfaceRegistry();
    const interfaces = registry.getAllInterfaces();

    console.log('=== Interface Registry Dump ===');
    for (const interfaceDef of interfaces) {
      const impls = registry.getImplementations(interfaceDef.fullyQualifiedName);
      console.log(`${interfaceDef.fullyQualifiedName}: ${impls.length} implementations`);
      for (const impl of impls) {
        console.log(`  - ${impl.name} (${impl.type})`);
      }
    }
  })
);
```

### Profile Resolution Performance

Use Chrome DevTools to profile extension:
```bash
code --inspect-extensions=9229 --extensionDevelopmentPath=/path/to/happy-java
```

Open chrome://inspect, click "Open dedicated DevTools", record CPU profile while triggering CodeLens.

---

## Next Steps

After reading this guide, you should be able to:

1. ✅ Understand the architecture and data flow
2. ✅ Modify the integration points (indexer, extractor, provider)
3. ✅ Extend the system with custom disambiguation strategies
4. ✅ Write comprehensive unit and integration tests
5. ✅ Debug and profile the implementation

**Ready to implement?** Proceed to [tasks.md](./tasks.md) (generated by `/speckit.tasks`) for the step-by-step implementation plan.

**Need clarification?** Review:
- [research.md](./research.md) - Technical decisions and rationale
- [data-model.md](./data-model.md) - Entity definitions and relationships
- [contracts/interface-resolution-api.md](./contracts/interface-resolution-api.md) - API specifications

**Questions?** Open an issue on GitHub or ask in project chat.
