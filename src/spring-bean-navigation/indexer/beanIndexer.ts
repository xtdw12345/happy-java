/**
 * Bean indexer - manages indexing of Spring Beans in the workspace
 */

import * as vscode from 'vscode';
import { BeanIndex, IndexStats } from '../models/BeanIndex';
import { BeanMetadataExtractor } from './beanMetadataExtractor';

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
  private context: vscode.ExtensionContext | undefined;
  private workspaceFolders: vscode.WorkspaceFolder[];

  constructor() {
    this.index = new BeanIndex();
    this.metadataExtractor = new BeanMetadataExtractor();
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
      // Remove old entries
      this.index.removeFileEntries(uri.fsPath);

      // Extract metadata
      const result = await this.metadataExtractor.extractFromFile(uri);

      // Add to index
      if (result.definitions.length > 0) {
        this.index.addBeans(result.definitions);
      }
      if (result.injectionPoints.length > 0) {
        this.index.addInjections(result.injectionPoints);
      }
    } catch (error) {
      console.error(`[BeanIndexer] Failed to update file ${uri.fsPath}:`, error);
    }
  }

  removeFile(uri: vscode.Uri): void {
    this.index.removeFileEntries(uri.fsPath);
  }

  getIndex(): BeanIndex {
    return this.index;
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
