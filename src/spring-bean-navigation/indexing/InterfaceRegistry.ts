/**
 * InterfaceRegistry - Central registry for interface-to-implementation mappings
 *
 * This registry maintains bidirectional mappings between interfaces and their
 * bean implementations, enabling O(1) lookups in both directions.
 */

import { InterfaceDefinition, ImplementationRelationship } from '../models/types';
import { BeanDefinition } from '../models/BeanDefinition';

/**
 * Central registry for interface and implementation tracking
 */
export class InterfaceRegistry {
  /** Map: Interface FQN → InterfaceDefinition */
  private interfaces: Map<string, InterfaceDefinition> = new Map();

  /** Map: Interface FQN → BeanDefinition[] (all implementations) */
  private implementations: Map<string, BeanDefinition[]> = new Map();

  /** Map: Bean name → Interface FQN[] (reverse lookup) */
  private beanToInterfaces: Map<string, string[]> = new Map();

  /** Map: Interface FQN → ImplementationRelationship[] (detailed tracking) */
  private relationships: Map<string, ImplementationRelationship[]> = new Map();

  /**
   * Register an interface definition
   *
   * @param interfaceDef Interface definition to register
   */
  registerInterface(interfaceDef: InterfaceDefinition): void {
    this.interfaces.set(interfaceDef.fullyQualifiedName, interfaceDef);
  }

  /**
   * Register a bean as an implementation of an interface
   *
   * @param interfaceFQN Fully qualified name of the interface
   * @param bean Bean definition implementing the interface
   * @param detectionMethod How this implementation was detected
   */
  registerImplementation(
    interfaceFQN: string,
    bean: BeanDefinition,
    detectionMethod: 'implements_clause' | 'bean_return_type' | 'extends_abstract'
  ): void {
    // Add to forward mapping (interface → beans)
    if (!this.implementations.has(interfaceFQN)) {
      this.implementations.set(interfaceFQN, []);
    }
    this.implementations.get(interfaceFQN)!.push(bean);

    // Add to reverse mapping (bean → interfaces)
    if (!this.beanToInterfaces.has(bean.name)) {
      this.beanToInterfaces.set(bean.name, []);
    }
    this.beanToInterfaces.get(bean.name)!.push(interfaceFQN);

    // Add to detailed relationship tracking
    if (!this.relationships.has(interfaceFQN)) {
      this.relationships.set(interfaceFQN, []);
    }
    this.relationships.get(interfaceFQN)!.push({
      interfaceFQN,
      implementingBean: bean,
      detectionMethod,
      indexedAt: Date.now()
    });
  }

  /**
   * Get all bean implementations for an interface
   *
   * @param interfaceFQN Fully qualified name of the interface
   * @returns Array of bean definitions (empty if none found)
   */
  getImplementations(interfaceFQN: string): BeanDefinition[] {
    return this.implementations.get(interfaceFQN) || [];
  }

  /**
   * Get all interfaces implemented by a bean
   *
   * @param beanName Name of the bean
   * @returns Array of interface FQNs (empty if none found)
   */
  getInterfaceFor(beanName: string): string[] {
    return this.beanToInterfaces.get(beanName) || [];
  }

  /**
   * Check if an interface is registered
   *
   * @param interfaceFQN Fully qualified name of the interface
   * @returns True if interface is registered
   */
  hasInterface(interfaceFQN: string): boolean {
    return this.interfaces.has(interfaceFQN);
  }

  /**
   * Get all registered interfaces
   *
   * @returns Array of all interface definitions
   */
  getAllInterfaces(): InterfaceDefinition[] {
    return Array.from(this.interfaces.values());
  }

  /**
   * Get detailed implementation relationships for an interface
   *
   * @param interfaceFQN Fully qualified name of the interface
   * @returns Array of implementation relationships
   */
  getRelationships(interfaceFQN: string): ImplementationRelationship[] {
    return this.relationships.get(interfaceFQN) || [];
  }

  /**
   * Clear all registered interfaces and implementations
   */
  clear(): void {
    this.interfaces.clear();
    this.implementations.clear();
    this.beanToInterfaces.clear();
    this.relationships.clear();
  }

  /**
   * Get registry statistics (for debugging and monitoring)
   *
   * @returns Statistics object
   */
  getStats(): {
    interfaceCount: number;
    implementationCount: number;
    averageImplementationsPerInterface: number;
  } {
    const totalImplementations = Array.from(this.implementations.values())
      .reduce((sum, impls) => sum + impls.length, 0);

    return {
      interfaceCount: this.interfaces.size,
      implementationCount: totalImplementations,
      averageImplementationsPerInterface:
        this.interfaces.size > 0 ? totalImplementations / this.interfaces.size : 0
    };
  }

  /**
   * Remove a bean from all interface mappings (used when bean is deleted)
   *
   * @param beanName Name of the bean to remove
   */
  removeBeanImplementations(beanName: string): void {
    const interfaces = this.beanToInterfaces.get(beanName);
    if (!interfaces) {
      return;
    }

    // Remove from each interface's implementation list
    for (const interfaceFQN of interfaces) {
      const impls = this.implementations.get(interfaceFQN);
      if (impls) {
        const filtered = impls.filter(b => b.name !== beanName);
        if (filtered.length > 0) {
          this.implementations.set(interfaceFQN, filtered);
        } else {
          this.implementations.delete(interfaceFQN);
        }
      }

      // Remove from relationships
      const rels = this.relationships.get(interfaceFQN);
      if (rels) {
        const filtered = rels.filter(r => r.implementingBean.name !== beanName);
        if (filtered.length > 0) {
          this.relationships.set(interfaceFQN, filtered);
        } else {
          this.relationships.delete(interfaceFQN);
        }
      }
    }

    // Remove from reverse mapping
    this.beanToInterfaces.delete(beanName);
  }

  /**
   * Remove an interface from registry (used when interface is deleted)
   *
   * @param interfaceFQN Fully qualified name of the interface
   */
  removeInterface(interfaceFQN: string): void {
    // Remove interface definition
    this.interfaces.delete(interfaceFQN);

    // Get all beans implementing this interface
    const beans = this.implementations.get(interfaceFQN) || [];

    // Remove from reverse mappings
    for (const bean of beans) {
      const interfaces = this.beanToInterfaces.get(bean.name);
      if (interfaces) {
        const filtered = interfaces.filter(ifn => ifn !== interfaceFQN);
        if (filtered.length > 0) {
          this.beanToInterfaces.set(bean.name, filtered);
        } else {
          this.beanToInterfaces.delete(bean.name);
        }
      }
    }

    // Remove forward mappings
    this.implementations.delete(interfaceFQN);
    this.relationships.delete(interfaceFQN);
  }
}
