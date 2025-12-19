# 快速入门指南：Spring Bean 导航

**功能**: Spring Bean 导航
**日期**: 2025-12-19
**版本**: 1.0

## 目标读者

本指南面向：
- 参与Spring Bean导航功能开发的工程师
- 需要理解代码架构的代码审查者
- 进行功能测试的QA工程师

## 前置条件

### 必需软件

- **Node.js**: ≥18.x
- **npm**: ≥9.x
- **VS Code**: ≥1.107.0
- **Git**: 任意版本

### 推荐工具

- **VS Code扩展**:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features

## 开发环境设置

### 1. 克隆仓库

```bash
git clone <repository-url>
cd happy-java
```

### 2. 切换到功能分支

```bash
git checkout 002-spring-bean-navigation
```

### 3. 安装依赖

```bash
npm install
```

### 4. 验证TypeScript配置

```bash
# 检查TypeScript配置
npx tsc --showConfig

# 应该看到 "strict": true
```

### 5. 安装Java解析库

```bash
# 安装主要依赖
npm install java-parser

# 验证安装
node -e "console.log(require('java-parser'))"
```

## 项目结构导览

### 功能代码目录

```
src/spring-bean-navigation/
├── index.ts                        # 功能入口
├── providers/                      # VS Code Providers
│   ├── definitionProvider.ts      # 定义跳转
│   └── hoverProvider.ts            # 悬停信息
├── indexer/                        # 索引系统
│   ├── beanIndexer.ts
│   ├── javaParser.ts
│   ├── annotationScanner.ts
│   └── beanMetadataExtractor.ts
├── resolver/                       # Bean解析
│   ├── beanResolver.ts
│   └── qualifierMatcher.ts
├── models/                         # 数据模型
│   ├── BeanDefinition.ts
│   ├── BeanInjectionPoint.ts
│   └── BeanIndex.ts
└── utils/                          # 工具函数
    ├── projectDetector.ts
    └── pathResolver.ts
```

### 测试目录

```
src/test/suite/spring-bean-navigation/
├── definitionProvider.test.ts      # Provider单元测试
├── beanIndexer.test.ts             # 索引器单元测试
├── beanResolver.test.ts            # 解析器单元测试
├── fixtures/                       # 测试数据
│   ├── sample-java-files/
│   └── BeanFactory.ts
└── e2e/                            # E2E测试
    └── navigation.test.ts
```

## 编译和运行

### 编译TypeScript

```bash
# 一次性编译
npm run compile

# 监听模式（推荐开发时使用）
npm run watch
```

### 运行扩展（调试模式）

1. 在VS Code中打开项目
2. 按 `F5` 或点击 "Run > Start Debugging"
3. 这将启动一个新的VS Code窗口（Extension Development Host）
4. 在新窗口中打开一个包含Spring项目的文件夹

### 激活扩展

扩展在以下情况自动激活：
- 打开`.java`文件
- 工作区包含`pom.xml`或`build.gradle`
- 工作区包含Spring依赖

手动激活（用于测试）：
1. 打开Command Palette（Ctrl+Shift+P）
2. 输入：`Happy Java: Activate Extension`

## 运行测试

### 运行所有测试

```bash
npm test
```

### 运行特定测试文件

```bash
npm test -- --grep "BeanIndexer"
```

### 运行测试并查看覆盖率

```bash
npm run test:coverage
```

期望覆盖率：≥80%

### E2E测试

```bash
npm run test:e2e
```

## 调试技巧

### 调试扩展代码

1. 在代码中设置断点（点击行号左侧）
2. 按`F5`启动调试
3. 在Extension Development Host中触发功能
4. VS Code会在断点处暂停

### 调试测试代码

1. 打开测试文件
2. 点击测试函数上方的"Debug Test"链接
3. 或使用Test Explorer面板

### 查看扩展日志

```typescript
// 在代码中添加日志
console.log('[Bean Navigation] Indexing file:', uri.fsPath);

// 查看日志
// 方法1: Output面板 -> 选择 "Extension Host"
// 方法2: Help -> Toggle Developer Tools -> Console
```

### 常见调试场景

#### 场景1: Bean未被识别

```typescript
// 在 annotationScanner.ts 中添加断点
extractAnnotations(cst: any): Annotation[] {
  // 断点位置：检查是否正确提取注解
  const annotations = /* ... */;
  console.log('Extracted annotations:', annotations);
  return annotations;
}
```

#### 场景2: 导航无响应

```typescript
// 在 definitionProvider.ts 中添加断点
provideDefinition(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Definition> {
  console.log('provideDefinition called at:', position);
  // 断点位置：检查是否正确识别注入点
  const injection = this.extractInjectionPoint(document, position);
  console.log('Injection point:', injection);
  // ...
}
```

#### 场景3: 索引未更新

```typescript
// 在 fileWatcher.ts 中添加断点
onDidChange(uri: vscode.Uri) {
  console.log('File changed:', uri.fsPath);
  // 断点位置：验证文件监听是否触发
  this.indexer.updateFile(uri);
}
```

## 关键代码路径说明

### 路径1: 用户点击Bean → 跳转到定义

```
1. 用户Ctrl+点击字段名 "userService"
   ↓
2. VS Code调用 DefinitionProvider.provideDefinition()
   (src/spring-bean-navigation/providers/definitionProvider.ts:25)
   ↓
3. 提取注入点信息
   extractInjectionPoint(document, position)
   ↓
4. 查询Bean索引
   beanResolver.resolve(injection, index)
   (src/spring-bean-navigation/resolver/beanResolver.ts:40)
   ↓
5. 返回候选Bean列表
   ↓
6. 如果只有1个候选: 直接跳转
   如果多个候选: 显示Quick Pick
   ↓
7. VS Code打开目标文件并定位到Bean定义
```

### 路径2: 文件变更 → 增量索引更新

```
1. 用户保存Java文件
   ↓
2. FileSystemWatcher触发onDidChange事件
   (src/spring-bean-navigation/indexer/fileWatcher.ts:50)
   ↓
3. 检查是否需要重新索引
   changeAnalyzer.needsReindex(uri)
   ↓
4. 移除旧索引数据
   index.removeFileEntries(uri.fsPath)
   ↓
5. 解析文件
   javaParser.parseFile(uri)
   (src/spring-bean-navigation/indexer/javaParser.ts:100)
   ↓
6. 更新索引
   index.addBeans(newBeans)
   ↓
7. 追踪依赖并更新受影响文件
   dependencyTracker.getAffectedFiles(uri.fsPath)
```

### 路径3: 扩展激活 → 索引构建

```
1. VS Code激活扩展
   (src/extension.ts:activate())
   ↓
2. 检测Spring项目
   projectDetector.isSpringProject(workspaceFolder)
   ↓
3. 初始化索引器
   indexer.initialize(context, workspaceFolders)
   ↓
4. 尝试加载持久化缓存
   indexer.loadFromPersistentStorage()
   ↓
5. 如果缓存无效，执行全量索引
   indexer.buildFullIndex(showProgress=true)
   (src/spring-bean-navigation/indexer/beanIndexer.ts:150)
   ↓
6. 优先级索引：
   a. 当前打开的文件
   b. 最近修改的文件
   c. 其余文件（后台）
   ↓
7. 注册Definition Provider和Hover Provider
   ↓
8. 设置文件监听器
```

## 测试数据准备

### 创建测试用的Java文件

```bash
# 在测试工作区创建示例文件
mkdir -p test-workspace/src/main/java/com/example

# 创建UserService.java
cat > test-workspace/src/main/java/com/example/UserService.java << 'EOF'
package com.example;

import org.springframework.stereotype.Service;

@Service
public class UserService {
    public void doSomething() {
        System.out.println("Hello");
    }
}
EOF

# 创建UserController.java
cat > test-workspace/src/main/java/com/example/UserController.java << 'EOF'
package com.example;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;

@Controller
public class UserController {
    @Autowired
    private UserService userService;

    public void handleRequest() {
        userService.doSomething();
    }
}
EOF
```

### 使用测试数据工厂

```typescript
// 在测试中使用
import { BeanFactory } from './fixtures/BeanFactory';

describe('BeanResolver', () => {
  it('should resolve bean by type', () => {
    const bean = BeanFactory.createBeanDefinition({
      name: 'userService',
      type: 'com.example.UserService'
    });

    const injection = BeanFactory.createInjectionPoint({
      beanType: 'com.example.UserService'
    });

    const candidates = resolver.resolve(injection, index);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].beanDefinition.name).toBe('userService');
  });
});
```

## 性能分析

### 测量索引构建时间

```typescript
// 在 beanIndexer.ts 中
async buildFullIndex(): Promise<number> {
  const startTime = Date.now();

  // 索引逻辑...

  const endTime = Date.now();
  console.log(`[Performance] Full index built in ${endTime - startTime}ms`);

  return beanCount;
}
```

### 测量内存使用

```typescript
// 获取内存使用情况
const usage = process.memoryUsage();
console.log('Heap used:', (usage.heapUsed / 1024 / 1024).toFixed(2), 'MB');
console.log('Heap total:', (usage.heapTotal / 1024 / 1024).toFixed(2), 'MB');
```

### VS Code性能分析工具

1. 打开Extension Development Host
2. Help -> Toggle Developer Tools
3. Performance标签
4. 点击Record，执行操作，Stop
5. 分析火焰图

## 常见问题排查

### 问题1: 扩展未激活

**症状**: 点击Bean没有反应

**排查步骤**:
1. 检查Output面板 -> Extension Host
2. 确认是否看到 "[Bean Navigation] Activated"
3. 检查`activationEvents`配置（package.json）

**解决方案**:
```json
// package.json
"activationEvents": [
  "onLanguage:java",
  "workspaceContains:**/pom.xml",
  "workspaceContains:**/build.gradle"
]
```

### 问题2: Bean未被索引

**症状**: "未找到Bean定义"错误

**排查步骤**:
1. 检查文件是否在`indexPaths`配置中
2. 查看索引统计: `indexer.getStats()`
3. 手动触发索引: Command Palette -> "Happy Java: Rebuild Index"

**解决方案**:
```typescript
// 添加调试日志
const stats = this.indexer.getStats();
console.log('Index stats:', stats);
// 检查 totalBeans 是否为0
```

### 问题3: 导航到错误的Bean

**症状**: 跳转到错误的实现类

**排查步骤**:
1. 检查Qualifier是否正确解析
2. 验证Primary Bean优先级
3. 查看候选者列表分数

**解决方案**:
```typescript
// 在 beanResolver.ts 中添加日志
resolve(injection, index): BeanCandidate[] {
  const candidates = /* ... */;
  console.log('Candidates:', candidates.map(c => ({
    name: c.beanDefinition.name,
    score: c.matchScore,
    reason: c.matchReason
  })));
  return candidates;
}
```

### 问题4: 性能慢

**症状**: 索引构建超过30秒

**排查步骤**:
1. 检查项目文件数: `find src -name "*.java" | wc -l`
2. 查看是否包含了build目录
3. 检查是否有过多的`@Bean`方法

**解决方案**:
```json
// settings.json - 排除build目录
{
  "happy-java.indexing.excludePatterns": [
    "**/target/**",
    "**/build/**",
    "**/node_modules/**"
  ]
}
```

### 问题5: 内存占用过高

**症状**: VS Code变慢或崩溃

**排查步骤**:
1. 检查内存使用: `memoryManager.getMemoryUsage()`
2. 查看索引大小: `index.getStats().cacheSize`
3. 检查是否触发LRU清理

**解决方案**:
```typescript
// 手动触发清理
memoryManager.evictLRU();

// 或降低缓存大小限制
// settings.json
{
  "happy-java.indexing.maxCacheSize": 15 // MB
}
```

## 配置选项

### 扩展配置

在`.vscode/settings.json`或用户settings中配置：

```json
{
  // 启用/禁用索引
  "happy-java.indexing.enabled": true,

  // 索引路径（相对于工作区根目录）
  "happy-java.indexing.paths": [
    "src/main/java",
    "src/test/java"
  ],

  // 排除模式
  "happy-java.indexing.excludePatterns": [
    "**/target/**",
    "**/build/**",
    "**/.git/**",
    "**/node_modules/**"
  ],

  // 最大缓存大小（MB）
  "happy-java.indexing.maxCacheSize": 20,

  // 文件变更去抖延迟（ms）
  "happy-java.indexing.debounceDelay": 500,

  // 是否在启动时显示索引进度
  "happy-java.indexing.showProgress": true
}
```

## 贡献指南

### 提交代码前检查清单

- [ ] 代码通过ESLint检查: `npm run lint`
- [ ] TypeScript编译无错误: `npm run compile`
- [ ] 所有测试通过: `npm test`
- [ ] 代码覆盖率≥80%: `npm run test:coverage`
- [ ] 添加了JSDoc注释
- [ ] 更新了相关文档

### Git提交消息格式

```bash
# 格式: <type>(<scope>): <subject>

# 示例
feat(indexer): 添加增量索引支持
fix(resolver): 修复Qualifier优先级问题
test(indexer): 添加大文件解析测试
docs(readme): 更新安装说明
```

### 代码审查要点

审查者应检查：
- [ ] 是否符合宪法要求（TypeScript strict, 80%覆盖率）
- [ ] 是否有性能问题（大O复杂度）
- [ ] 错误处理是否完善
- [ ] 是否有内存泄漏风险
- [ ] 日志级别是否合适

## 资源链接

### 项目文档

- [功能规格](./spec.md)
- [实施计划](./plan.md)
- [技术研究](./research.md)
- [数据模型](./data-model.md)
- [API契约](./contracts/bean-index-api.md)

### 外部资源

- [VS Code Extension API](https://code.visualstudio.com/api)
- [java-parser文档](https://www.npmjs.com/package/java-parser)
- [Spring Framework参考文档](https://docs.spring.io/spring-framework/reference/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

### 社区支持

- GitHub Issues: 报告Bug或请求功能
- Discussions: 技术讨论
- Stack Overflow: 标签 `vscode-extension` + `spring-boot`

---

## 下一步

完成环境设置后：

1. **阅读代码**: 从`src/spring-bean-navigation/index.ts`开始
2. **运行测试**: 熟悉测试结构和覆盖范围
3. **尝试调试**: 设置断点并跟踪代码执行
4. **查看任务列表**: `specs/002-spring-bean-navigation/tasks.md`（由`/speckit.tasks`生成）

祝编码愉快！ 🚀
