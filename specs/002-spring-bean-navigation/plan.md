# 实施计划：Spring Bean 导航

**分支**: `002-spring-bean-navigation` | **日期**: 2025-12-19 | **规格**: [spec.md](spec.md)
**输入**: 功能规格来自 `/specs/002-spring-bean-navigation/spec.md`

**注意**: 本文档由 `/speckit.plan` 命令填充。参见 `.specify/templates/commands/plan.md` 了解执行工作流。

## 摘要

本功能实现VS Code扩展，使开发者能够从Spring Bean的使用位置（如@Autowired字段、构造器参数）通过Ctrl+点击快速跳转到Bean的定义位置（@Component、@Service、@Bean方法等）。技术方案采用基于Java AST解析的静态分析，建立Bean索引缓存，通过VS Code的Definition Provider API提供导航能力。核心挑战包括：高效的Java源码解析、Spring注解识别、多Bean候选者处理、以及增量索引更新策略。

## 技术上下文

**语言/版本**: TypeScript 5.9+ with strict mode enabled
**主要依赖**:
- VS Code Extension API ^1.107.0
- @vscode/test-electron (E2E测试)
- java-parser (Java AST解析) 或类似库
- NEEDS CLARIFICATION: Java解析库选择

**存储**:
- 内存中的Bean索引缓存（Map结构）
- VS Code workspace state（索引元数据持久化）
- 无需外部数据库

**测试**:
- @vscode/test-cli, Mocha
- 单元测试：Bean解析逻辑、索引数据结构
- 集成测试：VS Code API交互、文件系统监听
- E2E测试：完整的点击导航流程

**目标平台**: VS Code 1.107.0+ (跨平台: Windows, macOS, Linux)

**项目类型**: VS Code Extension

**性能目标**:
- 扩展激活时间 <200ms
- Bean索引构建 <30秒（1000个Java文件）
- 导航响应时间 <100ms
- 快速选择列表显示 <200ms
- 内存占用 <20MB（索引数据）

**约束条件**:
- Bundle size <5MB
- Memory usage <50MB总量
- TypeScript strict mode
- 80% test coverage
- 仅在检测到Spring项目时激活

**规模/范围**:
- 支持单工作区和多根工作区
- 处理中小型项目（<5000 Java文件）
- 支持Maven/Gradle项目结构

## 宪法检查

*关卡: 必须在Phase 0研究前通过。Phase 1设计后重新检查。*

此功能必须符合 `.specify/memory/constitution.md` 中的所有原则：

### ✅ 初始检查（Phase 0前）

- [x] **代码质量**: TypeScript strict mode已启用，ESLint规则将被遵守，所有公共API将包含JSDoc
- [x] **测试标准**: 将采用TDD方法，测试先行，目标80%覆盖率可实现
- [x] **UX一致性**: 命令遵循`happy-java.goToBeanDefinition`命名约定，错误消息可操作，使用标准Quick Pick UI
- [x] **性能要求**: 激活时间<200ms（仅在Java+Spring项目），导航操作<100ms，索引异步执行

### ✅ 最终检查（Phase 1设计后）

**代码质量与可维护性**:
- [x] TypeScript strict mode: 已在tsconfig.json中启用
- [x] 依赖注入: 所有核心接口（IBeanIndexer, IJavaParser等）使用接口注入，便于测试
- [x] 单一职责: 每个类职责明确（BeanIndexer负责索引，BeanResolver负责解析）
- [x] JSDoc文档: API契约中所有接口都包含完整JSDoc
- [x] 命名常量: 避免magic numbers（如MAX_CACHE_SIZE=20MB, BATCH_SIZE=50）

**测试标准**:
- [x] TDD可实施: data-model.md包含测试数据工厂（BeanFactory）
- [x] 测试覆盖率可达标: 契约中定义了单元测试、集成测试、E2E测试和性能测试
- [x] 测试结构清晰: 测试文件镜像源码结构（src/test/suite/spring-bean-navigation/）

**UX一致性**:
- [x] 命令命名: 遵循VS Code约定（happy-java.goToBeanDefinition）
- [x] 错误消息可操作: 如"未找到Bean定义，请检查Spring配置"（告知原因和解决方向）
- [x] 进度通知: 索引操作超过500ms显示进度（quickstart.md第6章）
- [x] Quick Pick UI: 多Bean候选者使用标准vscode.window.showQuickPick
- [x] 主题兼容: 使用VS Code标准图标库（$(symbol-class)）

**性能要求**:
- [x] 激活时间<200ms: 仅在检测到Spring项目时激活，使用lazy activation events
- [x] 导航操作<100ms: API契约中明确规定（contracts/bean-index-api.md性能契约）
- [x] 索引异步执行: 使用批处理+让出控制权策略（setTimeout(0)），不阻塞UI
- [x] 内存占用<20MB: 实施LRU缓存+周期性清理（data-model.md内存优化策略）
- [x] Bundle size<5MB: java-parser核心仅189KB，总体可控
- [x] 增量索引: 文件级别增量更新+依赖追踪，避免全量重建

### 宪法合规总结

**无违规项** ✅

所有宪法原则均得到满足：
1. **代码质量**: 接口设计清晰，依赖注入，完整文档
2. **测试标准**: TDD策略明确，80%覆盖率可实现，测试分类完整
3. **UX一致性**: 严格遵循VS Code约定，用户体验友好
4. **性能要求**: 所有性能指标均符合宪法要求（<200ms激活，<100ms操作，<20MB内存）

**设计亮点**:
- 使用接口抽象（IBeanIndexer, IJavaParser等）提高可测试性
- 分层架构（providers→resolver→indexer）职责清晰
- 完善的错误处理和降级策略（解析失败不中断）
- 持久化缓存+优先级索引提升用户体验

## 项目结构

### 文档（本功能）

```text
specs/002-spring-bean-navigation/
├── plan.md              # 本文件 (/speckit.plan 命令输出)
├── research.md          # Phase 0 输出 (/speckit.plan 命令)
├── data-model.md        # Phase 1 输出 (/speckit.plan 命令)
├── quickstart.md        # Phase 1 输出 (/speckit.plan 命令)
├── contracts/           # Phase 1 输出 (/speckit.plan 命令)
│   └── bean-index-api.md
└── tasks.md             # Phase 2 输出 (/speckit.tasks 命令 - 不由 /speckit.plan 创建)
```

### 源代码（仓库根目录）

本功能采用**特性模块化组织**，将所有Spring Bean导航相关代码集中在专用目录：

```text
src/
├── spring-bean-navigation/      # 功能主目录
│   ├── index.ts                 # 功能入口，导出provider和indexer
│   ├── providers/               # VS Code providers
│   │   ├── definitionProvider.ts    # 实现DefinitionProvider接口
│   │   └── hoverProvider.ts         # 实现HoverProvider接口（显示Bean信息）
│   ├── indexer/                 # Bean索引系统
│   │   ├── beanIndexer.ts          # 索引管理器
│   │   ├── javaParser.ts           # Java AST解析
│   │   ├── annotationScanner.ts    # Spring注解识别
│   │   └── beanMetadataExtractor.ts # Bean元数据提取
│   ├── resolver/                # Bean解析逻辑
│   │   ├── beanResolver.ts         # Bean查找和候选者解析
│   │   └── qualifierMatcher.ts     # @Qualifier匹配逻辑
│   ├── models/                  # 数据模型
│   │   ├── BeanDefinition.ts       # Bean定义实体
│   │   ├── BeanInjectionPoint.ts   # 注入点实体
│   │   └── BeanIndex.ts            # 索引数据结构
│   └── utils/                   # 工具函数
│       ├── projectDetector.ts      # 检测Spring项目
│       └── pathResolver.ts         # 路径解析
├── extension.ts                 # 扩展主入口（注册功能）
└── test/
    └── suite/
        └── spring-bean-navigation/  # 功能测试
            ├── definitionProvider.test.ts
            ├── beanIndexer.test.ts
            ├── beanResolver.test.ts
            └── e2e/
                └── navigation.test.ts
```

**结构决策**:

选择特性模块化组织而非按类型分层（controllers/services/models）的原因：

1. **高内聚**: Spring Bean导航的所有相关代码集中在一个目录，易于理解和维护
2. **可测试性**: 测试文件镜像源码结构，测试路径清晰
3. **扩展性**: 未来添加其他Java相关功能时可以复制相同模式（如Spring Boot配置导航）
4. **符合VS Code扩展最佳实践**: 功能模块化，避免单体extension.ts文件

## 复杂度追踪

> **仅在宪法检查有违规需要证明时填写**

无违规项。

---

## Phase 0: 技术研究

*此阶段解决所有NEEDS CLARIFICATION标记*

### 研究任务

需要研究以下技术选型和最佳实践：

1. **Java解析库选择** (NEEDS CLARIFICATION)
   - 调研TypeScript/JavaScript中可用的Java解析库
   - 对比性能、准确度、API易用性
   - 验证是否支持Java 8-17语法

2. **Spring注解识别策略**
   - 研究Spring Framework常用注解完整列表
   - 确定注解参数解析方法（如@Qualifier值、@Resource名称）
   - 调研JSR-330 (@Inject) 支持

3. **Bean名称解析规则**
   - 研究Spring默认Bean命名约定（类名首字母小写）
   - @Component(value="...")自定义名称
   - @Bean方法名作为Bean名称的规则

4. **增量索引更新策略**
   - 文件监听API最佳实践
   - 识别文件变更对索引的影响范围
   - 避免过度重新索引

5. **性能优化技术**
   - Worker threads在VS Code扩展中的使用
   - 大型项目的索引分片策略
   - 内存管理和缓存失效策略

### 研究输出

详细研究结果将记录在 [research.md](research.md) 中，包括：
- 每个技术选择的决策和理由
- 考虑的替代方案
- 性能基准测试结果（如适用）

---

## Phase 1: 设计与契约

*前提条件: research.md完成*

### 数据模型设计

核心实体及关系将在 [data-model.md](data-model.md) 中详细定义：

1. **BeanDefinition** - Bean定义实体
2. **BeanInjectionPoint** - 注入点实体
3. **BeanIndex** - 索引容器
4. **BeanCandidate** - Bean候选者（多个实现时）

### API契约

将在 `contracts/` 目录创建：

1. **bean-index-api.md** - Bean索引器的内部API契约
   - 索引构建接口
   - 查询接口
   - 更新接口

### 快速入门指南

[quickstart.md](quickstart.md) 将提供：
- 开发环境设置步骤
- 如何运行测试
- 如何调试扩展
- 关键代码路径说明

---

## 下一步

本计划文档完成后：

1. 运行 `/speckit.tasks` 生成详细任务列表
2. 任务列表将基于用户故事优先级（P1→P2→P3）组织
3. 每个任务将映射到具体文件路径和验收标准
