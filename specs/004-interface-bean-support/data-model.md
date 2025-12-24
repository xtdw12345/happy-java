# Data Model: Interface-Based Bean Resolution

**Date**: 2025-12-24
**Feature**: 004-interface-bean-support
**Phase**: 1 - Design

## Overview

This document defines the data entities and their relationships for interface-based bean resolution. All entities are TypeScript interfaces/classes that extend or integrate with the existing bean indexing system.

---

## Core Entities

### 1. InterfaceDefinition

Represents a Java interface or abstract class discovered in the workspace.

```typescript
/**
 * Represents a Java interface or abstract class that can be implemented by beans
 */
export interface InterfaceDefinition {
  /**
   * Fully qualified name of the interface
   * Example: "com.example.repository.UserRepository"
   */
  fullyQualifiedName: string;

  /**
   * Simple name without package
   * Example: "UserRepository"
   */
  simpleName: string;

  /**
   * Package name
   * Example: "com.example.repository"
   */
  packageName: string;

  /**
   * Source file location
   */
  location: BeanLocation;

  /**
   * Whether this is an abstract class (true) or interface (false)
   */
  isAbstract: boolean;

  /**
   * Raw type without generic parameters
   * Example: "Repository" (from "Repository<User>")
   */
  rawType: string;
}
```

**Lifecycle**:
- Created during workspace indexing when interface/abstract class declaration found
- Stored in `InterfaceRegistry`
- Removed when source file deleted
- Updated when source file modified

**Validation Rules**:
- `fullyQualifiedName` must be unique within workspace
- `simpleName` must not be empty
- `location.uri` must point to valid Java file
- `rawType` must match `simpleName` (generic parameters stripped)

---

### 2. ImplementationRelationship

Links an interface to a bean that implements it, including disambiguation metadata.

```typescript
/**
 * Represents the relationship between an interface and a bean implementation
 */
export interface ImplementationRelationship {
  /**
   * Fully qualified name of the interface
   * Example: "com.example.service.PaymentService"
   */
  interfaceFQN: string;

  /**
   * Bean that implements this interface
   * Can be either:
   * - A class bean (BeanDefinition with type="class")
   * - A @Bean method bean (BeanDefinition with type="method")
   */
  implementingBean: BeanDefinition;

  /**
   * How this implementation was detected
   * - "implements_clause": Class has "implements InterfaceName"
   * - "bean_return_type": @Bean method returns InterfaceName
   * - "extends_abstract": Class extends abstract class
   */
  detectionMethod: "implements_clause" | "bean_return_type" | "extends_abstract";

  /**
   * Timestamp when relationship was established (for debugging)
   */
  indexedAt: number;
}
```

**Lifecycle**:
- Created when class/bean method is indexed and interface relationship detected
- Stored in `InterfaceRegistry` bidirectional map
- Removed when implementing bean is removed from index
- Updated when bean definition changes (e.g., @Primary added)

**Validation Rules**:
- `interfaceFQN` must exist in `InterfaceRegistry`
- `implementingBean` must exist in `BeanIndexer`
- Relationship must not be duplicate (same interface + bean pair)

---

### 3. BeanDefinition (Enhanced)

**Modification**: Add `implementedInterfaces` field to existing `BeanDefinition` type.

```typescript
/**
 * Enhanced BeanDefinition with interface tracking
 * (extends existing BeanDefinition from models/types.ts)
 */
export interface BeanDefinition {
  // ... existing fields (name, type, location, isPrimary, qualifier, etc.)

  /**
   * NEW: Interfaces implemented by this bean
   * Empty array if bean doesn't implement any interfaces
   *
   * Examples:
   * - Class bean: ["com.example.UserRepository", "com.example.CrudRepository"]
   * - @Bean method: ["javax.sql.DataSource"]
   */
  implementedInterfaces: string[];
}
```

**Migration Notes**:
- All existing BeanDefinition instances default `implementedInterfaces` to `[]`
- No breaking changes (new field is optional)
- Populated during bean indexing by extracting `implements` clause

---

### 4. BeanInjectionPoint (No Changes)

**No modifications needed**. Existing structure already supports:
- `beanType` field contains interface name for interface-typed injections
- `qualifier` field already extracted (used for disambiguation)
- `fieldName`, `location` already available

```typescript
// Example usage:
const injectionPoint: BeanInjectionPoint = {
  beanType: "com.example.UserRepository", // Interface type
  fieldName: "userRepository",
  injectionType: InjectionType.FIELD,
  qualifier: "jpa", // Optional
  isRequired: true,
  location: { uri, line: 42, column: 5 }
};
```

---

## Supporting Types

### 5. InterfaceResolutionResult

Result of resolving an interface to its implementation(s).

```typescript
/**
 * Result of interface-to-implementation resolution
 */
export type InterfaceResolutionResult =
  | { status: "single"; bean: BeanDefinition }
  | { status: "primary"; bean: BeanDefinition }
  | { status: "qualified"; bean: BeanDefinition }
  | { status: "multiple"; candidates: BeanDefinition[] }
  | { status: "none" };

/**
 * Helper type guards
 */
export function isSingleResolution(result: InterfaceResolutionResult): result is { status: "single"; bean: BeanDefinition } {
  return result.status === "single";
}

export function requiresUserSelection(result: InterfaceResolutionResult): result is { status: "multiple"; candidates: BeanDefinition[] } {
  return result.status === "multiple";
}
```

**Status Meanings**:
- `single`: Exactly one implementation found (no disambiguation needed)
- `primary`: Multiple implementations, but one has @Primary
- `qualified`: Qualifier matched specific implementation
- `multiple`: Multiple candidates, user must select (show quick-pick)
- `none`: No implementations found (show error CodeLens)

---

### 6. DisambiguationContext

Input context for disambiguation logic.

```typescript
/**
 * Context provided to disambiguation logic
 */
export interface DisambiguationContext {
  /**
   * Fully qualified name of the interface to resolve
   */
  interfaceFQN: string;

  /**
   * Raw type of the interface (generic parameters stripped)
   */
  rawType: string;

  /**
   * Qualifier from injection point (if present)
   * Example: "jpa" from @Qualifier("jpa")
   */
  qualifier?: string;

  /**
   * All candidate implementations from index
   */
  candidates: BeanDefinition[];

  /**
   * Source location of injection point (for error messages)
   */
  injectionLocation: BeanLocation;
}
```

---

## Relationships

### Entity Relationship Diagram

```
┌─────────────────────┐
│ InterfaceDefinition │
│ - fullyQualifiedName│───┐
│ - simpleName        │   │
│ - location          │   │ 1
│ - isAbstract        │   │
│ - rawType           │   │
└─────────────────────┘   │
                          │
                          │ N
                    ┌─────▼──────────────────────┐
                    │ ImplementationRelationship │
                    │ - interfaceFQN             │
                    │ - implementingBean     ────┼───┐
                    │ - detectionMethod          │   │
                    │ - indexedAt                │   │
                    └────────────────────────────┘   │
                                                     │ N
                                                     │
                                                     │ 1
                                        ┌────────────▼────────────┐
                                        │ BeanDefinition          │
                                        │ - name                  │
                                        │ - type                  │
                                        │ - location              │
                                        │ - isPrimary             │
                                        │ - qualifier             │
                                        │ - implementedInterfaces │◄───┐
                                        └─────────────────────────┘    │
                                                                       │ N
                                                                       │
                                                                       │ 1
                                                           ┌───────────┴──────────┐
                                                           │ BeanInjectionPoint   │
                                                           │ - beanType (interface)│
                                                           │ - fieldName          │
                                                           │ - qualifier          │
                                                           │ - location           │
                                                           └──────────────────────┘
```

**Key Relationships**:
1. **One Interface → Many Implementations**: One interface can have 0..N implementing beans
2. **One Bean → Many Interfaces**: One bean can implement multiple interfaces
3. **Many Injections → One Interface**: Multiple injection points can reference the same interface type
4. **Injection → Resolution**: Injection point's `beanType` + `qualifier` used to resolve via disambiguation logic

---

## Storage & Indexing

### InterfaceRegistry Structure

```typescript
/**
 * Central registry for interface→implementation mappings
 */
export class InterfaceRegistry {
  /**
   * All discovered interfaces
   * Key: Fully qualified name
   * Value: Interface definition
   */
  private interfaces = new Map<string, InterfaceDefinition>();

  /**
   * Interface → Implementations mapping
   * Key: Interface FQN
   * Value: Set of bean names that implement this interface
   */
  private interfaceToImpls = new Map<string, Set<string>>();

  /**
   * Bean → Interfaces mapping (reverse index)
   * Key: Bean name
   * Value: Set of interface FQNs implemented by this bean
   */
  private beanToInterfaces = new Map<string, Set<string>>();

  /**
   * Track relationships for debugging
   */
  private relationships: ImplementationRelationship[] = [];
}
```

**Index Operations**:
- **Register Interface**: `O(1)` - Add to `interfaces` map
- **Register Implementation**: `O(I)` where I = interfaces implemented (typically 1-3)
  - Add to `interfaceToImpls` for each interface
  - Add to `beanToInterfaces` for the bean
  - Create relationship record
- **Lookup Implementations**: `O(1)` - Query `interfaceToImpls`
- **Remove Bean**: `O(I)` - Remove from all interface sets
- **Remove Interface**: `O(N)` where N = implementations (typically small)

**Memory Estimate** (for 500 files, 50 interfaces, 200 beans):
- `interfaces`: 50 × 200 bytes = 10 KB
- `interfaceToImpls`: 50 × (4 beans avg) × 50 bytes = 10 KB
- `beanToInterfaces`: 200 × (2 interfaces avg) × 50 bytes = 20 KB
- `relationships`: 200 × 100 bytes = 20 KB
- **Total**: ~60 KB (well within 10MB budget)

---

## State Transitions

### Interface Discovery Lifecycle

```
[File Created/Modified]
        ↓
[CST Parsing]
        ↓
[Interface Declaration Found?] ─No─> [Skip]
        ↓ Yes
[Extract FQN, location, isAbstract]
        ↓
[Create InterfaceDefinition]
        ↓
[Register in InterfaceRegistry.interfaces]
        ↓
[Index Complete]
```

### Implementation Relationship Lifecycle

```
[Bean Indexed]
        ↓
[Extract implements clause / @Bean return type]
        ↓
[Interface FQN resolved?] ─No─> [Skip]
        ↓ Yes
[Lookup Interface in Registry] ─Not Found─> [Log Warning, Skip]
        ↓ Found
[Create ImplementationRelationship]
        ↓
[Add to interfaceToImpls Map]
        ↓
[Add to beanToInterfaces Map]
        ↓
[Update BeanDefinition.implementedInterfaces]
        ↓
[Relationship Established]
```

### Bean Resolution Lifecycle

```
[CodeLens Provider Requests Beans]
        ↓
[BeanInjectionPoint.beanType] ─Is Interface?─> [Traditional Resolution]
        ↓ Yes                                          (existing logic)
[Query InterfaceRegistry.interfaceToImpls]
        ↓
[Get Candidate Beans]
        ↓
[Apply Disambiguation Logic]
    ↓             ↓           ↓           ↓
[Qualifier]  [Primary]  [Single]  [Multiple]
    ↓             ↓           ↓           ↓
[Return Bean] [Return Bean] [Return Bean] [Show Quick Pick]
```

---

## Validation & Invariants

### Data Integrity Rules

1. **Interface Uniqueness**: No two InterfaceDefinition instances can have the same `fullyQualifiedName`
2. **Implementation Consistency**: If `interfaceToImpls` contains beanName, then `beanToInterfaces` must contain the reverse mapping
3. **Bean Existence**: All beans referenced in relationships must exist in BeanIndexer
4. **Interface Existence**: All interfaces in `interfaceToImpls` keys must exist in `interfaces` map
5. **FQN Format**: All FQNs must match pattern: `[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)*`

### Runtime Checks (Debug Mode)

```typescript
/**
 * Validate registry integrity (expensive, debug only)
 */
function validateIntegrity(): ValidationResult {
  const errors: string[] = [];

  // Check bidirectional consistency
  for (const [interfaceFQN, beanNames] of interfaceToImpls.entries()) {
    for (const beanName of beanNames) {
      const reverseInterfaces = beanToInterfaces.get(beanName);
      if (!reverseInterfaces?.has(interfaceFQN)) {
        errors.push(`Missing reverse mapping: ${beanName} → ${interfaceFQN}`);
      }
    }
  }

  // Check interface existence
  for (const interfaceFQN of interfaceToImpls.keys()) {
    if (!interfaces.has(interfaceFQN)) {
      errors.push(`Interface not found in registry: ${interfaceFQN}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

---

## Summary

### New Entities
- `InterfaceDefinition`: Represents indexed interfaces/abstract classes
- `ImplementationRelationship`: Links interfaces to implementing beans
- `InterfaceResolutionResult`: Disambiguation result type
- `DisambiguationContext`: Resolution input context

### Modified Entities
- `BeanDefinition`: Added `implementedInterfaces: string[]` field

### Unchanged Entities
- `BeanInjectionPoint`: No changes needed (already supports interface types)
- `BeanLocation`: No changes (reused as-is)

### Storage
- `InterfaceRegistry`: Central registry with O(1) lookups, ~60KB memory for typical project

All entities designed for TDD implementation with clear validation rules and state transitions.
