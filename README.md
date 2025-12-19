# Happy Java

Happy Java is a Visual Studio Code extension that enhances Java development experience with intelligent Spring Boot Bean navigation.

## Features

### 🚀 Spring Bean Navigation

Navigate effortlessly between Spring Bean injection points and their definitions.

#### CodeLens - Quick Navigation
- **Visual Indicators**: A clickable "→ go to bean definition" link appears above each Bean injection point
- **One-Click Navigation**: Click the CodeLens to jump directly to the Bean definition
- **Multiple Candidates**: If multiple Beans match, a Quick Pick menu lets you choose which one to navigate to

#### Go to Definition (Ctrl+Click)
- **Field Injection**: Navigate from `@Autowired`, `@Resource`, or `@Inject` fields to Bean definitions
- **Constructor Injection**: Navigate from constructor parameters to Bean definitions
- **Smart Resolution**: Automatically handles `@Qualifier`, `@Primary`, and explicit bean names

### Supported Features

✅ **Field Injection**
```java
@Autowired
private UserService userService;  // ← CodeLens appears here
```

✅ **Constructor Injection**
```java
public OrderService(OrderRepository orderRepository) {  // ← CodeLens appears here
    this.orderRepository = orderRepository;
}
```

✅ **Qualifier Support**
```java
@Autowired
@Qualifier("primaryService")
private PaymentService paymentService;  // ← Resolves to qualified Bean
```

✅ **Primary Bean Prioritization**
- Automatically selects `@Primary` Beans when multiple candidates exist

✅ **Multiple Implementations**
- Shows Quick Pick menu when multiple Beans match the same type

## Requirements

- Java project with Spring Boot
- Maven (`pom.xml`) or Gradle (`build.gradle`) in workspace root

## Extension Settings

This extension contributes the following settings:

* `happy-java.indexing.enabled`: Enable/disable Bean indexing (default: `true`)
* `happy-java.indexing.paths`: Include paths for Bean scanning (default: `["src/main/java"]`)
* `happy-java.indexing.excludePaths`: Exclude paths from scanning (default: `["**/test/**", "**/target/**"]`)
* `happy-java.indexing.maxCacheSize`: Maximum cache size in MB (default: `50`)
* `happy-java.indexing.debounceDelay`: Debounce delay for file changes in ms (default: `500`)
* `happy-java.indexing.showProgress`: Show progress notification during indexing (default: `true`)

## Commands

* `Happy Java: Rebuild Bean Index` - Manually rebuild the Spring Bean index

## How It Works

1. **Automatic Detection**: Happy Java detects Spring Boot projects in your workspace
2. **Bean Indexing**: Indexes all `@Component`, `@Service`, `@Repository`, `@Controller`, and `@Bean` definitions
3. **Smart Navigation**: Provides CodeLens and Go to Definition support for all injection points
4. **Cached Index**: Persists index to disk for fast startup on next session

## Release Notes

### 0.0.1

Initial release with:
- Spring Bean navigation (field and constructor injection)
- CodeLens provider for visual quick navigation
- Support for `@Autowired`, `@Resource`, `@Inject`, `@Qualifier`, and `@Primary`
- Intelligent Bean resolution with multiple candidate support
- Persistent index caching

---

**Enjoy!**
