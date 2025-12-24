# Quickstart: Lombok Constructor Injection Support

**Feature**: `005-lombok-interface-injection`
**Status**: User Guide
**Last Updated**: 2024-12-24

## What is Lombok Constructor Injection Support?

This feature enables CodeLens navigation for Spring beans injected via Lombok's `@RequiredArgsConstructor` and `@AllArgsConstructor` annotations. Instead of explicitly writing constructor code with `@Autowired`, Lombok generates it at compile-time. This plugin now recognizes these Lombok-generated injection points and provides the same CodeLens navigation as explicit `@Autowired` annotations.

**Before this feature**:
- ❌ No CodeLens on Lombok-injected fields
- ❌ Could not navigate from field to bean definition
- ❌ Had to manually search for bean implementations

**After this feature**:
- ✅ CodeLens appears above Lombok-injected fields
- ✅ Click to navigate to bean definition
- ✅ Smart interface resolution with @Primary and @Qualifier support

---

## Prerequisites

### 1. Lombok Dependency

Your project must have Lombok as a dependency:

**Maven** (`pom.xml`):
```xml
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
    <version>1.18.30</version>
    <scope>provided</scope>
</dependency>
```

**Gradle** (`build.gradle`):
```groovy
dependencies {
    compileOnly 'org.projectlombok:lombok:1.18.30'
    annotationProcessor 'org.projectlombok:lombok:1.18.30'
}
```

### 2. Spring Framework

Your project must use Spring Framework with dependency injection:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter</artifactId>
    <version>3.2.0</version>
</dependency>
```

### 3. VS Code Setup

Ensure you have:
- **Happy Java Extension**: Installed and active
- **Java Extension Pack**: For Java language support

---

## Supported Annotations

### @RequiredArgsConstructor

Generates a constructor for all `@NonNull` and `final` fields.

**Syntax Variants** (all supported):

#### Java 7 Style
```java
@Service
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class UserService {
    @NonNull
    private final UserRepository userRepository;
}
```

#### Java 8+ Underscore Style
```java
@Service
@RequiredArgsConstructor(onConstructor_={@Autowired})
public class UserService {
    @NonNull
    private final UserRepository userRepository;
}
```

#### Java 8+ Double Underscore Style
```java
@Service
@RequiredArgsConstructor(onConstructor__={@Autowired})
public class UserService {
    @NonNull
    private final UserRepository userRepository;
}
```

**When to use**: Most common pattern - only injects required dependencies (final or @NonNull fields).

---

### @AllArgsConstructor

Generates a constructor for **all fields** (regardless of @NonNull or final).

```java
@Service
@AllArgsConstructor(onConstructor=@__({@Autowired}))
public class OrderService {
    private UserService userService;        // Injected
    private PaymentService paymentService;  // Injected
    private String description;             // Injected (even though not a bean - will show error)
}
```

**When to use**: When you want to inject all fields, including optional ones. Less common than @RequiredArgsConstructor.

**⚠️ Warning**: @AllArgsConstructor will try to inject ALL fields, including non-bean types. Use with caution.

---

## Field Eligibility Rules

### For @RequiredArgsConstructor

A field is eligible for injection if **either**:
1. Field has `@NonNull` annotation, OR
2. Field has `final` modifier

**Examples**:

| Field Declaration | Injected? | Reason |
|-------------------|-----------|--------|
| `@NonNull private final UserService service;` | ✅ Yes | Both @NonNull and final |
| `@NonNull private UserService service;` | ✅ Yes | Has @NonNull |
| `private final UserService service;` | ✅ Yes | Has final |
| `private UserService service;` | ❌ No | Neither @NonNull nor final |

### For @AllArgsConstructor

**All fields are eligible** (no filtering).

---

## Basic Usage Examples

### Example 1: Simple Concrete Class Injection

**Given**: You have a service and its implementation

**UserService.java** (bean):
```java
@Service
public class UserService {
    public List<User> findAll() { /* ... */ }
}
```

**UserController.java** (consumer):
```java
@RestController
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class UserController {
    @NonNull
    private final UserService userService;  // ← CodeLens appears here: "→ UserService"

    @GetMapping("/users")
    public List<User> getUsers() {
        return userService.findAll();
    }
}
```

**What you'll see**:
- CodeLens above `private final UserService userService;` line
- Text: `→ UserService`
- Click to navigate to UserService.java bean definition

---

### Example 2: Multiple Lombok Fields

**OrderService.java**:
```java
@Service
@RequiredArgsConstructor(onConstructor_={@Autowired})
public class OrderService {
    @NonNull
    private final UserService userService;      // ← CodeLens: "→ UserService"

    @NonNull
    private final PaymentService paymentService; // ← CodeLens: "→ PaymentService"

    @NonNull
    private final EmailService emailService;     // ← CodeLens: "→ EmailService"

    private String description;  // ← No CodeLens (not @NonNull, not final)
}
```

**What you'll see**:
- Three separate CodeLens items (one per injectable field)
- Each navigates to its respective bean definition
- `description` field has no CodeLens (correctly excluded)

---

## Interface Resolution

When injecting interfaces, the plugin uses Spring's resolution rules to find the correct implementation.

### Scenario 1: Single Implementation

**IExampleService.java** (interface):
```java
public interface IExampleService {
    void doSomething();
}
```

**ExampleServiceImpl.java** (only implementation):
```java
@Service
public class ExampleServiceImpl implements IExampleService {
    @Override
    public void doSomething() { /* ... */ }
}
```

**Controller.java**:
```java
@RestController
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class ExampleController {
    @NonNull
    private final IExampleService exampleService;  // ← CodeLens: "→ ExampleServiceImpl"
}
```

**What you'll see**:
- CodeLens text: `→ ExampleServiceImpl`
- Click navigates directly to ExampleServiceImpl (bypasses interface)

---

### Scenario 2: Multiple Implementations with @Primary

**PaymentService.java** (interface):
```java
public interface PaymentService {
    void processPayment(Order order);
}
```

**StripePaymentService.java** (primary implementation):
```java
@Service
@Primary  // ← This is the default
public class StripePaymentService implements PaymentService {
    @Override
    public void processPayment(Order order) { /* ... */ }
}
```

**PayPalPaymentService.java** (alternative implementation):
```java
@Service
public class PayPalPaymentService implements PaymentService {
    @Override
    public void processPayment(Order order) { /* ... */ }
}
```

**OrderService.java**:
```java
@Service
@RequiredArgsConstructor(onConstructor_={@Autowired})
public class OrderService {
    @NonNull
    private final PaymentService paymentService;  // ← CodeLens: "→ StripePaymentService (@Primary)"
}
```

**What you'll see**:
- CodeLens text: `→ StripePaymentService (@Primary)`
- Navigates to StripePaymentService (respects @Primary)
- Badge indicates why this implementation was chosen

---

### Scenario 3: Multiple Implementations with No @Primary

**Repository.java**:
```java
@Service
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class PaymentRepository {
    @NonNull
    private final PaymentService paymentService;  // ← CodeLens: "→ 2 implementations (choose one)"
}
```

**What you'll see**:
- CodeLens text: `→ 2 implementations (choose one)`
- Click shows quick pick menu with all implementations
- Select to navigate to chosen implementation

---

## @Qualifier Support

Use `@Qualifier` to explicitly specify which bean to inject when multiple candidates exist.

### Example: Disambiguating Multiple Implementations

**PaymentRepository.java**:
```java
@Repository
@RequiredArgsConstructor(onConstructor_={@Autowired})
public class PaymentRepository {
    @NonNull
    @Qualifier("paypal")  // ← Explicitly choose PayPal implementation
    private final PaymentService paymentService;  // ← CodeLens: "→ paypalPaymentService (@Qualifier)"
}
```

**PayPalPaymentService.java**:
```java
@Service("paypal")  // ← Bean name matches qualifier
public class PayPalPaymentService implements PaymentService {
    @Override
    public void processPayment(Order order) { /* ... */ }
}
```

**What you'll see**:
- CodeLens text: `→ paypalPaymentService (@Qualifier)`
- Navigates to PayPalPaymentService (ignores @Primary if present)
- Badge shows qualifier was used for resolution

---

### @Qualifier with Custom Bean Names

**DataSourceConfig.java**:
```java
@Configuration
public class DataSourceConfig {

    @Bean("primaryDataSource")
    @Primary
    public DataSource primaryDataSource() { /* ... */ }

    @Bean("secondaryDataSource")
    public DataSource secondaryDataSource() { /* ... */ }
}
```

**Repository.java**:
```java
@Repository
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class UserRepository {
    @NonNull
    @Qualifier("secondaryDataSource")  // ← Matches @Bean name
    private final DataSource dataSource;  // ← CodeLens: "→ secondaryDataSource (@Qualifier)"
}
```

**What you'll see**:
- CodeLens resolves to the @Bean method named "secondaryDataSource"
- Navigates to the @Bean method in DataSourceConfig.java

---

## Troubleshooting

### CodeLens Not Appearing

**Problem**: No CodeLens shows up above Lombok field.

**Checklist**:
1. ✅ Class has `@RequiredArgsConstructor` or `@AllArgsConstructor`?
2. ✅ Annotation includes `onConstructor` parameter with `@Autowired`?
3. ✅ Field is `@NonNull` or `final` (for @RequiredArgsConstructor)?
4. ✅ Class has Spring stereotype annotation (@Service, @Component, @Repository, @Controller)?
5. ✅ Happy Java extension is installed and active?
6. ✅ File has been indexed (open file or trigger workspace index)?

**Common Mistakes**:

❌ **Missing onConstructor parameter**:
```java
@RequiredArgsConstructor  // ← Missing onConstructor!
public class UserService {
    @NonNull
    private final UserRepository repository;
}
```

✅ **Correct**:
```java
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))  // ← Correct!
public class UserService {
    @NonNull
    private final UserRepository repository;
}
```

---

❌ **Field not @NonNull or final**:
```java
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class UserService {
    private UserRepository repository;  // ← Missing @NonNull and final!
}
```

✅ **Correct** (choose one):
```java
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class UserService {
    @NonNull
    private UserRepository repository;  // ← Has @NonNull
    // OR
    private final UserRepository repository;  // ← Has final
}
```

---

### CodeLens Shows "No implementations found"

**Problem**: CodeLens appears but says "No implementations found".

**Possible Causes**:
1. Interface has no bean implementations in workspace
2. Implementation is not annotated with @Service/@Component/@Repository
3. Implementation class hasn't been indexed yet

**Solutions**:
- Verify implementation exists and has Spring annotation
- Trigger workspace reindex: Cmd+Shift+P → "Java: Clean Java Language Server Workspace"
- Check implementation is in source path (not in test/ directory)

---

### CodeLens Shows Wrong Bean

**Problem**: CodeLens navigates to unexpected bean.

**Possible Causes**:
1. Multiple beans with same type, no @Primary
2. Wrong @Qualifier value
3. Bean name mismatch

**Solutions**:
- Add `@Primary` to preferred implementation
- Use `@Qualifier` to explicitly specify bean
- Check bean name matches qualifier exactly (case-sensitive)

---

### Performance: CodeLens Takes Too Long to Appear

**Problem**: CodeLens appears after several seconds.

**Expected Performance**: CodeLens should appear within 200ms of file opening.

**Possible Causes**:
1. Large workspace with many files
2. Slow file system (network drives)
3. Extension competing with other extensions

**Solutions**:
- Exclude irrelevant directories from indexing (.gitignore patterns)
- Close unused workspace folders
- Disable other Java extensions temporarily to test

---

## Edge Cases

### Mixed Injection (Lombok + Explicit @Autowired)

**Supported**: Yes - both work together.

```java
@Service
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class MixedService {
    @NonNull
    private final UserService userService;  // ← Lombok injection, CodeLens works

    @Autowired
    private OrderService orderService;  // ← Explicit @Autowired, CodeLens works
}
```

**What you'll see**:
- Two separate CodeLens items (one per field)
- Both navigation mechanisms work independently

---

### Generic Types

**Partially Supported**: Generic parameters are ignored during matching.

```java
@Service
@RequiredArgsConstructor(onConstructor_={@Autowired})
public class ListService {
    @NonNull
    private final List<String> items;  // ← Matches any List bean (ignores <String>)
}
```

**Limitation**: Plugin matches based on raw type (`List`), not generic parameter (`List<String>`).

**Workaround**: Use @Qualifier to disambiguate if multiple List beans exist.

---

### @RequiredArgsConstructor with staticName

**Supported**: Yes - static factory methods work.

```java
@Service
@RequiredArgsConstructor(staticName = "of", onConstructor=@__({@Autowired}))
public class UserService {
    @NonNull
    private final UserRepository repository;

    // Lombok generates: public static UserService of(UserRepository repository)
}
```

**What you'll see**:
- CodeLens still appears on field
- Navigation works normally (plugin detects fields, not constructor)

---

### @AllArgsConstructor with Non-Bean Fields

**Caution**: @AllArgsConstructor will try to inject ALL fields.

```java
@Service
@AllArgsConstructor(onConstructor=@__({@Autowired}))
public class ProblematicService {
    private UserService userService;  // ← Bean, will work
    private String description;       // ← Not a bean! Spring will fail at runtime
}
```

**What you'll see**:
- CodeLens appears on BOTH fields (plugin can't distinguish)
- `description` field CodeLens will show "No bean found for String"
- **Runtime error**: Spring will fail to autowire String

**Recommendation**: Use @RequiredArgsConstructor instead to explicitly control which fields are injected.

---

## Best Practices

### 1. Prefer @RequiredArgsConstructor over @AllArgsConstructor

**Why**: Explicit control over which fields are injected, avoids accidentally injecting non-beans.

✅ **Good**:
```java
@Service
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class UserService {
    @NonNull
    private final UserRepository repository;  // Injected

    private String config;  // Not injected (correctly)
}
```

❌ **Avoid**:
```java
@Service
@AllArgsConstructor(onConstructor=@__({@Autowired}))
public class UserService {
    private UserRepository repository;  // Injected
    private String config;              // Also injected (wrong!)
}
```

---

### 2. Use final for Immutability

**Why**: Final fields cannot be reassigned, making beans safer and thread-safe.

✅ **Good**:
```java
@Service
@RequiredArgsConstructor(onConstructor_={@Autowired})
public class UserService {
    private final UserRepository repository;  // Immutable, thread-safe
}
```

❌ **Avoid**:
```java
@Service
@RequiredArgsConstructor(onConstructor_={@Autowired})
public class UserService {
    @NonNull
    private UserRepository repository;  // Mutable, can be reassigned
}
```

---

### 3. Use @Qualifier for Clarity

**Why**: Explicit is better than implicit when multiple implementations exist.

✅ **Good**:
```java
@Service
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class PaymentService {
    @NonNull
    @Qualifier("stripe")  // Explicit, self-documenting
    private final PaymentGateway gateway;
}
```

❌ **Avoid**:
```java
@Service
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class PaymentService {
    @NonNull
    private final PaymentGateway gateway;  // Relies on @Primary, not obvious
}
```

---

### 4. Keep Lombok Syntax Consistent

**Why**: Mixing syntax styles is confusing.

✅ **Good** (choose one and stick with it):
```java
// Option 1: Java 7 style (all files)
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))

// Option 2: Java 8 style (all files)
@RequiredArgsConstructor(onConstructor_={@Autowired})
```

❌ **Avoid** (mixed styles):
```java
// File 1
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))

// File 2
@RequiredArgsConstructor(onConstructor_={@Autowired})  // Different syntax!
```

---

## Keyboard Shortcuts

| Action | Shortcut (Mac) | Shortcut (Windows/Linux) |
|--------|---------------|-------------------------|
| Trigger CodeLens | File open | File open |
| Click CodeLens | Mouse click | Mouse click |
| Navigate to bean | Cmd+Click | Ctrl+Click |
| Go back | Cmd+- | Ctrl+- |

---

## FAQ

### Q: Does this work without Lombok annotation processor?

**A**: Yes! The plugin parses Java source code directly (CST parsing), not compiled bytecode. You don't need Lombok annotation processor active in your IDE for navigation to work.

---

### Q: What if I use Lombok delombok?

**A**: If you delombok your code (expand Lombok annotations to Java code), the plugin will:
1. Still detect Lombok annotations in original source
2. Also detect explicit @Autowired constructors in delomboked code
3. Both navigation mechanisms will work (no conflicts)

---

### Q: Does this work with Kotlin?

**A**: No, this feature is Java-specific. Kotlin has its own constructor-based DI that works differently.

---

### Q: Can I disable Lombok injection detection?

**A**: Currently no configuration option exists. If you don't use Lombok annotations, the feature has zero impact (no false positives).

---

### Q: What about @Builder with dependency injection?

**A**: Not supported. `@Builder` is for object creation patterns, not dependency injection. Use @RequiredArgsConstructor for DI.

---

## Integration Examples

### Example: Repository → Service → Controller

**Full Stack with Lombok Injection**:

**UserRepository.java**:
```java
@Repository
public class UserRepository {
    // Direct bean, no injection needed
    public List<User> findAll() { /* ... */ }
}
```

**UserService.java**:
```java
@Service
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class UserService {
    @NonNull
    private final UserRepository repository;  // ← CodeLens: "→ UserRepository"

    public List<User> getAllUsers() {
        return repository.findAll();
    }
}
```

**UserController.java**:
```java
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor(onConstructor_={@Autowired})
public class UserController {
    @NonNull
    private final UserService userService;  // ← CodeLens: "→ UserService"

    @GetMapping
    public ResponseEntity<List<User>> getUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }
}
```

**Navigation Flow**:
1. Open UserController.java
2. Click CodeLens above `userService` field → navigates to UserService.java
3. Click CodeLens above `repository` field → navigates to UserRepository.java
4. Trace complete dependency chain with 2 clicks

---

## Additional Resources

- **Lombok Official Docs**: https://projectlombok.org/features/constructor
- **Spring @Autowired Docs**: https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/beans/factory/annotation/Autowired.html
- **Happy Java Extension**: [VS Code Marketplace Link]
- **Feature Specification**: `specs/005-lombok-interface-injection/spec.md`
- **GitHub Issues**: Report bugs or request features

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-12-24 | Initial quickstart guide for Lombok injection support |

---

## Support

If you encounter issues not covered in this guide:

1. **Check research findings**: `specs/005-lombok-interface-injection/research.md`
2. **Review test fixtures**: `src/test/suite/spring-bean-navigation/fixtures/lombok/`
3. **Report issue**: [GitHub Issues Link]
4. **Ask for help**: [Community Forum/Discord]

---

**Happy coding with Lombok + Spring! 🎉**
