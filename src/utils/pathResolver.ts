/**
 * Path resolver - resolves file paths in Spring projects
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Path resolver for Spring projects
 */
export class PathResolver {
  /**
   * Resolve source root paths for a workspace folder
   * @param folder Workspace folder
   * @returns Array of source root paths
   */
  async resolveSourceRoots(folder: vscode.WorkspaceFolder): Promise<string[]> {
    const roots: string[] = [];

    // Add Maven standard paths
    roots.push(path.join(folder.uri.fsPath, 'src', 'main', 'java'));
    roots.push(path.join(folder.uri.fsPath, 'src', 'test', 'java'));

    // Add Gradle standard paths  
    roots.push(path.join(folder.uri.fsPath, 'src', 'main', 'kotlin'));

    // Filter to existing directories
    const existing: string[] = [];
    for (const root of roots) {
      try {
        const uri = vscode.Uri.file(root);
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.Directory) {
          existing.push(root);
        }
      } catch (error) {
        // Directory doesn't exist, skip
      }
    }

    return existing;
  }

  /**
   * Convert fully qualified class name to file path
   * @param className Fully qualified class name
   * @param sourceRoot Source root path
   * @returns File path
   */
  classNameToFilePath(className: string, sourceRoot: string): string {
    const relativePath = className.replace(/\./g, path.sep) + '.java';
    return path.join(sourceRoot, relativePath);
  }

  /**
   * Convert file path to fully qualified class name
   * @param filePath File path
   * @param sourceRoot Source root path
   * @returns Fully qualified class name
   */
  filePathToClassName(filePath: string, sourceRoot: string): string {
    const relativePath = path.relative(sourceRoot, filePath);
    const className = relativePath
      .replace(/\.java$/, '')
      .replace(new RegExp(`\\${path.sep}`, 'g'), '.');
    return className;
  }

  /**
   * Extract package name from file path
   * @param filePath File path
   * @param sourceRoot Source root path
   * @returns Package name
   */
  extractPackageName(filePath: string, sourceRoot: string): string {
    const className = this.filePathToClassName(filePath, sourceRoot);
    const lastDot = className.lastIndexOf('.');
    return lastDot >= 0 ? className.substring(0, lastDot) : '';
  }

  /**
   * Check if path is under source root
   * @param filePath File path to check
   * @param sourceRoot Source root path
   * @returns True if under source root
   */
  isUnderSourceRoot(filePath: string, sourceRoot: string): boolean {
    const relative = path.relative(sourceRoot, filePath);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  }
}
