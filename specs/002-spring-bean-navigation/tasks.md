# Tasks: Spring Bean 导航

**输入**: 设计文档来自 `/specs/002-spring-bean-navigation/`
**前置条件**: plan.md (必需), spec.md (必需), research.md, data-model.md, contracts/

**测试**: 根据宪法要求（Testing Standards），测试是强制性的。所有测试必须在实现前编写（TDD/Red-Green-Refactor循环）并且必须首先失败。

**组织**: 任务按用户故事分组，以实现独立实施和测试每个故事。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行运行（不同文件，无依赖）
- **[Story]**: 该任务所属的用户故事（如 US1, US2, US3）
- 包含描述中的确切文件路径

## Path Conventions

- **VS Code Extension**: `src/`, `src/test/suite/` 在仓库根目录
- 功能模块化：所有Spring Bean导航代码在 `src/spring-bean-navigation/`
- 测试镜像源码结构：`src/test/suite/spring-bean-navigation/`

---

## Phase 1: Setup (项目初始化)

**目的**: 项目初始化和基础结构

- [X] T001 安装java-parser依赖: `npm install java-parser`
- [X] T002 [P] 验证TypeScript strict mode已启用在tsconfig.json
- [X] T003 [P] 创建功能主目录 src/spring-bean-navigation/ 和子目录结构
- [X] T004 [P] 创建测试目录 src/test/suite/spring-bean-navigation/ 和子目录结构
- [X] T005 [P] 在package.json中添加扩展激活事件: onLanguage:java, workspaceContains:**/pom.xml, workspaceContains:**/build.gradle
- [X] T006 [P] 在package.json中添加配置项: happy-java.indexing.enabled, happy-java.indexing.paths, happy-java.indexing.maxCacheSize等
- [X] T007 创建测试数据工厂 src/test/suite/spring-bean-navigation/fixtures/BeanFactory.ts

---

## Phase 2: Foundational (阻塞性前置条件)

**目的**: 核心基础设施，所有用户故事依赖的组件

**⚠️ 关键**: 在任何用户故事工作开始之前，此阶段必须完成

### 数据模型（所有功能依赖）

- [X] T008 [P] 创建BeanLocation接口和类型定义在 src/spring-bean-navigation/models/BeanLocation.ts
- [X] T009 [P] 创建BeanDefinitionType和InjectionType枚举在 src/spring-bean-navigation/models/types.ts
- [X] T010 [P] 创建BeanDefinition接口在 src/spring-bean-navigation/models/BeanDefinition.ts
- [X] T011 [P] 创建BeanInjectionPoint接口在 src/spring-bean-navigation/models/BeanInjectionPoint.ts
- [X] T012 [P] 创建BeanCandidate接口和MatchReason枚举在 src/spring-bean-navigation/models/BeanCandidate.ts
- [X] T013 创建BeanIndex类在 src/spring-bean-navigation/models/BeanIndex.ts（依赖T008-T012）

### 核心解析器（所有功能依赖）

- [X] T014 [P] 创建Java解析器接口 IJavaParser在 src/spring-bean-navigation/indexer/javaParser.ts
- [X] T015 [P] 实现java-parser集成和基础解析逻辑在 src/spring-bean-navigation/indexer/javaParser.ts
- [X] T016 [P] 创建注解扫描器 AnnotationScanner在 src/spring-bean-navigation/indexer/annotationScanner.ts
- [X] T017 [P] 实现Spring注解识别逻辑（@Autowired, @Service等）在 src/spring-bean-navigation/indexer/annotationScanner.ts
- [X] T018 创建Bean元数据提取器在 src/spring-bean-navigation/indexer/beanMetadataExtractor.ts（依赖T016-T017）

### Bean索引器（所有功能依赖）

- [X] T019 创建Bean索引器接口 IBeanIndexer在 src/spring-bean-navigation/indexer/beanIndexer.ts
- [X] T020 实现BeanIndexer核心类（initialize, buildFullIndex, updateFile方法）在 src/spring-bean-navigation/indexer/beanIndexer.ts
- [X] T021 [P] 实现持久化缓存逻辑（saveToPersistentStorage, loadFromPersistentStorage）在 src/spring-bean-navigation/indexer/beanIndexer.ts
- [X] T022 [P] 实现文件监听器 FileWatcher在 src/spring-bean-navigation/indexer/fileWatcher.ts
- [X] T023 [P] 实现依赖追踪器 DependencyTracker在 src/spring-bean-navigation/indexer/dependencyTracker.ts
- [X] T024 [P] 实现内存管理器 MemoryManager（LRU缓存）在 src/spring-bean-navigation/indexer/memoryManager.ts

### Bean解析器（所有功能依赖）

- [X] T025 创建Bean解析器接口 IBeanResolver在 src/spring-bean-navigation/resolver/beanResolver.ts
- [X] T026 实现BeanResolver核心逻辑（resolve, matches方法）在 src/spring-bean-navigation/resolver/beanResolver.ts
- [X] T027 [P] 实现Qualifier匹配器在 src/spring-bean-navigation/resolver/qualifierMatcher.ts

### 工具函数（所有功能依赖）

- [X] T028 [P] 实现项目检测器 ProjectDetector在 src/spring-bean-navigation/utils/projectDetector.ts
- [X] T029 [P] 实现路径解析器 PathResolver在 src/spring-bean-navigation/utils/pathResolver.ts

**检查点**: 基础设施就绪 - 用户故事实施现在可以并行开始

---

## Phase 3: User Story 1 - 从字段注入跳转到Bean定义 (Priority: P1) 🎯 MVP

**目标**: 实现从@Autowired/@Resource字段点击跳转到Bean定义的核心功能

**独立测试**: 打开包含@Autowired字段的Java文件，Ctrl+点击字段名，验证跳转到Bean定义类

### 测试 for User Story 1 (TDD - 写测试 → 失败 → 实现) ⚠️

> **注意: 这些测试必须首先编写，确保它们失败后再实现**

- [ ] T030 [P] [US1] 编写单元测试：字段注入点识别在 src/test/suite/spring-bean-navigation/injectionPointExtractor.test.ts
- [ ] T031 [P] [US1] 编写单元测试：@Autowired注解解析在 src/test/suite/spring-bean-navigation/annotationScanner.test.ts
- [ ] T032 [P] [US1] 编写单元测试：Bean定义索引查询在 src/test/suite/spring-bean-navigation/beanIndex.test.ts
- [ ] T033 [P] [US1] 编写集成测试：Definition Provider字段注入场景在 src/test/suite/spring-bean-navigation/definitionProvider.test.ts
- [ ] T034 [P] [US1] 编写E2E测试：从@Autowired字段跳转到@Service Bean在 src/test/suite/spring-bean-navigation/e2e/fieldInjectionNavigation.test.ts

### 实现 for User Story 1

- [ ] T035 [P] [US1] 在DefinitionProvider中实现provideDefinition方法骨架在 src/spring-bean-navigation/providers/definitionProvider.ts
- [ ] T036 [US1] 实现字段注入点提取逻辑（识别@Autowired/@Resource字段）在 src/spring-bean-navigation/providers/definitionProvider.ts
- [ ] T037 [US1] 实现从字段位置提取BeanInjectionPoint在 src/spring-bean-navigation/providers/definitionProvider.ts
- [ ] T038 [US1] 集成BeanResolver.resolve调用，获取Bean候选者在 src/spring-bean-navigation/providers/definitionProvider.ts
- [ ] T039 [US1] 实现单候选Bean的直接跳转逻辑在 src/spring-bean-navigation/providers/definitionProvider.ts
- [ ] T040 [US1] 在extension.ts中注册DefinitionProvider（仅Java语言）在 src/extension.ts
- [ ] T041 [US1] 添加错误处理：Bean未找到时显示友好错误消息在 src/spring-bean-navigation/providers/definitionProvider.ts
- [ ] T042 [US1] 验证80%代码覆盖率要求已满足（运行npm run test:coverage）

**检查点**: 此时，用户故事1应完全功能并可独立测试

---

## Phase 4: User Story 2 - 从构造器注入跳转到Bean定义 (Priority: P2)

**目标**: 支持从构造器参数点击跳转到Bean定义

**独立测试**: 打开包含构造器注入的类，点击构造器参数名，验证跳转到Bean定义

### 测试 for User Story 2 (TDD - 写测试 → 失败 → 实现) ⚠️

- [ ] T043 [P] [US2] 编写单元测试：构造器注入点识别在 src/test/suite/spring-bean-navigation/injectionPointExtractor.test.ts
- [ ] T044 [P] [US2] 编写单元测试：构造器参数解析在 src/test/suite/spring-bean-navigation/parameterParser.test.ts
- [ ] T045 [P] [US2] 编写集成测试：Definition Provider构造器注入场景在 src/test/suite/spring-bean-navigation/definitionProvider.test.ts
- [ ] T046 [P] [US2] 编写E2E测试：从构造器参数跳转到Bean定义在 src/test/suite/spring-bean-navigation/e2e/constructorInjectionNavigation.test.ts

### 实现 for User Story 2

- [ ] T047 [P] [US2] 在AnnotationScanner中添加构造器参数扫描支持在 src/spring-bean-navigation/indexer/annotationScanner.ts
- [ ] T048 [US2] 在DefinitionProvider中实现构造器参数位置检测在 src/spring-bean-navigation/providers/definitionProvider.ts
- [ ] T049 [US2] 实现从构造器参数提取BeanInjectionPoint在 src/spring-bean-navigation/providers/definitionProvider.ts
- [ ] T050 [US2] 添加@Qualifier支持：构造器参数级别的Qualifier解析在 src/spring-bean-navigation/resolver/qualifierMatcher.ts
- [ ] T051 [US2] 集成构造器注入场景到现有跳转逻辑在 src/spring-bean-navigation/providers/definitionProvider.ts
- [ ] T052 [US2] 验证80%代码覆盖率要求已满足（运行npm run test:coverage）

**检查点**: 此时，用户故事1和2都应独立工作

---

## Phase 5: User Story 3 - 处理多个Bean候选者 (Priority: P2)

**目标**: 当多个Bean匹配时显示Quick Pick选择列表

**独立测试**: 创建接口和多个实现类，在注入点点击，验证显示选择列表

### 测试 for User Story 3 (TDD - 写测试 → 失败 → 实现) ⚠️

- [ ] T053 [P] [US3] 编写单元测试：多Bean候选者查找在 src/test/suite/spring-bean-navigation/beanResolver.test.ts
- [ ] T054 [P] [US3] 编写单元测试：候选者匹配分数计算在 src/test/suite/spring-bean-navigation/beanResolver.test.ts
- [ ] T055 [P] [US3] 编写单元测试：@Primary优先级处理在 src/test/suite/spring-bean-navigation/beanResolver.test.ts
- [ ] T056 [P] [US3] 编写集成测试：Quick Pick UI显示和选择在 src/test/suite/spring-bean-navigation/quickPickIntegration.test.ts
- [ ] T057 [P] [US3] 编写E2E测试：多实现类场景的完整导航流程在 src/test/suite/spring-bean-navigation/e2e/multipleCandidatesNavigation.test.ts

### 实现 for User Story 3

- [ ] T058 [P] [US3] 实现BeanCandidate显示标签格式化逻辑在 src/spring-bean-navigation/models/BeanCandidate.ts
- [ ] T059 [US3] 在BeanResolver中完善候选者匹配分数逻辑（Qualifier=100, Name=90, Primary=80, Type=70）在 src/spring-bean-navigation/resolver/beanResolver.ts
- [ ] T060 [US3] 实现@Primary Bean优先级处理在 src/spring-bean-navigation/resolver/beanResolver.ts
- [ ] T061 [US3] 在DefinitionProvider中实现Quick Pick显示逻辑（多候选者情况）在 src/spring-bean-navigation/providers/definitionProvider.ts
- [ ] T062 [US3] 实现Quick Pick项格式化：显示类名、Bean名称、文件路径在 src/spring-bean-navigation/providers/definitionProvider.ts
- [ ] T063 [US3] 实现用户选择后的跳转逻辑在 src/spring-bean-navigation/providers/definitionProvider.ts
- [ ] T064 [US3] 添加取消选择的处理（用户按Esc）在 src/spring-bean-navigation/providers/definitionProvider.ts
- [ ] T065 [US3] 验证80%代码覆盖率要求已满足（运行npm run test:coverage）

**检查点**: 所有P1和P2用户故事现在应独立功能

---

## Phase 6: User Story 4 - 从@Bean方法使用跳转到定义 (Priority: P3)

**目标**: 支持跳转到@Bean方法定义而非返回类型

**独立测试**: 创建@Configuration类和@Bean方法，在使用处点击，验证跳转到@Bean方法

### 测试 for User Story 4 (TDD - 写测试 → 失败 → 实现) ⚠️

- [ ] T066 [P] [US4] 编写单元测试：@Bean方法识别在 src/test/suite/spring-bean-navigation/annotationScanner.test.ts
- [ ] T067 [P] [US4] 编写单元测试：@Bean方法名称解析在 src/test/suite/spring-bean-navigation/beanMetadataExtractor.test.ts
- [ ] T068 [P] [US4] 编写集成测试：@Configuration类扫描在 src/test/suite/spring-bean-navigation/beanIndexer.test.ts
- [ ] T069 [P] [US4] 编写E2E测试：从@Bean方法定义的Bean使用处跳转到方法在 src/test/suite/spring-bean-navigation/e2e/beanMethodNavigation.test.ts

### 实现 for User Story 4

- [ ] T070 [P] [US4] 在AnnotationScanner中添加@Configuration和@Bean识别在 src/spring-bean-navigation/indexer/annotationScanner.ts
- [ ] T071 [US4] 在BeanMetadataExtractor中实现@Bean方法解析在 src/spring-bean-navigation/indexer/beanMetadataExtractor.ts
- [ ] T072 [US4] 实现@Bean方法名称提取逻辑（方法名或name属性）在 src/spring-bean-navigation/indexer/beanMetadataExtractor.ts
- [ ] T073 [US4] 在BeanIndex中添加@Bean方法定义索引在 src/spring-bean-navigation/models/BeanIndex.ts
- [ ] T074 [US4] 更新BeanResolver以优先返回@Bean方法位置而非类定义在 src/spring-bean-navigation/resolver/beanResolver.ts
- [ ] T075 [US4] 处理多个@Configuration类中同名@Bean方法的场景在 src/spring-bean-navigation/resolver/beanResolver.ts
- [ ] T076 [US4] 验证80%代码覆盖率要求已满足（运行npm run test:coverage）

**检查点**: 所有用户故事现在应独立功能

---

## Phase 7: Polish & Cross-Cutting Concerns

**目的**: 影响多个用户故事的改进

- [ ] T077 [P] 实现Hover Provider显示Bean信息（Bean名称、作用域、定义位置）在 src/spring-bean-navigation/providers/hoverProvider.ts
- [ ] T078 [P] 在extension.ts中注册Hover Provider在 src/extension.ts
- [ ] T079 [P] 实现进度通知：索引操作超过500ms显示"正在索引Spring Bean..."在 src/spring-bean-navigation/indexer/beanIndexer.ts
- [ ] T080 [P] 添加配置支持：读取happy-java.indexing.*配置项在 src/spring-bean-navigation/indexer/beanIndexer.ts
- [ ] T081 [P] 实现性能优化：优先级索引（打开文件 > 最近修改 > 其他）在 src/spring-bean-navigation/indexer/beanIndexer.ts
- [ ] T082 [P] 实现增量索引：文件变更时仅重新索引相关文件在 src/spring-bean-navigation/indexer/beanIndexer.ts
- [ ] T083 [P] 实现错误恢复：解析失败不中断索引过程在 src/spring-bean-navigation/indexer/javaParser.ts
- [ ] T084 [P] 添加日志记录：使用console.log记录关键操作（激活、索引、导航）在所有相关文件
- [ ] T085 [P] 实现边界情况处理：XML配置Bean提示在 src/spring-bean-navigation/providers/definitionProvider.ts
- [ ] T086 [P] 实现边界情况处理：第三方库Bean跳转到jar包类定义在 src/spring-bean-navigation/providers/definitionProvider.ts
- [ ] T087 验证总体代码覆盖率≥80%（运行npm run test:coverage）
- [ ] T088 运行ESLint检查：npm run lint（确保0警告）
- [ ] T089 运行TypeScript编译检查：npm run compile（确保0错误）
- [ ] T090 性能基准测试：验证1000文件索引<30秒在 src/test/suite/spring-bean-navigation/performance/indexing.bench.ts
- [ ] T091 性能基准测试：验证导航响应<100ms在 src/test/suite/spring-bean-navigation/performance/navigation.bench.ts
- [ ] T092 内存占用测试：验证索引内存<20MB在 src/test/suite/spring-bean-navigation/performance/memory.bench.ts
- [ ] T093 手动E2E测试：在真实Spring Boot项目中验证所有用户故事
- [ ] T094 更新README.md：添加功能说明和使用示例
- [ ] T095 更新CHANGELOG.md：记录新功能

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖 - 可立即开始
- **Foundational (Phase 2)**: 依赖Setup完成 - 阻塞所有用户故事
- **User Stories (Phase 3-6)**: 全部依赖Foundational阶段完成
  - 用户故事可并行进行（如果有多个开发者）
  - 或按优先级顺序进行（P1 → P2 → P3）
- **Polish (Phase 7)**: 依赖所有期望的用户故事完成

### User Story Dependencies

- **User Story 1 (P1)**: Foundational完成后可开始 - 对其他故事无依赖
- **User Story 2 (P2)**: Foundational完成后可开始 - 对其他故事无依赖
- **User Story 3 (P2)**: Foundational完成后可开始 - 可能集成US1/US2但应独立可测试
- **User Story 4 (P3)**: Foundational完成后可开始 - 对其他故事无依赖

### Within Each User Story

- 测试必须在实现前编写并失败
- 模型在服务之前
- 服务在providers之前
- 核心实现在集成之前
- 故事完成后再进入下一优先级

### Parallel Opportunities

- Setup阶段所有标记[P]的任务可并行
- Foundational阶段所有标记[P]的任务可并行（在Phase 2内）
- Foundational阶段完成后，所有用户故事可并行开始（如果团队容量允许）
- 每个用户故事内标记[P]的测试可并行
- 每个用户故事内标记[P]的模型可并行
- 不同用户故事可由不同团队成员并行工作

---

## Parallel Example: User Story 1

```bash
# 并行启动User Story 1的所有测试（TDD阶段）:
Task: T030 - 字段注入点识别单元测试
Task: T031 - @Autowired注解解析单元测试
Task: T032 - Bean定义索引查询单元测试
Task: T033 - Definition Provider集成测试
Task: T034 - E2E字段注入导航测试

# 测试全部失败后，并行启动模型和实现:
Task: T035 - DefinitionProvider骨架
Task: T036 - 字段注入点提取
# ...继续实现直到测试通过
```

---

## Implementation Strategy

### MVP First (仅User Story 1)

1. 完成Phase 1: Setup
2. 完成Phase 2: Foundational（关键 - 阻塞所有故事）
3. 完成Phase 3: User Story 1
4. **停止并验证**: 独立测试User Story 1
5. 准备好时部署/演示

### Incremental Delivery

1. 完成Setup + Foundational → 基础就绪
2. 添加User Story 1 → 独立测试 → 部署/演示（MVP!）
3. 添加User Story 2 → 独立测试 → 部署/演示
4. 添加User Story 3 → 独立测试 → 部署/演示
5. 添加User Story 4 → 独立测试 → 部署/演示
6. 每个故事添加价值而不破坏之前的故事

### Parallel Team Strategy

对于多个开发者：

1. 团队一起完成Setup + Foundational
2. Foundational完成后：
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. 故事独立完成并集成

---

## Notes

- [P]任务 = 不同文件，无依赖
- [Story]标签映射任务到特定用户故事以便追溯
- 每个用户故事应独立可完成和测试
- 在实现前验证测试失败
- 每个任务或逻辑组后提交
- 在任何检查点停止以独立验证故事
- 避免：模糊任务、相同文件冲突、破坏独立性的跨故事依赖

---

## Task Count Summary

- **Total Tasks**: 95
- **Setup**: 7 tasks
- **Foundational**: 22 tasks
- **User Story 1 (P1)**: 13 tasks (5 tests + 8 implementation)
- **User Story 2 (P2)**: 10 tasks (4 tests + 6 implementation)
- **User Story 3 (P2)**: 13 tasks (5 tests + 8 implementation)
- **User Story 4 (P3)**: 11 tasks (4 tests + 7 implementation)
- **Polish & Cross-Cutting**: 19 tasks

**Parallel Opportunities**: 约45%的任务可并行执行（标记[P]）

**MVP Scope**: Phase 1 + Phase 2 + Phase 3 (User Story 1) = 42 tasks
