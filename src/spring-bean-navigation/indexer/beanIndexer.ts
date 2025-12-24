/**
 * Bean indexer - manages indexing of Spring Beans in the workspace
 */

import * as vscode from 'vscode';
import { BeanIndex, IndexStats } from '../models/BeanIndex';
import { BeanMetadataExtractor } from './beanMetadataExtractor';
import { InterfaceRegistry } from '../indexing/InterfaceRegistry';
import { InterfaceExtractor } from '../indexing/InterfaceExtractor';

/**
 * Bean indexer interface
 */
export interface IBeanIndexer {
  /**
   * Initialize the indexer
   * @param context VS Code extension context
   * @param workspaceFolders Workspace folders
   */
  initialize(context: vscode.ExtensionContext, workspaceFolders: vscode.WorkspaceFolder[]): Promise<void>;

  /**
   * Build full index
   * @param showProgress Whether to show progress notification
   * @returns Number of beans indexed
   */
  buildFullIndex(showProgress?: boolean): Promise<number>;

  /**
   * Update index for a single file
   * @param uri File URI
   */
  updateFile(uri: vscode.Uri): Promise<void>;

  /**
   * Remove file from index
   * @param uri File URI
   */
  removeFile(uri: vscode.Uri): void;

  /**
   * Get the current index
   * @returns Bean index
   */
  getIndex(): BeanIndex;

  /**
   * Get the interface registry
   * @returns Interface registry
   */
  getInterfaceRegistry(): InterfaceRegistry;

  /**
   * Save index to persistent storage
   */
  saveToPersistentStorage(): Promise<void>;

  /**
   * Load index from persistent storage
   * @returns True if loaded successfully
   */
  loadFromPersistentStorage(): Promise<boolean>;

  /**
   * Get index statistics
   * @returns Index stats
   */
  getStats(): IndexStats;

  /**
   * Dispose and cleanup
   */
  dispose(): void;
}

/**
 * Bean indexer implementation
 */
export class BeanIndexer implements IBeanIndexer {
  private index: BeanIndex;
  private metadataExtractor: BeanMetadataExtractor;
  private interfaceRegistry: InterfaceRegistry;
  private interfaceExtractor: InterfaceExtractor;
  private context: vscode.ExtensionContext | undefined;
  private workspaceFolders: vscode.WorkspaceFolder[];

  constructor() {
    this.index = new BeanIndex();
    this.metadataExtractor = new BeanMetadataExtractor();
    this.interfaceRegistry = new InterfaceRegistry();
    this.interfaceExtractor = new InterfaceExtractor();
    this.workspaceFolders = [];
  }

  async initialize(context: vscode.ExtensionContext, workspaceFolders: vscode.WorkspaceFolder[]): Promise<void> {
    this.context = context;
    this.workspaceFolders = workspaceFolders;

    console.log('[BeanIndexer] Initialized with', workspaceFolders.length, 'workspace folders');
  }

  async buildFullIndex(showProgress: boolean = false): Promise<number> {
    console.log('[BeanIndexer] Building full index...');

    const javaFiles = await this.findAllJavaFiles();
    console.log(`[BeanIndexer] Found ${javaFiles.length} Java files`);

    for (const uri of javaFiles) {
      await this.updateFile(uri);
    }

    const stats = this.getStats();
    console.log(`[BeanIndexer] Indexed ${stats.totalBeans} beans from ${stats.indexedFiles} files`);

    return stats.totalBeans;
  }

  async updateFile(uri: vscode.Uri): Promise<void> {
    try {
      // Remove old entries from both bean index and interface registry
      this.index.removeFileEntries(uri.fsPath);
      // Note: InterfaceRegistry doesn't track files yet, so we can't remove by file
      // This is acceptable for MVP as full reindex will rebuild everything

      // Extract bean metadata
      const result = await this.metadataExtractor.extractFromFile(uri);

      // Add beans to index
      if (result.definitions.length > 0) {
        this.index.addBeans(result.definitions);
      }
      if (result.injectionPoints.length > 0) {
        this.index.addInjections(result.injectionPoints);
      }

      // Extract and register interfaces
      const interfaces = await this.interfaceExtractor.extractInterfaces(uri.fsPath);
      for (const interfaceDef of interfaces) {
        this.interfaceRegistry.registerInterface(interfaceDef);
      }

      // Extract and register implementation relationships
      const implementations = await this.interfaceExtractor.extractImplementedInterfaces(uri.fsPath);
      for (const [className, interfaceFQNs] of implementations.entries()) {
        // Find the bean definition for this class
        const bean = result.definitions.find(b =>
          b.type.endsWith('.' + className) || b.type === className
        );

        if (bean) {
          // Update bean's implementedInterfaces field
          bean.implementedInterfaces = interfaceFQNs;

          // Register each implementation relationship
          for (const interfaceFQN of interfaceFQNs) {
            this.interfaceRegistry.registerImplementation(
              interfaceFQN,
              bean,
              'implements_clause'
            );
          }
        }
      }
    } catch (error) {
      console.error(`[BeanIndexer] Failed to update file ${uri.fsPath}:`, error);
    }
  }

  removeFile(uri: vscode.Uri): void {
    this.index.removeFileEntries(uri.fsPath);
    // TODO: Remove interface entries when InterfaceRegistry supports file tracking
  }

  getIndex(): BeanIndex {
    return this.index;
  }

  getInterfaceRegistry(): InterfaceRegistry {
    return this.interfaceRegistry;
  }

  async saveToPersistentStorage(): Promise<void> {
    if (!this.context) {
      return;
    }

    try {
      const serialized = this.index.serialize();
      await this.context.workspaceState.update('beanIndex', serialized);
      console.log('[BeanIndexer] Index saved to persistent storage');
    } catch (error) {
      console.error('[BeanIndexer] Failed to save index:', error);
    }
  }

  async loadFromPersistentStorage(): Promise<boolean> {
    if (!this.context) {
      return false;
    }

    try {
      const serialized = this.context.workspaceState.get('beanIndex');
      if (serialized) {
        this.index.deserialize(serialized as any);
        console.log('[BeanIndexer] Index loaded from persistent storage');
        return true;
      }
    } catch (error) {
      console.error('[BeanIndexer] Failed to load index:', error);
    }

    return false;
  }

  getStats(): IndexStats {
    return this.index.getStats();
  }

  dispose(): void {
    // Cleanup resources
    console.log('[BeanIndexer] Disposed');
  }

  /**
   * Find all Java files in workspace
   * @returns Array of file URIs
   */
  private async findAllJavaFiles(): Promise<vscode.Uri[]> {
    const javaFiles: vscode.Uri[] = [];

    for (const folder of this.workspaceFolders) {
      const pattern = new vscode.RelativePattern(folder, '**/*.java');
      const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
      javaFiles.push(...files);
    }

    return javaFiles;
  }
}
