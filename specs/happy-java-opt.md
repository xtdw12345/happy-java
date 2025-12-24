# Happy Java VS Code Extension - Optimization Proposals

**Version**: 1.0
**Date**: 2024-12-24
**Status**: Proposal

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Performance Optimizations](#performance-optimizations)
3. [Architecture Improvements](#architecture-improvements)
4. [Code Structure & Maintainability](#code-structure--maintainability)
5. [Feature Enhancements](#feature-enhancements)
6. [Developer Experience](#developer-experience)
7. [Reliability & Error Handling](#reliability--error-handling)
8. [Testing Improvements](#testing-improvements)
9. [Documentation](#documentation)
10. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

This document proposes comprehensive optimization opportunities for the Happy Java VS Code extension across multiple dimensions: performance, architecture, code quality, and feature completeness. The proposals are prioritized by impact and implementation complexity.

### Priority Matrix

| Priority | Category | Proposals | Impact | Effort |
|----------|----------|-----------|--------|--------|
| **P0** (Critical) | Performance | 3 | High | Medium |
| **P1** (High) | Architecture | 5 | High | High |
| **P1** (High) | Code Quality | 4 | Medium | Medium |
| **P2** (Medium) | Features | 6 | Medium | High |
| **P3** (Low) | Developer Experience | 3 | Low | Low |

### Quick Wins (High Impact, Low Effort)

1. **Configuration Loading** (currently hardcoded defaults)
2. **Incremental Type Resolution** (cache type lookups)
3. **Diagnostic Channel** (structured logging)
4. **Test Coverage Reporting** (already configured, needs CI integration)
5. **API Documentation** (JSDoc completion)

---

## Performance Optimizations

### P0-PERF-001: Parallelize Initial Indexing

**Current Implementation**:
```typescript
// beanIndexer.ts lines 102-110
async buildFullIndex(showProgress: boolean = false): Promise<number> {
  const javaFiles = await this.findAllJavaFiles();
  for (const uri of javaFiles) {
    await this.updateFile(uri);  // Sequential processing
  }
}
```

**Problem**: Initial indexing processes 1000 files in ~100 seconds (100ms per file). Large projects experience long startup delays.

**Proposed Solution**:
```typescript
async buildFullIndex(showProgress: boolean = false): Promise<number> {
  const javaFiles = await this.findAllJavaFiles();
  const batchSize = 10;  // Process 10 files in parallel

  const batches = [];
  for (let i = 0; i < javaFiles.length; i += batchSize) {
    batches.push(javaFiles.slice(i, i + batchSize));
  }

  let processedCount = 0;
  for (const batch of batches) {
    await Promise.all(batch.map(uri => this.updateFile(uri)));
    processedCount += batch.length;

    if (showProgress && progressReporter) {
      progressReporter.report({
        message: `Indexed ${processedCount}/${javaFiles.length} files`,
        increment: (batch.length / javaFiles.length) * 100
      });
    }
  }

  return this.getStats().totalBeans;
}
```

**Benefits**:
- **10x faster indexing**: 100 seconds → ~10 seconds for 1000 files
- Progress reporting maintained
- Controlled concurrency prevents resource exhaustion

**Implementation Complexity**: Low (2-3 hours)

**Risks**:
- Higher memory usage during indexing (mitigated by batch size limit)
- Potential file system contention (mitigated by batch size tuning)

---

### P0-PERF-002: Lazy CST Parsing with Memoization

**Current Implementation**:
```typescript
// javaParser.ts
async getCST(uri: vscode.Uri): any {
  const content = await vscode.workspace.fs.readFile(uri);
  const source = Buffer.from(content).toString('utf-8');
  return parse(source);  // Parses every time
}
```

**Problem**:
- CST parsing cost: ~50-100ms per file
- Re-parsing occurs on every updateFile() call even if content unchanged
- No caching of parsed CST

**Proposed Solution**:
```typescript
class JavaParser {
  private cstCache: Map<string, { cst: any, version: number }> = new Map();

  async getCST(uri: vscode.Uri): Promise<any> {
    const document = await vscode.workspace.openTextDocument(uri);
    const currentVersion = document.version;

    // Check cache
    const cached = this.cstCache.get(uri.fsPath);
    if (cached && cached.version === currentVersion) {
      console.log(`[JavaParser] Cache hit for ${uri.fsPath}`);
      return cached.cst;
    }

    // Parse and cache
    const source = document.getText();
    const cst = parse(source);
    this.cstCache.set(uri.fsPath, { cst, version: currentVersion });

    // Evict old entries (LRU policy)
    if (this.cstCache.size > 100) {
      const firstKey = this.cstCache.keys().next().value;
      this.cstCache.delete(firstKey);
    }

    return cst;
  }

  invalidateCache(uri: vscode.Uri): void {
    this.cstCache.delete(uri.fsPath);
  }
}
```

**Benefits**:
- **50-100ms saved per file** on cache hit
- Significantly faster CodeLens provision for unchanged files
- Reduced CPU usage during file watching

**Cache Hit Rate Estimate**: 80-90% (most files unchanged between reloads)

**Implementation Complexity**: Low (3-4 hours)

**Memory Impact**: ~500KB per cached CST × 100 files = ~50MB (acceptable)

---

### P0-PERF-003: Incremental Type Resolution Caching

**Current Implementation**:
```typescript
// BeanIndex.ts lines 147-185
private findByTypeFlexible(typeName: string): BeanDefinition[] {
  const matches: BeanDefinition[] = [];
  for (const [indexedType, beans] of this.definitionsByType.entries()) {
    if (this.isTypeMatch(indexedType, typeName)) {  // O(n) search
      matches.push(...beans);
    }
  }
  return matches;
}
```

**Problem**:
- Type resolution performs O(n) search through all indexed types
- No caching of resolution results
- Repeated lookups for same type (e.g., "UserService" in multiple files)

**Proposed Solution**:
```typescript
class BeanIndex {
  private typeResolutionCache: Map<string, BeanDefinition[]> = new Map();

  private findByTypeFlexible(typeName: string): BeanDefinition[] {
    // Check cache
    if (this.typeResolutionCache.has(typeName)) {
      return this.typeResolutionCache.get(typeName)!;
    }

    // Perform search
    const matches: BeanDefinition[] = [];
    for (const [indexedType, beans] of this.definitionsByType.entries()) {
      if (this.isTypeMatch(indexedType, typeName)) {
        matches.push(...beans);
      }
    }

    // Cache result
    this.typeResolutionCache.set(typeName, matches);
    return matches;
  }

  addBeans(beans: BeanDefinition[]): void {
    // Existing logic...

    // Invalidate cache for added types
    for (const bean of beans) {
      this.typeResolutionCache.delete(bean.type);
      const simpleName = bean.type.split('.').pop();
      if (simpleName) {
        this.typeResolutionCache.delete(simpleName);
      }
    }
  }

  removeBeans(beanNames: string[]): void {
    // Existing logic...

    // Invalidate cache
    this.typeResolutionCache.clear();  // Conservative invalidation
  }
}
```

**Benefits**:
- **10-50ms saved per CodeLens provision** (avoid O(n) search)
- Dramatically faster CodeLens for files with multiple injections
- **95%+ cache hit rate** for typical usage patterns

**Implementation Complexity**: Low (2-3 hours)

**Trade-offs**:
- Increased memory usage (~10KB per cached type × 100 types = ~1MB)
- Cache invalidation complexity (mitigated by conservative clear on mutation)

---

### P1-PERF-004: Debounced File Watcher with Batching

**Current Issue**: File watcher configuration hardcoded to 500ms debounce, but no batching of multiple rapid changes.

**Proposed Solution**:
```typescript
class FileWatcher {
  private pendingUpdates: Set<vscode.Uri> = new Set();
  private debounceTimer: NodeJS.Timeout | undefined;
  private readonly DEBOUNCE_DELAY = 500;

  onDidChange(uri: vscode.Uri): void {
    this.pendingUpdates.add(uri);

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new timer
    this.debounceTimer = setTimeout(() => {
      this.processBatch();
    }, this.DEBOUNCE_DELAY);
  }

  private async processBatch(): Promise<void> {
    const uris = Array.from(this.pendingUpdates);
    this.pendingUpdates.clear();

    console.log(`[FileWatcher] Processing batch of ${uris.length} files`);

    // Process in parallel with batching
    const batchSize = 5;
    for (let i = 0; i < uris.length; i += batchSize) {
      const batch = uris.slice(i, i + batchSize);
      await Promise.all(batch.map(uri => this.indexer.updateFile(uri)));
    }
  }
}
```

**Benefits**:
- Reduces redundant reindexing during rapid file changes (e.g., format-on-save, git checkout)
- Parallel processing of batched updates
- Configurable debounce delay

**Implementation Complexity**: Medium (4-5 hours)

---

### P2-PERF-005: Streaming Indexing for Large Workspaces

**Problem**: Initial index build loads all files into memory before processing.

**Proposed Solution**:
```typescript
async buildFullIndex(showProgress: boolean = false): Promise<number> {
  const pattern = new vscode.RelativePattern(folder, '**/*.java');
  const fileStream = vscode.workspace.findFiles(pattern, '**/node_modules/**');

  let processedCount = 0;
  const chunkSize = 100;
  const chunks: vscode.Uri[][] = [];
  let currentChunk: vscode.Uri[] = [];

  // Stream files into chunks
  for await (const uri of fileStream) {
    currentChunk.push(uri);
    if (currentChunk.length >= chunkSize) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  // Process chunks with backpressure
  for (const chunk of chunks) {
    await Promise.all(chunk.map(uri => this.updateFile(uri)));
    processedCount += chunk.length;

    // Memory pressure check
    if (this.getStats().cacheSize > MAX_CACHE_SIZE) {
      await this.evictLRU();
    }
  }

  return processedCount;
}
```

**Benefits**:
- **Reduced memory footprint** for large projects (>5000 files)
- Progressive indexing with early availability (first 100 files indexed → partial CodeLens available)
- Memory pressure monitoring

**Implementation Complexity**: High (8-10 hours)

**When to Implement**: If users report performance issues with >5000 file projects

---

## Architecture Improvements

### P1-ARCH-001: Configuration System Implementation

**Current State**: Configuration schema defined in package.json but not loaded in code. Hardcoded defaults used.

**Proposed Solution**:
```typescript
// config/extensionConfig.ts
export interface IndexingConfig {
  enabled: boolean;
  paths: string[];
  excludePatterns: string[];
  maxCacheSize: number;
  debounceDelay: number;
  showProgress: boolean;
}

export class ExtensionConfig {
  private config: vscode.WorkspaceConfiguration;

  constructor() {
    this.config = vscode.workspace.getConfiguration('happy-java');

    // Watch for config changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('happy-java')) {
        this.onConfigChanged();
      }
    });
  }

  getIndexingConfig(): IndexingConfig {
    return {
      enabled: this.config.get('indexing.enabled', true),
      paths: this.config.get('indexing.paths', ['src/main/java', 'src/test/java']),
      excludePatterns: this.config.get('indexing.excludePatterns', [
        '**/target/**', '**/build/**'
      ]),
      maxCacheSize: this.config.get('indexing.maxCacheSize', 20),
      debounceDelay: this.config.get('indexing.debounceDelay', 500),
      showProgress: this.config.get('indexing.showProgress', true)
    };
  }

  private onConfigChanged(): void {
    vscode.window.showInformationMessage(
      'Happy Java configuration changed. Reload window to apply?',
      'Reload', 'Cancel'
    ).then(choice => {
      if (choice === 'Reload') {
        vscode.commands.executeCommand('workbench.action.reloadWindow');
      }
    });
  }
}
```

**Integration**:
```typescript
// extension.ts
const config = new ExtensionConfig();
const indexingConfig = config.getIndexingConfig();

if (!indexingConfig.enabled) {
  console.log('[Happy Java] Indexing disabled by configuration');
  return;
}

beanIndexer = new BeanIndexer(indexingConfig);
```

**Benefits**:
- User-configurable behavior (no code changes needed)
- Disable indexing for non-Spring projects
- Custom include/exclude paths
- Performance tuning (cache size, debounce)

**Implementation Complexity**: Medium (5-6 hours)

---

### P1-ARCH-002: Event-Driven File Watcher Architecture

**Current State**: File watching implemented but not fully integrated. Manual reindexing required.

**Proposed Architecture**:
```typescript
// events/FileWatcherService.ts
export interface FileEvent {
  type: 'created' | 'changed' | 'deleted';
  uri: vscode.Uri;
  timestamp: number;
}

export class FileWatcherService {
  private eventBus: EventEmitter<FileEvent>;
  private fileWatcher: vscode.FileSystemWatcher;

  constructor(private indexer: BeanIndexer) {
    this.eventBus = new EventEmitter();
    this.setupWatcher();
  }

  private setupWatcher(): void {
    // Watch *.java files
    this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.java');

    this.fileWatcher.onDidCreate(uri => {
      this.emit({ type: 'created', uri, timestamp: Date.now() });
    });

    this.fileWatcher.onDidChange(uri => {
      this.emit({ type: 'changed', uri, timestamp: Date.now() });
    });

    this.fileWatcher.onDidDelete(uri => {
      this.emit({ type: 'deleted', uri, timestamp: Date.now() });
    });
  }

  private emit(event: FileEvent): void {
    this.eventBus.emit('fileEvent', event);
    this.handleEvent(event);
  }

  private async handleEvent(event: FileEvent): Promise<void> {
    switch (event.type) {
      case 'created':
      case 'changed':
        await this.indexer.updateFile(event.uri);
        break;
      case 'deleted':
        this.indexer.removeFile(event.uri);
        break;
    }
  }

  onFileEvent(handler: (event: FileEvent) => void): vscode.Disposable {
    this.eventBus.on('fileEvent', handler);
    return new vscode.Disposable(() => {
      this.eventBus.off('fileEvent', handler);
    });
  }
}
```

**Benefits**:
- Automatic reindexing on file changes
- Event bus for extensibility (e.g., trigger diagnostics on file change)
- Structured event handling

**Implementation Complexity**: Medium (6-8 hours)

---

### P1-ARCH-003: Dependency Injection Container

**Problem**: Direct instantiation creates tight coupling and makes testing harder.

**Current**:
```typescript
// extension.ts
const beanIndexer = new BeanIndexer();
const definitionProvider = new SpringBeanDefinitionProvider(beanIndexer);
const codeLensProvider = new SpringBeanCodeLensProvider(beanIndexer);
```

**Proposed Solution**:
```typescript
// di/Container.ts
export class Container {
  private services: Map<string, any> = new Map();

  register<T>(key: string, factory: () => T): void {
    this.services.set(key, factory);
  }

  resolve<T>(key: string): T {
    const factory = this.services.get(key);
    if (!factory) {
      throw new Error(`Service not registered: ${key}`);
    }
    return factory();
  }
}

// di/ServiceRegistration.ts
export function registerServices(container: Container, context: vscode.ExtensionContext) {
  // Config
  container.register('config', () => new ExtensionConfig());

  // Indexer
  container.register('beanIndexer', () => {
    const config = container.resolve<ExtensionConfig>('config');
    return new BeanIndexer(config.getIndexingConfig());
  });

  // Providers
  container.register('definitionProvider', () => {
    const indexer = container.resolve<BeanIndexer>('beanIndexer');
    return new SpringBeanDefinitionProvider(indexer);
  });

  container.register('codeLensProvider', () => {
    const indexer = container.resolve<BeanIndexer>('beanIndexer');
    return new SpringBeanCodeLensProvider(indexer);
  });
}

// extension.ts
const container = new Container();
registerServices(container, context);

const beanIndexer = container.resolve<BeanIndexer>('beanIndexer');
const definitionProvider = container.resolve<SpringBeanDefinitionProvider>('definitionProvider');
```

**Benefits**:
- Loose coupling between components
- Easier testing (mock dependencies via container)
- Centralized service lifecycle management
- Clear dependency graph

**Implementation Complexity**: High (10-12 hours)

**Trade-offs**:
- Increased complexity for small project
- Learning curve for contributors

**Recommendation**: Implement if project grows beyond 20 components.

---

### P1-ARCH-004: Plugin Architecture for Injection Type Extensibility

**Problem**: Adding new injection types requires modifying core code (e.g., Lombok support required changes to BeanMetadataExtractor).

**Proposed Architecture**:
```typescript
// plugins/InjectionExtractorPlugin.ts
export interface InjectionExtractorPlugin {
  name: string;
  priority: number;  // Higher priority runs first

  canHandle(annotations: Annotation[], cst: any): boolean;
  extract(cst: any, uri: vscode.Uri, context: ExtractionContext): BeanInjectionPoint[];
}

// Example: Lombok Plugin
export class LombokPlugin implements InjectionExtractorPlugin {
  name = 'lombok';
  priority = 10;

  canHandle(annotations: Annotation[], cst: any): boolean {
    return this.lombokAnnotationDetector.detectConstructorInjection(annotations) !== null;
  }

  extract(cst: any, uri: vscode.Uri, context: ExtractionContext): BeanInjectionPoint[] {
    const lombokAnnotation = this.lombokAnnotationDetector.detectConstructorInjection(context.annotations);
    if (lombokAnnotation && lombokAnnotation.hasAutowired) {
      return this.lombokInjectionExtractor.extract(cst, uri, lombokAnnotation);
    }
    return [];
  }
}

// BeanMetadataExtractor becomes a plugin coordinator
class BeanMetadataExtractor {
  private plugins: InjectionExtractorPlugin[] = [];

  registerPlugin(plugin: InjectionExtractorPlugin): void {
    this.plugins.push(plugin);
    this.plugins.sort((a, b) => b.priority - a.priority);  // Sort by priority
  }

  private extractInjectionPoints(annotations: Annotation[], uri: vscode.Uri, cst: any): BeanInjectionPoint[] {
    const injectionPoints: BeanInjectionPoint[] = [];

    // Run plugins in priority order
    for (const plugin of this.plugins) {
      if (plugin.canHandle(annotations, cst)) {
        const extracted = plugin.extract(cst, uri, { annotations, cst });
        injectionPoints.push(...extracted);
      }
    }

    // Fallback to explicit annotations (@Autowired)
    injectionPoints.push(...this.extractExplicitInjections(annotations, uri, cst));

    return injectionPoints;
  }
}
```

**Benefits**:
- Future injection types (e.g., Guice @Inject, Dagger) can be added as plugins
- No modification to core BeanMetadataExtractor
- Third-party extensions possible (if extension API exposed)
- Easier testing (test plugins in isolation)

**Implementation Complexity**: High (12-15 hours)

**When to Implement**: If 2+ additional injection type requests received.

---

### P1-ARCH-005: Separate Interface Resolution Registry

**Problem**: InterfaceRegistry mixes data storage with registration logic. No file-level tracking (see beanIndexer.ts line 122 comment).

**Proposed Architecture**:
```typescript
// indexing/InterfaceStore.ts (Pure data storage)
export class InterfaceStore {
  private interfaces: Map<string, InterfaceDefinition> = new Map();
  private implementations: Map<string, Set<string>> = new Map(); // Interface FQN → Bean names
  private fileIndex: Map<string, string[]> = new Map(); // File path → Interface FQNs

  addInterface(interfaceDef: InterfaceDefinition): void {
    this.interfaces.set(interfaceDef.fqn, interfaceDef);

    // Track file
    const filePath = interfaceDef.filePath;
    if (!this.fileIndex.has(filePath)) {
      this.fileIndex.set(filePath, []);
    }
    this.fileIndex.get(filePath)!.push(interfaceDef.fqn);
  }

  addImplementation(interfaceFQN: string, beanName: string): void {
    if (!this.implementations.has(interfaceFQN)) {
      this.implementations.set(interfaceFQN, new Set());
    }
    this.implementations.get(interfaceFQN)!.add(beanName);
  }

  removeFileInterfaces(filePath: string): void {
    const interfaceFQNs = this.fileIndex.get(filePath) || [];
    for (const fqn of interfaceFQNs) {
      this.interfaces.delete(fqn);
      this.implementations.delete(fqn);
    }
    this.fileIndex.delete(filePath);
  }

  getImplementationNames(interfaceFQN: string): string[] {
    const names = this.implementations.get(interfaceFQN);
    return names ? Array.from(names) : [];
  }
}

// indexing/InterfaceRegistry.ts (Business logic)
export class InterfaceRegistry {
  constructor(
    private store: InterfaceStore,
    private beanIndex: BeanIndex
  ) {}

  registerImplementation(interfaceFQN: string, bean: BeanDefinition, source: string): void {
    this.store.addImplementation(interfaceFQN, bean.name);
    console.log(`[InterfaceRegistry] Registered ${bean.name} implements ${interfaceFQN} (${source})`);
  }

  getImplementations(interfaceFQN: string): BeanDefinition[] {
    const beanNames = this.store.getImplementationNames(interfaceFQN);
    return beanNames
      .map(name => this.beanIndex.findDefinitionByName(name))
      .filter((bean): bean is BeanDefinition => bean !== undefined);
  }
}
```

**Benefits**:
- File-level tracking enables proper cleanup on file deletion
- Separation of data storage and business logic
- Easier testing (mock InterfaceStore)
- Fixes TODO at beanIndexer.ts:171

**Implementation Complexity**: Medium (6-8 hours)

---

### P2-ARCH-006: Telemetry & Diagnostics Framework

**Problem**: No visibility into production usage patterns or performance metrics.

**Proposed Solution** (Privacy-Preserving):
```typescript
// telemetry/DiagnosticsCollector.ts
export interface DiagnosticEvent {
  event: string;
  timestamp: number;
  metadata: Record<string, any>;
}

export class DiagnosticsCollector {
  private events: DiagnosticEvent[] = [];
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Happy Java Diagnostics');
  }

  logEvent(event: string, metadata: Record<string, any> = {}): void {
    const diagnostic: DiagnosticEvent = {
      event,
      timestamp: Date.now(),
      metadata: this.sanitize(metadata)
    };

    this.events.push(diagnostic);
    this.outputChannel.appendLine(JSON.stringify(diagnostic));

    // Keep last 1000 events
    if (this.events.length > 1000) {
      this.events.shift();
    }
  }

  private sanitize(metadata: Record<string, any>): Record<string, any> {
    // Remove file paths, user names, etc.
    return {
      ...metadata,
      filePath: metadata.filePath ? '<redacted>' : undefined
    };
  }

  exportDiagnostics(): string {
    return JSON.stringify({
      version: '1.0',
      extension: 'happy-java',
      events: this.events
    }, null, 2);
  }
}

// Usage throughout codebase:
diagnostics.logEvent('indexing.started', { fileCount: javaFiles.length });
diagnostics.logEvent('indexing.completed', { duration: elapsed, beanCount: stats.totalBeans });
diagnostics.logEvent('codelens.provided', { injectionCount: injectionPoints.length });
diagnostics.logEvent('resolution.interface', { status: result.status, candidateCount: result.candidates?.length });
```

**Command**:
```typescript
vscode.commands.registerCommand('happy-java.exportDiagnostics', () => {
  const diagnostics = diagnosticsCollector.exportDiagnostics();
  // Open in new editor
  vscode.workspace.openTextDocument({ content: diagnostics, language: 'json' });
});
```

**Benefits**:
- Performance monitoring (indexing times, resolution times)
- Usage patterns (most common injection types, interface resolution frequency)
- Error tracking (parsing failures, resolution failures)
- **Privacy-preserving**: No PII, no file paths, no telemetry to external servers

**Implementation Complexity**: Low (3-4 hours)

---

## Code Structure & Maintainability

### P1-CODE-001: Extract Common Field/Parameter Parsing Logic

**Problem**: Manual parsing logic duplicated across multiple places (beanCodeLensProvider.ts lines 180-226, 234-280).

**Proposed Solution**:
```typescript
// parsers/JavaSyntaxParser.ts
export interface FieldInfo {
  type: string;
  name: string;
  line: number;
  annotations: string[];
}

export interface ParameterInfo {
  type: string;
  name: string;
  index: number;
  line: number;
  qualifier?: string;
}

export class JavaSyntaxParser {
  parseFieldDeclaration(document: vscode.TextDocument, lineNumber: number): FieldInfo | undefined {
    const line = document.lineAt(lineNumber);
    const text = line.text;

    // Pattern: private/public Type fieldName;
    const fieldPattern = /(private|public|protected)(\s+final)?\s+([\w.]+)\s+(\w+)\s*;/;
    const match = text.match(fieldPattern);

    if (!match) {
      return undefined;
    }

    return {
      type: match[3],
      name: match[4],
      line: lineNumber,
      annotations: this.findAnnotations(document, lineNumber)
    };
  }

  parseConstructorParameters(
    document: vscode.TextDocument,
    startLine: number,
    endLine: number
  ): ParameterInfo[] {
    // Existing logic from beanCodeLensProvider.ts lines 397-457
    // ...
  }

  findAnnotations(document: vscode.TextDocument, lineNumber: number): string[] {
    const annotations: string[] = [];
    for (let i = lineNumber - 1; i >= Math.max(0, lineNumber - 5); i--) {
      const line = document.lineAt(i).text.trim();
      const annotationMatch = line.match(/@(\w+)/);
      if (annotationMatch) {
        annotations.push(annotationMatch[1]);
      }
    }
    return annotations;
  }
}
```

**Usage in CodeLensProvider**:
```typescript
// beanCodeLensProvider.ts
private extractFieldInjectionPoint(document: vscode.TextDocument, lineNumber: number): BeanInjectionPoint | undefined {
  const fieldInfo = this.javaParser.parseFieldDeclaration(document, lineNumber);
  if (!fieldInfo) {
    return undefined;
  }

  // Check for injection annotation
  if (!fieldInfo.annotations.some(a => ['Autowired', 'Resource', 'Inject'].includes(a))) {
    return undefined;
  }

  return {
    injectionType: InjectionType.FIELD,
    beanType: fieldInfo.type,
    location: BeanLocation.fromVSCodePosition(document.uri, new vscode.Position(lineNumber, 0)),
    isRequired: true,
    fieldName: fieldInfo.name
  };
}
```

**Benefits**:
- **DRY principle**: Single source of truth for Java syntax parsing
- Easier testing (test parser in isolation)
- Consistent parsing behavior across components
- Reusable for future features

**Implementation Complexity**: Medium (5-6 hours)

---

### P1-CODE-002: Centralized Error Handling

**Problem**: Error handling inconsistent across components (try-catch with console.error, some return undefined, some throw).

**Proposed Solution**:
```typescript
// errors/ErrorHandler.ts
export enum ErrorSeverity {
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface ExtensionError {
  severity: ErrorSeverity;
  message: string;
  code: string;
  context?: Record<string, any>;
  originalError?: Error;
}

export class ErrorHandler {
  private diagnosticsCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticsCollection = vscode.languages.createDiagnosticCollection('happy-java');
  }

  handle(error: ExtensionError): void {
    // Log to console
    console.error(`[Happy Java] ${error.code}: ${error.message}`, error.context);

    // Show user notification for critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      vscode.window.showErrorMessage(`Happy Java: ${error.message}`);
    } else if (error.severity === ErrorSeverity.ERROR) {
      vscode.window.showWarningMessage(`Happy Java: ${error.message}`);
    }

    // Log to diagnostics
    if (error.context?.uri) {
      this.addDiagnostic(error.context.uri, error);
    }
  }

  private addDiagnostic(uri: vscode.Uri, error: ExtensionError): void {
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 0),
      error.message,
      error.severity === ErrorSeverity.CRITICAL
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning
    );
    diagnostic.source = 'happy-java';
    diagnostic.code = error.code;

    this.diagnosticsCollection.set(uri, [diagnostic]);
  }

  clear(uri: vscode.Uri): void {
    this.diagnosticsCollection.delete(uri);
  }
}

// Usage:
try {
  const cst = await this.javaParser.getCST(uri);
} catch (err) {
  errorHandler.handle({
    severity: ErrorSeverity.ERROR,
    message: 'Failed to parse Java file',
    code: 'PARSE_ERROR',
    context: { uri: uri.fsPath },
    originalError: err as Error
  });
  return emptyResult;
}
```

**Benefits**:
- Consistent error handling across extension
- User-facing diagnostics (Problems panel)
- Better debugging with structured errors
- Graceful degradation

**Implementation Complexity**: Medium (4-5 hours)

---

### P1-CODE-003: Type Utilities Consolidation

**Problem**: Type matching logic duplicated in BeanIndex.ts (lines 166-185) and beanResolver.ts (lines 117-136).

**Proposed Solution**: Consolidate into typeUtils.ts:
```typescript
// utils/typeUtils.ts (extend existing)
export function isTypeMatch(type1: string, type2: string): boolean {
  // Exact match (both FQN or both simple names)
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

export function extractSimpleName(fqn: string): string {
  const parts = fqn.split('.');
  return parts[parts.length - 1];
}

export function extractPackageName(fqn: string): string {
  const lastDotIndex = fqn.lastIndexOf('.');
  return lastDotIndex === -1 ? '' : fqn.substring(0, lastDotIndex);
}
```

**Refactor BeanIndex and BeanResolver**:
```typescript
// BeanIndex.ts
import { isTypeMatch } from '../utils/typeUtils';

private isTypeMatch(type1: string, type2: string): boolean {
  return isTypeMatch(type1, type2);  // Delegate to utility
}

// beanResolver.ts
import { isTypeMatch } from '../utils/typeUtils';

private isTypeMatch(beanType: string, injectionType: string): boolean {
  return isTypeMatch(beanType, injectionType);  // Delegate to utility
}
```

**Benefits**:
- **DRY**: Single implementation of type matching
- Easier to enhance (e.g., add wildcard matching, generic parameter matching)
- Consistent behavior across components

**Implementation Complexity**: Low (1-2 hours)

---

### P1-CODE-004: Improve CST Navigation Helpers

**Problem**: CST navigation code is verbose and error-prone (beanMetadataExtractor.ts lines 245-282).

**Proposed Solution**:
```typescript
// parsers/CSTNavigator.ts
export class CSTNavigator {
  static getPackageName(cst: any): string {
    try {
      const ordinaryCompilationUnit = cst.children?.ordinaryCompilationUnit?.[0];
      const packageDecl = ordinaryCompilationUnit?.children?.packageDeclaration?.[0];
      const identifiers = packageDecl?.children?.Identifier || [];
      return identifiers.map((id: any) => id.image).join('.');
    } catch {
      return '';
    }
  }

  static getClassName(cst: any): string | undefined {
    try {
      const ordinaryCompilationUnit = cst.children?.ordinaryCompilationUnit?.[0];
      const typeDecl = ordinaryCompilationUnit?.children?.typeDeclaration?.[0];
      const classDecl = typeDecl?.children?.classDeclaration?.[0];
      const normalClassDecl = classDecl?.children?.normalClassDeclaration?.[0];
      return normalClassDecl?.children?.typeIdentifier?.[0]?.children?.Identifier?.[0]?.image;
    } catch {
      return undefined;
    }
  }

  static getClassInfo(cst: any): { className: string; fqn: string; packageName: string } | undefined {
    const packageName = this.getPackageName(cst);
    const className = this.getClassName(cst);

    if (!className) {
      return undefined;
    }

    const fqn = packageName ? `${packageName}.${className}` : className;
    return { className, fqn, packageName };
  }

  static getFields(cst: any): any[] {
    // Navigate to fieldDeclaration nodes
    try {
      const ordinaryCompilationUnit = cst.children?.ordinaryCompilationUnit?.[0];
      const typeDecl = ordinaryCompilationUnit?.children?.typeDeclaration?.[0];
      const classDecl = typeDecl?.children?.classDeclaration?.[0];
      const normalClassDecl = classDecl?.children?.normalClassDeclaration?.[0];
      const classBody = normalClassDecl?.children?.classBody?.[0];
      const classBodyDecls = classBody?.children?.classBodyDeclaration || [];

      return classBodyDecls.filter((decl: any) => decl.children?.classMemberDeclaration?.[0]?.children?.fieldDeclaration);
    } catch {
      return [];
    }
  }
}
```

**Usage**:
```typescript
// beanMetadataExtractor.ts
private extractClassInfo(cst: any): { className: string; fullyQualifiedName: string; packageName: string } | undefined {
  const classInfo = CSTNavigator.getClassInfo(cst);
  if (!classInfo) {
    console.log('[BeanMetadataExtractor] Failed to extract class info');
    return undefined;
  }

  return {
    className: classInfo.className,
    fullyQualifiedName: classInfo.fqn,
    packageName: classInfo.packageName
  };
}
```

**Benefits**:
- Cleaner, more readable CST navigation
- Reusable across extractors (Lombok, main extractor)
- Easier to maintain (CST structure changes isolated)

**Implementation Complexity**: Medium (4-5 hours)

---

## Feature Enhancements

### P2-FEAT-001: Spring Profiles Support

**Feature**: Recognize @Profile annotation and filter beans by active profile.

**Proposed Implementation**:
```typescript
// models/BeanDefinition.ts
export interface BeanDefinition {
  // ... existing fields
  profiles?: string[];  // NEW: @Profile("dev", "prod")
}

// Profile configuration
export class ProfileManager {
  private activeProfiles: Set<string> = new Set();

  setActiveProfiles(profiles: string[]): void {
    this.activeProfiles = new Set(profiles);
  }

  isActive(bean: BeanDefinition): boolean {
    if (!bean.profiles || bean.profiles.length === 0) {
      return true;  // No profile restriction
    }

    // Bean is active if any of its profiles matches active profiles
    return bean.profiles.some(profile => this.activeProfiles.has(profile));
  }
}

// BeanResolver integration
resolve(injection: BeanInjectionPoint, index: BeanIndex): BeanCandidate[] {
  let candidates = index.findCandidates(injection);

  // Filter by active profiles
  candidates = candidates.filter(c => this.profileManager.isActive(c.beanDefinition));

  return candidates;
}
```

**Configuration**:
```json
"happy-java.spring.activeProfiles": ["dev", "local"]
```

**Benefits**:
- Accurate bean resolution in multi-profile projects
- Avoids false positives for profile-specific beans

**Implementation Complexity**: Medium (6-8 hours)

**User Impact**: High (common in production Spring apps)

---

### P2-FEAT-002: @Conditional* Annotation Support

**Feature**: Recognize @ConditionalOnProperty, @ConditionalOnClass, etc.

**Proposed Implementation**:
```typescript
// models/BeanDefinition.ts
export interface ConditionalInfo {
  type: 'property' | 'class' | 'bean' | 'missing-bean' | 'expression';
  condition: string;
  matched?: boolean;  // Evaluated at indexing time (if possible)
}

export interface BeanDefinition {
  // ... existing fields
  isConditional: boolean;  // Already exists
  conditionals?: ConditionalInfo[];  // NEW: Details
}

// CodeLens display
"→ UserService (@ConditionalOnProperty: spring.feature.enabled)"
```

**Limitations**:
- Static analysis only (can't evaluate runtime conditions)
- Mark beans as "conditionally available" in CodeLens
- User must verify activation conditions manually

**Implementation Complexity**: High (10-12 hours)

**User Impact**: Medium (helpful for complex conditional configurations)

---

### P2-FEAT-003: Bean Lifecycle Hooks (@PostConstruct, @PreDestroy)

**Feature**: Navigate from @PostConstruct method to bean definition and vice versa.

**Proposed Implementation**:
```typescript
// models/BeanDefinition.ts
export interface BeanDefinition {
  // ... existing fields
  postConstructMethods?: BeanLocation[];
  preDestroyMethods?: BeanLocation[];
}

// Extract lifecycle methods
extractLifecycleMethods(cst: any, uri: vscode.Uri): BeanLocation[] {
  const methods = CSTNavigator.getMethods(cst);
  const postConstructMethods = methods.filter(m =>
    m.annotations.includes('PostConstruct')
  );
  return postConstructMethods.map(m => m.location);
}

// CodeLens on @PostConstruct method
"→ Lifecycle method for UserService bean"
```

**Benefits**:
- Better understanding of bean initialization flow
- Quick navigation between lifecycle methods and bean definitions

**Implementation Complexity**: Medium (6-8 hours)

---

### P2-FEAT-004: Spring Boot Auto-Configuration Analysis

**Feature**: Recognize Spring Boot auto-configuration classes (@EnableAutoConfiguration, META-INF/spring.factories).

**Proposed Implementation**:
```typescript
// indexing/AutoConfigurationExtractor.ts
export class AutoConfigurationExtractor {
  async extractAutoConfigClasses(workspaceFolder: vscode.WorkspaceFolder): Promise<string[]> {
    const springFactoriesFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceFolder, '**/META-INF/spring.factories')
    );

    const autoConfigClasses: string[] = [];
    for (const file of springFactoriesFiles) {
      const content = await vscode.workspace.fs.readFile(file);
      const text = Buffer.from(content).toString('utf-8');

      // Parse spring.factories
      const matches = text.matchAll(/org\.springframework\.boot\.autoconfigure\.EnableAutoConfiguration=\\\n\s*([\w.]+)/g);
      for (const match of matches) {
        autoConfigClasses.push(match[1]);
      }
    }

    return autoConfigClasses;
  }
}

// Mark beans as auto-configured
"→ UserService (Auto-configured)"
```

**Benefits**:
- Understand which beans come from auto-configuration vs. user code
- Debug auto-configuration issues

**Implementation Complexity**: High (10-12 hours)

---

### P2-FEAT-005: Bean Dependency Graph Visualization

**Feature**: Visualize bean dependency graph using VS Code's WebView API.

**Proposed Implementation**:
```typescript
// visualization/BeanGraphPanel.ts
export class BeanGraphPanel {
  private static currentPanel: BeanGraphPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  public static createOrShow(context: vscode.ExtensionContext, beanIndex: BeanIndex) {
    // ... WebView panel creation
  }

  private generateGraphData(beanIndex: BeanIndex): GraphData {
    const beans = beanIndex.getAllBeans();
    const injections = beanIndex.getAllInjections();

    // Build dependency graph
    const nodes = beans.map(bean => ({
      id: bean.name,
      label: bean.type,
      group: bean.annotationType  // @Service, @Repository, etc.
    }));

    const edges = injections.map(injection => ({
      from: this.findContainingBean(injection, beans),
      to: injection.beanType,
      label: injection.fieldName
    }));

    return { nodes, edges };
  }

  private renderGraph(data: GraphData): string {
    // Generate HTML with vis.js or d3.js for graph visualization
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://unpkg.com/vis-network/dist/vis-network.min.js"></script>
      </head>
      <body>
        <div id="graph" style="width: 100%; height: 100vh;"></div>
        <script>
          const data = ${JSON.stringify(data)};
          const container = document.getElementById('graph');
          const network = new vis.Network(container, data, options);
        </script>
      </body>
      </html>
    `;
  }
}

// Command registration
vscode.commands.registerCommand('happy-java.showBeanGraph', () => {
  BeanGraphPanel.createOrShow(context, beanIndexer);
});
```

**Benefits**:
- Visual understanding of bean dependencies
- Identify circular dependencies
- Find orphaned beans

**Implementation Complexity**: High (15-20 hours)

**User Impact**: High (very popular feature in IntelliJ IDEA)

---

### P3-FEAT-006: Smart Refactoring: "Extract to Bean"

**Feature**: Refactor a class to be managed as a Spring bean.

**Proposed Implementation**:
```typescript
// refactorings/ExtractToBeanRefactoring.ts
export async function extractToBean(document: vscode.TextDocument, range: vscode.Range): Promise<void> {
  const className = extractClassName(document, range);

  // Show quick pick for bean stereotype
  const stereotype = await vscode.window.showQuickPick(
    ['@Component', '@Service', '@Repository', '@Controller'],
    { placeHolder: 'Select bean stereotype' }
  );

  if (!stereotype) {
    return;
  }

  // Create WorkspaceEdit
  const edit = new vscode.WorkspaceEdit();

  // Add import
  const importPosition = findImportSection(document);
  edit.insert(document.uri, importPosition, `import org.springframework.stereotype.${stereotype.substring(1)};\n`);

  // Add annotation to class
  const classPosition = findClassDeclaration(document, className);
  edit.insert(document.uri, classPosition, `${stereotype}\n`);

  await vscode.workspace.applyEdit(edit);
  vscode.window.showInformationMessage(`Class ${className} converted to ${stereotype} bean`);
}
```

**Benefits**:
- Faster Spring development workflow
- Consistent annotation usage

**Implementation Complexity**: High (12-15 hours)

---

## Developer Experience

### P3-DX-001: Development Mode with Hot Reload

**Feature**: Detect development mode and enable hot reload of index without restart.

**Proposed Implementation**:
```typescript
// extension.ts
if (context.extensionMode === vscode.ExtensionMode.Development) {
  // Enable hot reload
  vscode.workspace.onDidSaveTextDocument(doc => {
    if (doc.fileName.endsWith('.ts')) {
      vscode.window.showInformationMessage('Extension code changed. Reload to apply?', 'Reload')
        .then(choice => {
          if (choice === 'Reload') {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
          }
        });
    }
  });

  // Enable verbose logging
  console.log('[Happy Java] Running in development mode - verbose logging enabled');
}
```

**Benefits**:
- Faster development iteration
- Clear distinction between dev and production behavior

**Implementation Complexity**: Low (1-2 hours)

---

### P3-DX-002: Command Palette Commands for Testing

**Feature**: Expose testing commands for developers.

**Proposed Commands**:
```typescript
// For testing/debugging
vscode.commands.registerCommand('happy-java.dev.clearCache', async () => {
  await context.workspaceState.update('beanIndex', undefined);
  vscode.window.showInformationMessage('Cache cleared. Reload to rebuild index.');
});

vscode.commands.registerCommand('happy-java.dev.dumpIndex', () => {
  const index = beanIndexer.getIndex();
  const stats = index.getStats();
  const beans = index.getAllBeans();

  const dump = {
    stats,
    beans: beans.slice(0, 10),  // First 10 beans
    timestamp: new Date().toISOString()
  };

  vscode.workspace.openTextDocument({ content: JSON.stringify(dump, null, 2), language: 'json' });
});

vscode.commands.registerCommand('happy-java.dev.profileIndexing', async () => {
  const start = Date.now();
  await beanIndexer.buildFullIndex(false);
  const elapsed = Date.now() - start;

  vscode.window.showInformationMessage(`Indexing took ${elapsed}ms`);
});
```

**Benefits**:
- Easier debugging of indexing issues
- Performance profiling

**Implementation Complexity**: Low (2-3 hours)

---

### P3-DX-003: README with Development Setup

**Current State**: README.md is minimal.

**Proposed Content**:
- Project overview and features
- Development setup (npm install, compilation, debugging)
- Architecture overview (link to happy-java-arch.md)
- Contributing guidelines
- Testing instructions
- Release process

**Implementation Complexity**: Low (3-4 hours)

---

## Reliability & Error Handling

### P1-REL-001: Graceful Degradation for Malformed Java

**Problem**: Parser crashes on invalid Java syntax.

**Proposed Solution**:
```typescript
// javaParser.ts
async getCST(uri: vscode.Uri): Promise<any | undefined> {
  try {
    const content = await vscode.workspace.fs.readFile(uri);
    const source = Buffer.from(content).toString('utf-8');

    // Add timeout to prevent infinite parsing
    const parsePromise = Promise.race([
      Promise.resolve(parse(source)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Parse timeout')), 5000))
    ]);

    return await parsePromise;
  } catch (error) {
    console.error(`[JavaParser] Failed to parse ${uri.fsPath}:`, error);
    errorHandler.handle({
      severity: ErrorSeverity.WARNING,
      message: `Failed to parse Java file: ${path.basename(uri.fsPath)}`,
      code: 'PARSE_ERROR',
      context: { uri: uri.fsPath },
      originalError: error as Error
    });
    return undefined;
  }
}
```

**Benefits**:
- Extension doesn't crash on malformed Java
- User sees warning in Problems panel
- Indexing continues for other files

**Implementation Complexity**: Low (2-3 hours)

---

### P1-REL-002: Index Corruption Detection & Recovery

**Problem**: Corrupted cache can cause extension malfunction.

**Proposed Solution**:
```typescript
// beanIndexer.ts
async loadFromPersistentStorage(): Promise<boolean> {
  if (!this.context) {
    return false;
  }

  try {
    const serialized = this.context.workspaceState.get('beanIndex');
    if (!serialized) {
      return false;
    }

    // Validate version
    const data = serialized as SerializedIndex;
    if (data.version !== this.index.getVersion()) {
      console.log(`[BeanIndexer] Cache version mismatch: ${data.version} vs ${this.index.getVersion()}`);
      return false;
    }

    // Validate structure
    if (!data.definitions || !Array.isArray(data.definitions)) {
      throw new Error('Invalid cache structure: definitions missing or not array');
    }

    if (!data.injections || !Array.isArray(data.injections)) {
      throw new Error('Invalid cache structure: injections missing or not array');
    }

    // Validate data integrity
    for (const def of data.definitions) {
      if (!def.name || !def.type || !def.location) {
        throw new Error(`Invalid bean definition: ${JSON.stringify(def)}`);
      }
    }

    // Deserialize
    this.index.deserialize(data);
    console.log('[BeanIndexer] Index loaded from persistent storage');
    return true;
  } catch (error) {
    console.error('[BeanIndexer] Failed to load index (corrupted cache):', error);

    // Clear corrupted cache
    await this.context.workspaceState.update('beanIndex', undefined);

    // Notify user
    vscode.window.showWarningMessage(
      'Happy Java: Cache corrupted and cleared. Rebuilding index...'
    );

    return false;
  }
}
```

**Benefits**:
- Automatic recovery from corrupted cache
- User notification
- No manual intervention required

**Implementation Complexity**: Low (2-3 hours)

---

### P2-REL-003: Workspace-Specific Cache Isolation

**Problem**: Single cache for all workspaces can cause issues in multi-root workspaces.

**Proposed Solution**:
```typescript
// Use workspace folder hash as cache key
async saveToPersistentStorage(): Promise<void> {
  if (!this.context) {
    return;
  }

  try {
    const workspaceId = this.getWorkspaceId();
    const cacheKey = `beanIndex_${workspaceId}`;

    const serialized = this.index.serialize();
    await this.context.workspaceState.update(cacheKey, serialized);
    console.log(`[BeanIndexer] Index saved to persistent storage (workspace: ${workspaceId})`);
  } catch (error) {
    console.error('[BeanIndexer] Failed to save index:', error);
  }
}

private getWorkspaceId(): string {
  // Generate stable ID from workspace folder paths
  const folderPaths = this.workspaceFolders.map(f => f.uri.fsPath).sort().join('|');
  return createHash('md5').update(folderPaths).digest('hex');
}
```

**Benefits**:
- Correct cache isolation per workspace
- No cross-workspace cache pollution

**Implementation Complexity**: Medium (3-4 hours)

---

## Testing Improvements

### P1-TEST-001: E2E Test Harness Setup

**Problem**: E2E tests are stubs (lombokCodeLensIntegration.test.ts).

**Proposed Solution**:
```typescript
// test/e2e/testSetup.ts
import * as vscode from 'vscode';
import * as path from 'path';

export async function setupTestWorkspace(): Promise<vscode.WorkspaceFolder> {
  const fixturesPath = path.join(__dirname, '../../fixtures');
  const workspaceUri = vscode.Uri.file(fixturesPath);

  // Open workspace
  await vscode.commands.executeCommand('vscode.openFolder', workspaceUri);

  // Wait for extension activation
  await waitForExtensionActivation('happy-java');

  return vscode.workspace.workspaceFolders![0];
}

export async function waitForExtensionActivation(extensionId: string): Promise<void> {
  const extension = vscode.extensions.getExtension(extensionId);
  if (!extension) {
    throw new Error(`Extension ${extensionId} not found`);
  }

  if (!extension.isActive) {
    await extension.activate();
  }

  // Wait for indexing to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
}

export async function waitForCodeLens(document: vscode.TextDocument, timeout: number = 5000): Promise<vscode.CodeLens[]> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const codeLenses = await vscode.commands.executeCommand<vscode.CodeLens[]>(
      'vscode.executeCodeLensProvider',
      document.uri
    );

    if (codeLenses && codeLenses.length > 0) {
      return codeLenses;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`CodeLens did not appear within ${timeout}ms`);
}
```

**Usage in E2E Tests**:
```typescript
// lombokCodeLensIntegration.test.ts
test('[US1] should show CodeLens on @NonNull final field in @RequiredArgsConstructor class', async function() {
  this.timeout(10000);

  const workspace = await setupTestWorkspace();
  const filePath = path.join(workspace.uri.fsPath, 'lombok/RequiredArgsConstructorController.java');
  const document = await vscode.workspace.openTextDocument(filePath);

  // Wait for CodeLens to appear
  const codeLenses = await waitForCodeLens(document);

  // Verify CodeLens on UserService field (line 20)
  const userServiceLens = codeLenses.find(lens => lens.range.start.line === 20);
  assert.ok(userServiceLens, 'CodeLens should appear on UserService field');
  assert.ok(userServiceLens.command?.title.includes('UserService'), 'CodeLens title should mention UserService');
});
```

**Benefits**:
- Complete E2E test coverage
- Automated verification of CodeLens appearance
- Regression prevention

**Implementation Complexity**: High (10-12 hours)

---

### P1-TEST-002: Integration Test for Interface Resolution

**Problem**: Interface resolution tested in isolation (InterfaceResolver.test.ts) but not end-to-end with BeanIndexer.

**Proposed Solution**:
```typescript
// test/suite/spring-bean-navigation/integration/interfaceResolution.integration.test.ts
suite('Interface Resolution Integration Tests', () => {
  let beanIndexer: BeanIndexer;
  let mockContext: vscode.ExtensionContext;

  setup(async () => {
    beanIndexer = new BeanIndexer();
    mockContext = createMockContext();
    await beanIndexer.initialize(mockContext, [mockWorkspaceFolder]);
  });

  test('should resolve interface to @Primary bean', async () => {
    // Index fixture files
    const interfaceFile = createFixtureUri('PaymentService.java');  // Interface
    const impl1File = createFixtureUri('PayPalPaymentService.java');  // @Primary
    const impl2File = createFixtureUri('StripePaymentService.java');

    await beanIndexer.updateFile(interfaceFile);
    await beanIndexer.updateFile(impl1File);
    await beanIndexer.updateFile(impl2File);

    // Create injection point
    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'PaymentService',
      location: createMockLocation(),
      isRequired: true,
      fieldName: 'paymentService'
    };

    // Resolve using InterfaceResolver
    const interfaceRegistry = beanIndexer.getInterfaceRegistry();
    const interfaceResolver = new InterfaceResolver();

    const implementations = interfaceRegistry.getImplementations('PaymentService');
    const context: DisambiguationContext = {
      interfaceFQN: 'PaymentService',
      rawType: 'PaymentService',
      candidates: implementations,
      injectionLocation: injection.location
    };

    const result = interfaceResolver.resolve(context);

    // Assert
    assert.strictEqual(result.status, 'primary');
    assert.strictEqual(result.bean?.name, 'payPalPaymentService');
  });
});
```

**Benefits**:
- End-to-end verification of interface resolution
- Tests integration between BeanIndexer, InterfaceRegistry, and InterfaceResolver
- Catches regressions in integration layer

**Implementation Complexity**: Medium (6-8 hours)

---

### P2-TEST-003: Performance Benchmarks

**Proposed Solution**:
```typescript
// test/performance/indexing.perf.test.ts
suite('Indexing Performance Benchmarks', () => {
  test('should index 100 files in <10 seconds', async function() {
    this.timeout(15000);

    const beanIndexer = new BeanIndexer();
    const mockContext = createMockContext();
    await beanIndexer.initialize(mockContext, [mockWorkspaceFolder]);

    // Generate 100 mock Java files
    const files = generateMockJavaFiles(100);

    const start = Date.now();
    for (const file of files) {
      await beanIndexer.updateFile(file.uri);
    }
    const elapsed = Date.now() - start;

    console.log(`[Perf] Indexed 100 files in ${elapsed}ms`);
    assert.ok(elapsed < 10000, `Indexing took ${elapsed}ms, expected <10000ms`);
  });

  test('should provide CodeLens in <200ms', async function() {
    // ... performance test for CodeLens provision
  });
});
```

**CI Integration**:
```json
// package.json
"scripts": {
  "test:perf": "vscode-test --grep 'Performance Benchmarks'",
  "test:ci": "npm run test && npm run test:perf"
}
```

**Benefits**:
- Automated performance regression detection
- Performance SLO enforcement
- CI integration

**Implementation Complexity**: Medium (5-6 hours)

---

## Documentation

### P2-DOC-001: API Documentation with JSDoc

**Problem**: Limited JSDoc coverage, especially for public APIs.

**Proposed Solution**: Add comprehensive JSDoc to all public APIs:
```typescript
/**
 * Bean indexer - manages indexing of Spring Beans in the workspace
 *
 * The BeanIndexer coordinates indexing operations across the workspace, maintaining
 * an in-memory index of bean definitions and injection points. It provides efficient
 * lookup methods for resolving bean dependencies.
 *
 * @example
 * ```typescript
 * const indexer = new BeanIndexer();
 * await indexer.initialize(context, workspaceFolders);
 * await indexer.buildFullIndex(true);
 *
 * const beanIndex = indexer.getIndex();
 * const candidates = beanIndex.findCandidates(injectionPoint);
 * ```
 *
 * @see {@link BeanIndex} for index data structure
 * @see {@link BeanMetadataExtractor} for extraction logic
 */
export class BeanIndexer implements IBeanIndexer {
  /**
   * Initialize the indexer with workspace context
   *
   * This method must be called before any indexing operations. It sets up the
   * internal state and prepares the indexer for processing Java files.
   *
   * @param context - VS Code extension context for accessing persistent storage
   * @param workspaceFolders - Workspace folders to index
   *
   * @throws {Error} If workspace folders array is empty
   *
   * @example
   * ```typescript
   * const indexer = new BeanIndexer();
   * await indexer.initialize(context, vscode.workspace.workspaceFolders || []);
   * ```
   */
  async initialize(context: vscode.ExtensionContext, workspaceFolders: vscode.WorkspaceFolder[]): Promise<void> {
    // ...
  }
}
```

**Benefits**:
- Better IDE autocomplete and hover info
- Easier for contributors to understand APIs
- Generate API documentation with TypeDoc

**Implementation Complexity**: Medium (8-10 hours for full coverage)

---

### P2-DOC-002: User Guide & Troubleshooting

**Proposed Content**:
- User guide (how to use extension features)
- Troubleshooting guide (common issues and solutions)
- FAQ
- Feature showcase with screenshots
- Configuration reference

**File**: `docs/USER_GUIDE.md`

**Implementation Complexity**: Medium (6-8 hours)

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 weeks)

**Priority**: High-impact, low-effort improvements

1. **P0-PERF-001**: Parallelize Initial Indexing (3h)
2. **P0-PERF-002**: Lazy CST Parsing with Memoization (4h)
3. **P0-PERF-003**: Incremental Type Resolution Caching (3h)
4. **P1-ARCH-001**: Configuration System Implementation (6h)
5. **P1-CODE-003**: Type Utilities Consolidation (2h)
6. **P3-DX-001**: Development Mode with Hot Reload (2h)

**Total Effort**: ~20 hours

**Expected Benefits**:
- 10x faster indexing
- 50-100ms faster CodeLens provision
- User-configurable behavior

---

### Phase 2: Architecture & Reliability (2-3 weeks)

**Priority**: Medium-impact, medium-effort improvements

1. **P1-ARCH-002**: Event-Driven File Watcher Architecture (8h)
2. **P1-CODE-001**: Extract Common Parsing Logic (6h)
3. **P1-CODE-002**: Centralized Error Handling (5h)
4. **P1-REL-001**: Graceful Degradation for Malformed Java (3h)
5. **P1-REL-002**: Index Corruption Detection & Recovery (3h)
6. **P1-TEST-001**: E2E Test Harness Setup (12h)

**Total Effort**: ~37 hours

**Expected Benefits**:
- Automatic reindexing on file changes
- Consistent error handling
- Complete test coverage

---

### Phase 3: Feature Enhancements (3-4 weeks)

**Priority**: Medium-impact, high-effort features

1. **P2-FEAT-001**: Spring Profiles Support (8h)
2. **P2-FEAT-003**: Bean Lifecycle Hooks (8h)
3. **P1-ARCH-004**: Plugin Architecture (15h)
4. **P2-DOC-001**: API Documentation with JSDoc (10h)
5. **P2-DOC-002**: User Guide & Troubleshooting (8h)

**Total Effort**: ~49 hours

**Expected Benefits**:
- Profile-aware bean resolution
- Lifecycle method navigation
- Extensible architecture
- Comprehensive documentation

---

### Phase 4: Advanced Features (4-6 weeks)

**Priority**: Low-impact or experimental

1. **P2-FEAT-005**: Bean Dependency Graph Visualization (20h)
2. **P2-FEAT-004**: Spring Boot Auto-Configuration Analysis (12h)
3. **P1-ARCH-003**: Dependency Injection Container (12h)
4. **P3-FEAT-006**: Smart Refactoring: "Extract to Bean" (15h)

**Total Effort**: ~59 hours

**Expected Benefits**:
- Visual dependency analysis
- Auto-configuration insights
- Refactoring support

---

## Prioritization Criteria

### Impact Score

- **Performance**: Does it improve indexing/resolution speed?
- **User Experience**: Does it reduce friction or add valuable features?
- **Reliability**: Does it prevent errors or improve stability?
- **Maintainability**: Does it improve code quality for contributors?

### Effort Score

- **Low** (<5 hours): Quick wins, minimal risk
- **Medium** (5-10 hours): Moderate complexity, some architectural changes
- **High** (>10 hours): Significant effort, high complexity

### Priority Formula

```
Priority = Impact Score / Effort Score
```

**P0** (Critical): High impact, low-to-medium effort (do first)
**P1** (High): High impact, any effort OR medium impact, low effort
**P2** (Medium): Medium impact, medium-to-high effort
**P3** (Low): Low impact or experimental

---

## Conclusion

This optimization proposal provides a comprehensive roadmap for improving Happy Java across multiple dimensions. The phased approach ensures that high-impact, low-effort improvements are delivered first, followed by more substantial architectural enhancements.

**Recommended Next Steps**:
1. Review and prioritize proposals with stakeholders
2. Implement Phase 1 (Quick Wins) in next sprint
3. Create GitHub issues for each proposal
4. Track progress with milestones

**Total Estimated Effort**: ~165 hours (approximately 4-5 months at 1 developer full-time)

**Expected Outcome**:
- 10x faster indexing performance
- Enhanced reliability and error handling
- Extensible architecture for future features
- Comprehensive documentation and testing
- Production-ready for large Spring projects

---

**Document Version**: 1.0
**Generated**: 2024-12-24
**Author**: Optimization analysis based on codebase inspection and architecture review
