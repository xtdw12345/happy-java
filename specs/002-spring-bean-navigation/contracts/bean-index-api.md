# Bean Index API 契约

**功能**: Spring Bean 导航
**日期**: 2025-12-19
**版本**: 1.0

## 概述

本文档定义Bean索引器的内部API契约。这是系统的核心组件，负责：
- 构建和维护Bean索引
- 提供Bean查询接口
- 处理增量更新

所有接口都将在`src/spring-bean-navigation/indexer/`目录中实现。

---

## 1. IBeanIndexer - Bean索引器接口

核心索引器，负责管理整个索引生命周期。

### 接口定义

```typescript
interface IBeanIndexer {
  /**
   * 初始化索引器
   * @param context VS Code扩展上下文
   * @param workspaceFolders 工作区文件夹列表
   */
  initialize(
    context: vscode.ExtensionContext,
    workspaceFolders: vscode.WorkspaceFolder[]
  ): Promise<void>;

  /**
   * 执行全量索引
   * @param showProgress 是否显示进度通知
   * @returns 索引的Bean数量
   */
  buildFullIndex(showProgress?: boolean): Promise<number>;

  /**
   * 更新单个文件的索引
   * @param uri 文件URI
   */
  updateFile(uri: vscode.Uri): Promise<void>;

  /**
   * 移除文件的索引数据
   * @param uri 文件URI
   */
  removeFile(uri: vscode.Uri): void;

  /**
   * 获取当前索引
   * @returns Bean索引对象
   */
  getIndex(): BeanIndex;

  /**
   * 保存索引到持久化存储
   */
  saveToPersistentStorage(): Promise<void>;

  /**
   * 从持久化存储加载索引
   * @returns 是否加载成功
   */
  loadFromPersistentStorage(): Promise<boolean>;

  /**
   * 获取索引统计信息
   */
  getStats(): IndexStats;

  /**
   * 销毁索引器，释放资源
   */
  dispose(): void;
}
```

### 行为契约

#### initialize()

**前置条件**:
- VS Code扩展已激活
- workspaceFolders不为空

**后置条件**:
- 索引器已初始化
- 文件监听器已设置
- 如果存在有效缓存，已加载到内存

**异常**:
- 如果workspaceFolders为空，抛出`Error('No workspace folders found')`

#### buildFullIndex()

**前置条件**:
- 索引器已初始化
- 工作区包含Java文件

**后置条件**:
- 所有Java文件已被解析
- Bean索引已构建完成
- 如果showProgress=true，用户看到进度通知

**性能要求**:
- 1000个文件在30秒内完成
- 内存占用不超过20MB

**异常**:
- 如果解析失败，记录错误但继续处理其他文件
- 如果内存不足，触发LRU缓存清理

#### updateFile()

**前置条件**:
- 索引器已初始化
- uri指向有效的Java文件

**后置条件**:
- 该文件的旧索引数据已移除
- 新的索引数据已添加
- 依赖该文件Bean的其他文件已标记为脏

**性能要求**:
- 单文件更新在100ms内完成

**异常**:
- 如果文件不存在，记录警告但不抛出异常
- 如果解析失败，保留旧数据

---

## 2. IJavaParser - Java解析器接口

负责解析Java源码，提取Bean相关信息。

### 接口定义

```typescript
interface IJavaParser {
  /**
   * 解析Java文件
   * @param uri 文件URI
   * @returns 解析结果，包含Bean定义和注入点
   */
  parseFile(uri: vscode.Uri): Promise<ParseResult>;

  /**
   * 快速扫描文件是否包含Spring注解
   * @param uri 文件URI
   * @returns 扫描结果
   */
  quickScan(uri: vscode.Uri): Promise<QuickScanResult>;
}

interface ParseResult {
  definitions: BeanDefinition[];
  injectionPoints: BeanInjectionPoint[];
  parseErrors: ParseError[];
}

interface QuickScanResult {
  hasSpringAnnotations: boolean;
  hasDefinitions: boolean;
  hasInjections: boolean;
}

interface ParseError {
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
}
```

### 行为契约

#### parseFile()

**前置条件**:
- uri指向存在的Java文件
- 文件可读

**后置条件**:
- 返回ParseResult，即使解析部分失败
- parseErrors包含所有解析错误

**性能要求**:
- 中等文件（~500行）在50ms内完成解析

**异常**:
- 如果文件不存在，抛出`FileNotFoundError`
- 如果文件不可读，抛出`PermissionError`

#### quickScan()

**前置条件**:
- uri指向存在的Java文件

**后置条件**:
- 返回QuickScanResult
- 不执行完整解析（仅正则表达式扫描）

**性能要求**:
- 任何大小文件在10ms内完成

**异常**:
- 如果文件不存在，返回`hasSpringAnnotations: false`

---

## 3. IAnnotationScanner - 注解扫描器接口

扫描和识别Spring注解。

### 接口定义

```typescript
interface IAnnotationScanner {
  /**
   * 从CST中提取注解信息
   * @param cst Java解析树
   * @returns 注解列表
   */
  extractAnnotations(cst: any): Annotation[];

  /**
   * 判断注解是否为Spring Bean定义注解
   */
  isBeanDefinitionAnnotation(annotation: Annotation): boolean;

  /**
   * 判断注解是否为依赖注入注解
   */
  isInjectionAnnotation(annotation: Annotation): boolean;

  /**
   * 提取注解参数值
   * @param annotation 注解对象
   * @param paramName 参数名（如 "name", "value"）
   */
  extractAnnotationParameter(annotation: Annotation, paramName: string): string | undefined;
}

interface Annotation {
  name: string;                    // 如 "@Service"
  fullyQualifiedName: string;      // 如 "org.springframework.stereotype.Service"
  parameters: Map<string, any>;    // 注解参数
  location: BeanLocation;
}
```

### 行为契约

#### isBeanDefinitionAnnotation()

**行为**:
- 识别所有Spring Bean定义注解
- 支持的注解列表:
  ```typescript
  const BEAN_DEFINITION_ANNOTATIONS = [
    '@Component', '@Service', '@Repository', '@Controller', '@RestController',
    '@Configuration', '@Bean'
  ];
  ```

**返回**:
- true: 如果是Bean定义注解
- false: 其他情况

#### isInjectionAnnotation()

**行为**:
- 识别所有依赖注入注解
- 支持的注解列表:
  ```typescript
  const INJECTION_ANNOTATIONS = [
    '@Autowired', '@Resource', '@Inject', '@Qualifier'
  ];
  ```

---

## 4. IBeanResolver - Bean解析器接口

负责解析Bean引用，处理多候选者场景。

### 接口定义

```typescript
interface IBeanResolver {
  /**
   * 查找注入点对应的Bean候选者
   * @param injection 注入点
   * @param index Bean索引
   * @returns Bean候选者列表（按匹配分数降序）
   */
  resolve(injection: BeanInjectionPoint, index: BeanIndex): BeanCandidate[];

  /**
   * 检查Bean是否匹配注入点
   * @param bean Bean定义
   * @param injection 注入点
   * @returns 匹配结果，包含分数和原因
   */
  matches(bean: BeanDefinition, injection: BeanInjectionPoint): MatchResult;
}

interface MatchResult {
  isMatch: boolean;
  score: number;
  reason: MatchReason;
}
```

### 行为契约

#### resolve()

**前置条件**:
- injection是有效的注入点
- index包含所有已索引的Bean

**后置条件**:
- 返回的候选者列表按matchScore降序排列
- 如果没有匹配，返回空数组

**解析规则（按优先级）**:

1. **Qualifier匹配**（分数100）:
   - 如果injection有qualifier
   - 查找qualifiers包含该值的Bean
   - 如果找到，直接返回（不继续查找）

2. **Bean名称匹配**（分数90）:
   - 如果injection有beanName
   - 查找name等于beanName的Bean

3. **Primary Bean优先**（分数80）:
   - 在类型匹配的Bean中
   - 优先返回isPrimary=true的Bean

4. **类型匹配**（分数70）:
   - bean.type === injection.beanType

5. **子类型匹配**（分数60）:
   - bean.type是injection.beanType的子类（需要类型系统支持）

**示例场景**:

```typescript
// 场景1: Qualifier精确匹配
const injection = {
  beanType: 'UserService',
  qualifier: 'primaryUserService'
};
// 预期: 只返回qualifier包含"primaryUserService"的Bean

// 场景2: 无Qualifier，有Primary
const injection2 = {
  beanType: 'UserService'
};
const beans = [
  { name: 'userService1', isPrimary: true },
  { name: 'userService2', isPrimary: false }
];
// 预期: 返回userService1（Primary优先）

// 场景3: 多个候选者，无Primary
const beans3 = [
  { name: 'alipayService', type: 'PaymentService', isPrimary: false },
  { name: 'wechatPayService', type: 'PaymentService', isPrimary: false }
];
// 预期: 返回两个，按字母顺序排列供用户选择
```

---

## 5. IFileWatcher - 文件监听器接口

管理文件系统监听，触发增量索引。

### 接口定义

```typescript
interface IFileWatcher {
  /**
   * 开始监听文件变更
   * @param callback 变更回调函数
   */
  startWatching(callback: FileChangeCallback): void;

  /**
   * 停止监听
   */
  stopWatching(): void;

  /**
   * 检查文件是否应被监听
   * @param uri 文件URI
   */
  shouldWatch(uri: vscode.Uri): boolean;
}

type FileChangeCallback = (event: FileChangeEvent) => void;

interface FileChangeEvent {
  type: 'create' | 'change' | 'delete';
  uri: vscode.Uri;
}
```

### 行为契约

#### shouldWatch()

**行为**:
- 检查文件是否为Java文件（.java后缀）
- 检查文件是否在排除列表中
- 尊重VS Code的`files.watcherExclude`配置

**排除规则**:
```typescript
const DEFAULT_EXCLUDES = [
  '**/node_modules/**',
  '**/target/**',        // Maven
  '**/build/**',         // Gradle
  '**/.git/**',
  '**/out/**',
  '**/*.class'           // 编译文件
];
```

**返回**:
- true: 应该监听该文件
- false: 忽略该文件

---

## 6. IDependencyTracker - 依赖追踪器接口

追踪Bean之间的依赖关系，用于增量更新。

### 接口定义

```typescript
interface IDependencyTracker {
  /**
   * 记录Bean使用关系
   * @param beanName Bean名称
   * @param usageFile 使用该Bean的文件路径
   */
  recordUsage(beanName: string, usageFile: string): void;

  /**
   * 记录Bean定义
   * @param beanName Bean名称
   * @param definitionFile 定义该Bean的文件路径
   */
  recordDefinition(beanName: string, definitionFile: string): void;

  /**
   * 获取受变更文件影响的所有文件
   * @param changedFile 变更的文件路径
   * @returns 受影响的文件路径列表
   */
  getAffectedFiles(changedFile: string): string[];

  /**
   * 移除文件的所有记录
   * @param filePath 文件路径
   */
  removeFile(filePath: string): void;

  /**
   * 获取依赖图统计信息
   */
  getStats(): DependencyStats;
}

interface DependencyStats {
  totalBeans: number;
  totalFiles: number;
  avgUsagesPerBean: number;
}
```

### 行为契约

#### getAffectedFiles()

**前置条件**:
- changedFile已被recordDefinition记录过

**后置条件**:
- 返回所有使用该文件定义的Bean的文件列表

**示例场景**:
```typescript
// UserService.java定义了userService bean
tracker.recordDefinition('userService', 'UserService.java');

// UserController.java使用了userService
tracker.recordUsage('userService', 'UserController.java');

// OrderController.java也使用了userService
tracker.recordUsage('userService', 'OrderController.java');

// 当UserService.java变更时
const affected = tracker.getAffectedFiles('UserService.java');
// 预期: ['UserController.java', 'OrderController.java']
```

---

## 7. IMemoryManager - 内存管理器接口

管理索引的内存使用，实施LRU缓存策略。

### 接口定义

```typescript
interface IMemoryManager {
  /**
   * 记录文件访问
   * @param filePath 文件路径
   */
  recordAccess(filePath: string): void;

  /**
   * 执行LRU清理
   */
  evictLRU(): void;

  /**
   * 失效缓存
   * @param filePath 文件路径
   * @param changeType 变更类型
   */
  invalidateCache(filePath: string, changeType: 'create' | 'change' | 'delete'): void;

  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): MemoryUsage;

  /**
   * 建议垃圾回收
   */
  suggestGC(): void;

  /**
   * 启动周期性清理
   * @param intervalMs 清理间隔（毫秒）
   */
  startPeriodicCleanup(intervalMs: number): NodeJS.Timeout;
}

interface MemoryUsage {
  heapUsed: number;      // bytes
  heapTotal: number;     // bytes
  indexSize: number;     // bytes
  percentage: number;    // 索引占总内存的百分比
}
```

### 行为契约

#### evictLRU()

**前置条件**:
- 索引大小已超过阈值（默认20MB）

**后置条件**:
- 移除最久未访问的20%文件数据
- 索引大小降低到阈值以下

**性能要求**:
- 清理操作在100ms内完成

#### getMemoryUsage()

**后置条件**:
- 返回实时的内存使用情况
- indexSize是估算值（不需要完全精确）

---

## API使用示例

### 完整流程示例

```typescript
// 1. 初始化索引器
const indexer: IBeanIndexer = new BeanIndexer(
  javaParser,
  annotationScanner,
  beanResolver,
  fileWatcher,
  dependencyTracker,
  memoryManager
);

await indexer.initialize(context, workspaceFolders);

// 2. 尝试加载缓存
const cacheLoaded = await indexer.loadFromPersistentStorage();

if (!cacheLoaded) {
  // 3. 执行全量索引
  await indexer.buildFullIndex(true);
}

// 4. 获取索引
const index = indexer.getIndex();

// 5. 查询Bean候选者
const injectionPoint: BeanInjectionPoint = {
  injectionType: InjectionType.FIELD,
  beanType: 'com.example.service.UserService',
  location: currentLocation,
  isRequired: true,
  fieldName: 'userService'
};

const candidates = beanResolver.resolve(injectionPoint, index);

// 6. 处理结果
if (candidates.length === 0) {
  vscode.window.showErrorMessage('未找到Bean定义，请检查Spring配置');
} else if (candidates.length === 1) {
  // 直接跳转
  const location = candidates[0].beanDefinition.location.toVSCodeLocation();
  await vscode.window.showTextDocument(location.uri, { selection: location.range });
} else {
  // 显示Quick Pick
  const selected = await vscode.window.showQuickPick(
    candidates.map(c => ({
      label: c.displayLabel,
      description: c.displayDescription,
      detail: c.displayDetail,
      candidate: c
    }))
  );

  if (selected) {
    const location = selected.candidate.beanDefinition.location.toVSCodeLocation();
    await vscode.window.showTextDocument(location.uri, { selection: location.range });
  }
}

// 7. 文件变更处理
fileWatcher.startWatching(async (event) => {
  if (event.type === 'change') {
    await indexer.updateFile(event.uri);
  } else if (event.type === 'delete') {
    indexer.removeFile(event.uri);
  }
});

// 8. 扩展停用时保存缓存
context.subscriptions.push({
  dispose: async () => {
    await indexer.saveToPersistentStorage();
    indexer.dispose();
  }
});
```

---

## 错误处理契约

### 错误类型

```typescript
// 自定义错误类型
class BeanIndexError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'BeanIndexError';
  }
}

// 具体错误
class ParseError extends BeanIndexError {
  constructor(message: string, public filePath: string, public line: number) {
    super(message, 'PARSE_ERROR');
  }
}

class IndexNotInitializedError extends BeanIndexError {
  constructor() {
    super('Bean index not initialized', 'INDEX_NOT_INITIALIZED');
  }
}

class BeanNotFoundError extends BeanIndexError {
  constructor(beanType: string) {
    super(`Bean not found: ${beanType}`, 'BEAN_NOT_FOUND');
  }
}
```

### 错误处理策略

| 错误类型 | 处理策略 | 用户通知 |
|---------|---------|---------|
| 解析错误 | 记录日志，继续处理其他文件 | 否（除非大量文件失败） |
| 索引未初始化 | 抛出异常，阻止操作 | 是，错误提示 |
| Bean未找到 | 返回空结果 | 是，友好提示 |
| 内存不足 | 触发LRU清理 | 否（自动处理） |
| 文件不存在 | 记录警告，跳过 | 否 |

---

## 性能契约

### 响应时间要求

| 操作 | 目标时间 | 最大时间 |
|------|---------|---------|
| 初始化 | <100ms | <200ms |
| 全量索引（1000文件） | <20s | <30s |
| 单文件更新 | <50ms | <100ms |
| Bean查询 | <50ms | <100ms |
| 快速扫描 | <5ms | <10ms |
| LRU清理 | <50ms | <100ms |

### 内存使用要求

| 指标 | 目标值 | 最大值 |
|------|-------|-------|
| 索引数据 | <15MB | <20MB |
| 总内存 | <40MB | <50MB |
| 单文件缓存 | <100KB | <500KB |

### 可扩展性要求

| 项目规模 | Bean数量 | 索引时间 | 内存占用 |
|---------|---------|---------|---------|
| 小型 | <500 | <5s | <5MB |
| 中型 | <2000 | <20s | <15MB |
| 大型 | <5000 | <60s | <20MB |

---

## 测试契约

### 单元测试要求

每个接口实现必须包含以下测试：

```typescript
describe('IBeanIndexer', () => {
  it('should initialize successfully', async () => {
    // 测试正常初始化
  });

  it('should build full index within time limit', async () => {
    // 测试性能要求
  });

  it('should handle parse errors gracefully', async () => {
    // 测试错误处理
  });

  it('should update file incrementally', async () => {
    // 测试增量更新
  });

  it('should save and load cache correctly', async () => {
    // 测试持久化
  });
});
```

### 集成测试要求

```typescript
describe('Bean Navigation Integration', () => {
  it('should navigate from field injection to bean definition', async () => {
    // E2E测试：字段注入导航
  });

  it('should show quick pick for multiple candidates', async () => {
    // E2E测试：多候选者场景
  });

  it('should handle @Qualifier correctly', async () => {
    // E2E测试：Qualifier优先级
  });
});
```

### 性能测试要求

```typescript
describe('Performance', () => {
  it('should index 1000 files in under 30 seconds', async () => {
    // 性能基准测试
  });

  it('should keep memory under 20MB', async () => {
    // 内存占用测试
  });
});
```

---

## 版本兼容性

### API版本

当前版本：**1.0**

#### 向后兼容策略

- **次版本更新**（1.x）：添加新方法，不修改现有方法签名
- **主版本更新**（2.0）：允许破坏性更改

#### 废弃警告

当方法被废弃时：
```typescript
/**
 * @deprecated 使用 newMethod() 替代，将在2.0版本中移除
 */
oldMethod(): void {
  console.warn('oldMethod is deprecated, use newMethod instead');
  // ...
}
```

---

**下一步**: 创建快速入门指南（quickstart.md）
