/**
 * File watcher - monitors Java file changes for incremental indexing
 */

import * as vscode from 'vscode';

export type FileChangeCallback = (event: FileChangeEvent) => void;

export interface FileChangeEvent {
  type: 'create' | 'change' | 'delete';
  uri: vscode.Uri;
}

export class FileWatcher {
  private watcher: vscode.FileSystemWatcher | undefined;
  private callback: FileChangeCallback | undefined;

  startWatching(callback: FileChangeCallback): void {
    this.callback = callback;
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*.java');

    this.watcher.onDidCreate(uri => this.handleChange('create', uri));
    this.watcher.onDidChange(uri => this.handleChange('change', uri));
    this.watcher.onDidDelete(uri => this.handleChange('delete', uri));

    console.log('[FileWatcher] Started watching Java files');
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.dispose();
      this.watcher = undefined;
    }
    console.log('[FileWatcher] Stopped watching');
  }

  shouldWatch(uri: vscode.Uri): boolean {
    return uri.fsPath.endsWith('.java');
  }

  private handleChange(type: 'create' | 'change' | 'delete', uri: vscode.Uri): void {
    if (this.callback && this.shouldWatch(uri)) {
      this.callback({ type, uri });
    }
  }
}
