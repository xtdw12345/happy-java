/**
 * Bean index container - maintains index of all Bean definitions and injection points
 */

import * as vscode from 'vscode';
import { BeanDefinition } from './BeanDefinition';
import { BeanInjectionPoint } from './BeanInjectionPoint';
import { BeanCandidate } from './BeanCandidate';
import { MatchReason } from './types';

/**
 * Index statistics
 */
export interface IndexStats {
  /** Total number of beans indexed */
  totalBeans: number;
  /** Total number of injection points indexed */
  totalInjectionPoints: number;
  /** Number of files indexed */
  indexedFiles: number;
  /** Cache size in bytes */
  cacheSize: number;
  /** Last update timestamp */
  lastUpdated: number;
}

/**
 * Bean index container
 * Maintains efficient lookup structures for beans and injection points
 */
export class BeanIndex {
  /** Beans indexed by type (multiple beans can have same type) */
  private definitionsByType: Map<string, BeanDefinition[]>;

  /** Beans indexed by name (unique) */
  private definitionsByName: Map<string, BeanDefinition>;

  /** Beans indexed by file path */
  private definitionsByFile: Map<string, BeanDefinition[]>;

  /** Injection points indexed by file path */
  private injectionsByFile: Map<string, BeanInjectionPoint[]>;

  /** Last index time */
  private lastIndexTime: number;

  /** Index version for cache validation */
  private version: string;

  constructor() {
    this.definitionsByType = new Map();
    this.definitionsByName = new Map();
    this.definitionsByFile = new Map();
    this.injectionsByFile = new Map();
    this.lastIndexTime = Date.now();
    this.version = '1.0.0';
  }

  /**
   * Find bean definitions by type
   * @param type Fully qualified type name
   * @returns Array of matching bean definitions
   */
  findDefinitionsByType(type: string): BeanDefinition[] {
    return this.definitionsByType.get(type) || [];
  }

  /**
   * Find bean definition by name
   * @param name Bean name
   * @returns Bean definition if found, undefined otherwise
   */
  findDefinitionByName(name: string): BeanDefinition | undefined {
    return this.definitionsByName.get(name);
  }

  /**
   * Find candidate beans for an injection point
   * @param injection Injection point
   * @returns Array of bean candidates, sorted by match score
   */
  findCandidates(injection: BeanInjectionPoint): BeanCandidate[] {
    const candidates: BeanCandidate[] = [];

    // 1. If has @Qualifier, search by qualifier
    if (injection.qualifier) {
      const byQualifier = this.findByQualifier(injection.qualifier, injection.beanType);
      if (byQualifier.length > 0) {
        return byQualifier.map(bean =>
          BeanCandidate.create(bean, MatchReason.EXACT_QUALIFIER)
        );
      }
    }

    // 2. If has explicit bean name, search by name
    if (injection.beanName) {
      const byName = this.definitionsByName.get(injection.beanName);
      if (byName) {
        return [BeanCandidate.create(byName, MatchReason.EXACT_NAME)];
      }
    }

    // 3. Search by type - support both exact match and FQN/simple name matching
    let byType = this.definitionsByType.get(injection.beanType) || [];

    // If no exact match, search through all types for FQN/simple name match
    if (byType.length === 0) {
      byType = this.findByTypeFlexible(injection.beanType);
    }

    // 4. Check for @Primary beans
    const primaryBeans = byType.filter(bean => bean.isPrimary);
    if (primaryBeans.length === 1) {
      return [BeanCandidate.create(primaryBeans[0], MatchReason.PRIMARY_BEAN)];
    }

    // 5. Return all type matches
    byType.forEach(bean => {
      if (bean.isPrimary) {
        candidates.push(BeanCandidate.create(bean, MatchReason.PRIMARY_BEAN));
      } else {
        candidates.push(BeanCandidate.create(bean, MatchReason.TYPE_MATCH));
      }
    });

    return BeanCandidate.sortByScore(candidates);
  }

  /**
   * Find beans by qualifier
   * @param qualifier Qualifier value
   * @param type Optional type filter
   * @returns Array of matching beans
   */
  private findByQualifier(qualifier: string, type?: string): BeanDefinition[] {
    const allBeans = type ? this.findDefinitionsByType(type) : this.getAllBeans();
    return allBeans.filter(bean =>
      bean.qualifiers && bean.qualifiers.includes(qualifier)
    );
  }

  /**
   * Find beans by type with flexible matching (supports both FQN and simple names)
   * @param typeName Type name to search (can be FQN or simple name)
   * @returns Array of matching beans
   */
  private findByTypeFlexible(typeName: string): BeanDefinition[] {
    const matches: BeanDefinition[] = [];

    // Search through all indexed types
    for (const [indexedType, beans] of this.definitionsByType.entries()) {
      if (this.isTypeMatch(indexedType, typeName)) {
        matches.push(...beans);
      }
    }

    return matches;
  }

  /**
   * Check if two type names match (supports FQN and simple name matching)
   * @param type1 First type name
   * @param type2 Second type name
   * @returns True if types match
   */
  private isTypeMatch(type1: string, type2: string): boolean {
    // Exact match
    if (type1 === type2) {
      return true;
    }

    // Check if type2 is a simple name that matches type1's FQN
    // e.g., type1="com.example.UserService", type2="UserService"
    if (type1.endsWith('.' + type2)) {
      return true;
    }

    // Check if type1 is a simple name that matches type2's FQN
    // e.g., type1="UserService", type2="com.example.UserService"
    if (type2.endsWith('.' + type1)) {
      return true;
    }

    return false;
  }

  /**
   * Find files that reference a bean
   * @param beanName Bean name
   * @returns Array of file paths
   */
  findFilesReferencingBean(beanName: string): string[] {
    const files: string[] = [];

    for (const [filePath, injections] of this.injectionsByFile.entries()) {
      const hasReference = injections.some(inj => inj.beanName === beanName);
      if (hasReference) {
        files.push(filePath);
      }
    }

    return files;
  }

  /**
   * Add beans to the index
   * @param beans Array of bean definitions to add
   */
  addBeans(beans: BeanDefinition[]): void {
    for (const bean of beans) {
      // Add to type index
      const typeList = this.definitionsByType.get(bean.type) || [];
      typeList.push(bean);
      this.definitionsByType.set(bean.type, typeList);

      // Add to name index
      this.definitionsByName.set(bean.name, bean);

      // Add to file index
      const filePath = bean.location.uri.fsPath;
      const fileList = this.definitionsByFile.get(filePath) || [];
      fileList.push(bean);
      this.definitionsByFile.set(filePath, fileList);
    }

    this.lastIndexTime = Date.now();
  }

  /**
   * Add injection points to the index
   * @param injections Array of injection points to add
   */
  addInjections(injections: BeanInjectionPoint[]): void {
    for (const injection of injections) {
      const filePath = injection.location.uri.fsPath;
      const fileList = this.injectionsByFile.get(filePath) || [];
      fileList.push(injection);
      this.injectionsByFile.set(filePath, fileList);
    }

    this.lastIndexTime = Date.now();
  }

  /**
   * Remove beans by bean names
   * @param beanNames Array of bean names to remove
   */
  removeBeans(beanNames: string[]): void {
    for (const name of beanNames) {
      const bean = this.definitionsByName.get(name);
      if (!bean) {
        continue;
      }

      // Remove from name index
      this.definitionsByName.delete(name);

      // Remove from type index
      const typeList = this.definitionsByType.get(bean.type);
      if (typeList) {
        const filtered = typeList.filter(b => b.name !== name);
        if (filtered.length === 0) {
          this.definitionsByType.delete(bean.type);
        } else {
          this.definitionsByType.set(bean.type, filtered);
        }
      }

      // Remove from file index
      const filePath = bean.location.uri.fsPath;
      const fileList = this.definitionsByFile.get(filePath);
      if (fileList) {
        const filtered = fileList.filter(b => b.name !== name);
        if (filtered.length === 0) {
          this.definitionsByFile.delete(filePath);
        } else {
          this.definitionsByFile.set(filePath, filtered);
        }
      }
    }

    this.lastIndexTime = Date.now();
  }

  /**
   * Remove all entries for a file
   * @param filePath File path
   */
  removeFileEntries(filePath: string): void {
    // Remove bean definitions
    const beans = this.definitionsByFile.get(filePath) || [];
    const beanNames = beans.map(b => b.name);
    this.removeBeans(beanNames);

    // Remove injection points
    this.injectionsByFile.delete(filePath);

    this.lastIndexTime = Date.now();
  }

  /**
   * Mark a file as dirty (needs reindexing)
   * Currently just removes the file entries
   * @param filePath File path
   */
  markDirty(filePath: string): void {
    this.removeFileEntries(filePath);
  }

  /**
   * Get all beans
   * @returns Array of all bean definitions
   */
  getAllBeans(): BeanDefinition[] {
    return Array.from(this.definitionsByName.values());
  }

  /**
   * Get all injection points
   * @returns Array of all injection points
   */
  getAllInjections(): BeanInjectionPoint[] {
    const all: BeanInjectionPoint[] = [];
    for (const injections of this.injectionsByFile.values()) {
      all.push(...injections);
    }
    return all;
  }

  /**
   * Get injection points for a specific file
   * @param uri File URI
   * @returns Array of injection points in the file, empty if none found
   */
  getInjectionPointsForUri(uri: vscode.Uri): BeanInjectionPoint[] {
    return this.injectionsByFile.get(uri.fsPath) || [];
  }

  /**
   * Get index statistics
   * @returns Index statistics
   */
  getStats(): IndexStats {
    const cacheSize = this.estimateCacheSize();

    return {
      totalBeans: this.definitionsByName.size,
      totalInjectionPoints: this.getAllInjections().length,
      indexedFiles: this.definitionsByFile.size,
      cacheSize,
      lastUpdated: this.lastIndexTime
    };
  }

  /**
   * Estimate cache size in bytes
   * @returns Estimated size in bytes
   */
  private estimateCacheSize(): number {
    // Rough estimation: each bean ~500 bytes, each injection ~300 bytes
    const beanSize = this.definitionsByName.size * 500;
    const injectionSize = this.getAllInjections().length * 300;
    return beanSize + injectionSize;
  }

  /**
   * Clear all index data
   */
  clear(): void {
    this.definitionsByType.clear();
    this.definitionsByName.clear();
    this.definitionsByFile.clear();
    this.injectionsByFile.clear();
    this.lastIndexTime = Date.now();
  }

  /**
   * Get index version
   * @returns Version string
   */
  getVersion(): string {
    return this.version;
  }

  /**
   * Get last index time
   * @returns Timestamp in milliseconds
   */
  getLastIndexTime(): number {
    return this.lastIndexTime;
  }

  /**
   * Serialize index for persistence
   * @returns Serialized index data
   */
  serialize(): SerializedIndex {
    return {
      version: this.version,
      timestamp: this.lastIndexTime,
      definitions: this.getAllBeans(),
      injections: this.getAllInjections()
    };
  }

  /**
   * Deserialize and load index data
   * @param data Serialized index data
   */
  deserialize(data: SerializedIndex): void {
    this.clear();
    this.version = data.version;
    this.lastIndexTime = data.timestamp;
    this.addBeans(data.definitions);
    this.addInjections(data.injections);
  }
}

/**
 * Serialized index format for persistence
 */
export interface SerializedIndex {
  version: string;
  timestamp: number;
  definitions: BeanDefinition[];
  injections: BeanInjectionPoint[];
}
