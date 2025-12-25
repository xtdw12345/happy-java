/**
 * Dependency tracker - tracks bean dependencies for incremental updates
 */

export interface DependencyStats {
  totalBeans: number;
  totalFiles: number;
  avgUsagesPerBean: number;
}

export class DependencyTracker {
  private beanToFiles: Map<string, Set<string>>;
  private fileToBeans: Map<string, Set<string>>;

  constructor() {
    this.beanToFiles = new Map();
    this.fileToBeans = new Map();
  }

  recordUsage(beanName: string, usageFile: string): void {
    let files = this.beanToFiles.get(beanName);
    if (!files) {
      files = new Set();
      this.beanToFiles.set(beanName, files);
    }
    files.add(usageFile);

    let beans = this.fileToBeans.get(usageFile);
    if (!beans) {
      beans = new Set();
      this.fileToBeans.set(usageFile, beans);
    }
    beans.add(beanName);
  }

  recordDefinition(beanName: string, definitionFile: string): void {
    // Track definition location
    this.recordUsage(beanName, definitionFile);
  }

  getAffectedFiles(changedFile: string): string[] {
    const beans = this.fileToBeans.get(changedFile);
    if (!beans) {
      return [];
    }

    const affected = new Set<string>();
    for (const bean of beans) {
      const files = this.beanToFiles.get(bean);
      if (files) {
        files.forEach(f => affected.add(f));
      }
    }

    affected.delete(changedFile);
    return Array.from(affected);
  }

  removeFile(filePath: string): void {
    const beans = this.fileToBeans.get(filePath);
    if (beans) {
      for (const bean of beans) {
        const files = this.beanToFiles.get(bean);
        if (files) {
          files.delete(filePath);
        }
      }
    }
    this.fileToBeans.delete(filePath);
  }

  getStats(): DependencyStats {
    const totalBeans = this.beanToFiles.size;
    const totalFiles = this.fileToBeans.size;
    let totalUsages = 0;
    
    for (const files of this.beanToFiles.values()) {
      totalUsages += files.size;
    }

    return {
      totalBeans,
      totalFiles,
      avgUsagesPerBean: totalBeans > 0 ? totalUsages / totalBeans : 0
    };
  }
}
