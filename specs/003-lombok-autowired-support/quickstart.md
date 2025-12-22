# Quickstart Guide: Lombok Annotation Support

**Feature**: 003-lombok-autowired-support
**Audience**: Developers implementing or extending Lombok support
**Last Updated**: 2025-12-22

## Overview

This guide helps you understand, implement, and extend Lombok annotation support for Spring bean navigation. The feature enables CodeLens navigation from Lombok-generated constructor injection fields (`@NonNull` in `@RequiredArgsConstructor` classes) to their Spring bean definitions.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│ User opens file with Lombok constructor injection          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ BeanIndexer.indexFile(uri)                                  │
│   ├─ BeanMetadataExtractor.extractFromFile(uri)           │
│   │    ├─ JavaParser.getCST(uri) → CST                    │
│   │    ├─ AnnotationScanner.extractAnnotations(CST)       │
│   │    ├─ Extract bean definitions                         │
│   │    └─ Extract injection points (includes Lombok ↓)    │
│   └─ BeanIndex.addBeans() / addInjections()               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ LombokAnnotationDetector.detectConstructorInjection()      │
│   ├─ Find @RequiredArgsConstructor / @AllArgsConstructor  │
│   ├─ Extract onConstructor parameter                       │
│   ├─ Validate contains @Autowired                         │
│   └─ Return LombokConstructorAnnotation | null            │
└────────────────────────┬────────────────────────────────────┘
                         │ (if Lombok annotation detected)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ LombokInjectionExtractor.extract(CST, lombokAnnotation)    │
│   ├─ Extract all fields from class                         │
│   ├─ Filter fields based on constructor type               │
│   │    ├─ @RequiredArgsConstructor: @NonNull + final      │
│   │    └─ @AllArgsConstructor: all fields                 │
│   ├─ Extract @Qualifier from fields                        │
│   └─ Return BeanInjectionPoint[] with                      │
│          injectionType = LOMBOK_CONSTRUCTOR                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ CodeLensProvider shows "→ go to bean definition"           │
│   ├─ Query BeanIndex.getInjectionPoints(file)             │
│   ├─ For each injection (including Lombok):                │
│   │    ├─ Query BeanIndex.findCandidates(injection)       │
│   │    └─ Create CodeLens with navigation command         │
│   └─ No special handling for Lombok (reuses existing)     │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start: 5-Minute Setup

### 1. Clone and Install Dependencies

```bash
cd happy-java
npm install
```

### 2. Run Existing Tests to Verify Setup

```bash
npm test
```

All existing Spring bean navigation tests should pass.

### 3. Create Test File for Lombok Support

Create `src/test/suite/spring-bean-navigation/lombok/lombokAnnotationDetector.test.ts`:

```typescript
import * as assert from 'assert';
import { LombokAnnotationDetector } from '../../../../spring-bean-navigation/indexer/lombok/lombokAnnotationDetector';
import { LombokConstructorType, OnConstructorSyntax } from '../../../../spring-bean-navigation/models/types';

suite('LombokAnnotationDetector', () => {
  let detector: LombokAnnotationDetector;

  setup(() => {
    detector = new LombokAnnotationDetector();
  });

  test('should detect @RequiredArgsConstructor with @Autowired in onConstructor', () => {
    const annotations = [
      {
        name: '@RequiredArgsConstructor',
        fullyQualifiedName: 'lombok.RequiredArgsConstructor',
        parameters: new Map([['onConstructor', '@__({@Autowired})']]),
        location: { uri: null as any, line: 0, column: 0 }
      }
    ];

    const result = detector.detectConstructorInjection(annotations);

    assert.notStrictEqual(result, null);
    assert.strictEqual(result!.type, LombokConstructorType.REQUIRED_ARGS);
    assert.strictEqual(result!.hasAutowired, true);
    assert.strictEqual(result!.syntaxVariant, OnConstructorSyntax.JAVA7);
  });

  test('should return null when onConstructor lacks @Autowired', () => {
    const annotations = [
      {
        name: '@RequiredArgsConstructor',
        fullyQualifiedName: 'lombok.RequiredArgsConstructor',
        parameters: new Map([['onConstructor', '@__({@Qualifier("test")})']]),
        location: { uri: null as any, line: 0, column: 0 }
      }
    ];

    const result = detector.detectConstructorInjection(annotations);

    assert.strictEqual(result, null);
  });
});
```

### 4. Run Test (Should Fail - TDD Red Phase)

```bash
npm test -- --grep "LombokAnnotationDetector"
```

Expected: Test fails because `LombokAnnotationDetector` doesn't exist yet.

### 5. Implement Minimal Detector (TDD Green Phase)

Create `src/spring-bean-navigation/indexer/lombok/lombokAnnotationDetector.ts`:

```typescript
import { Annotation } from '../annotationScanner';
import { LombokConstructorAnnotation, LombokConstructorType, OnConstructorSyntax } from '../../models/types';

export class LombokAnnotationDetector {
  detectConstructorInjection(classAnnotations: Annotation[]): LombokConstructorAnnotation | null {
    // Find Lombok constructor annotation
    const lombokAnnotation = classAnnotations.find(a =>
      a.name === '@RequiredArgsConstructor' || a.name === '@AllArgsConstructor'
    );

    if (!lombokAnnotation) {
      return null;
    }

    // Extract onConstructor parameter
    const onConstructorValue = this.extractOnConstructorValue(lombokAnnotation);
    if (!onConstructorValue) {
      return null;
    }

    // Check for @Autowired
    if (!this.containsAutowired(onConstructorValue)) {
      return null;
    }

    return {
      type: lombokAnnotation.name === '@RequiredArgsConstructor'
        ? LombokConstructorType.REQUIRED_ARGS
        : LombokConstructorType.ALL_ARGS,
      hasAutowired: true,
      syntaxVariant: this.determineSyntaxVariant(onConstructorValue),
      location: lombokAnnotation.location
    };
  }

  private extractOnConstructorValue(annotation: Annotation): string | undefined {
    // Check all onConstructor variants
    const variants = ['onConstructor', 'onConstructor_', 'onConstructor__'];
    for (const variant of variants) {
      const value = annotation.parameters.get(variant);
      if (value) {
        return value;
      }
    }
    return undefined;
  }

  private containsAutowired(value: string): boolean {
    return /@Autowired\b/i.test(value);
  }

  private determineSyntaxVariant(value: string): OnConstructorSyntax {
    if (/@__\s*\(/.test(value)) {
      return OnConstructorSyntax.JAVA7;
    }
    // Distinguish between onConstructor_= and onConstructor__= by checking parameter name
    // (would need to track which variant was found during extraction)
    return OnConstructorSyntax.JAVA8_UNDERSCORE;
  }
}
```

### 6. Run Test Again (Should Pass - TDD Green Phase)

```bash
npm test -- --grep "LombokAnnotationDetector"
```

Expected: Test passes.

## Development Workflow

### TDD Cycle (Red-Green-Refactor)

```
1. Write failing test
   ├─ Define expected behavior
   ├─ Create test fixtures (sample Java files)
   └─ Assert expected outcomes

2. Implement minimal code to pass test
   ├─ Focus on making test pass (not perfect code)
   └─ Use simplest possible implementation

3. Refactor
   ├─ Improve code quality
   ├─ Extract methods
   ├─ Add JSDoc comments
   └─ Ensure tests still pass

4. Repeat for next feature/edge case
```

### Running Tests

```bash
# All tests
npm test

# Specific test suite
npm test -- --grep "Lombok"

# Single test file
npm test src/test/suite/spring-bean-navigation/lombok/lombokAnnotationDetector.test.ts

# Watch mode (re-run on file changes)
npm test -- --watch
```

### Debugging Tests in VS Code

1. Open test file
2. Set breakpoint
3. Press F5 or use "Run > Start Debugging"
4. Select "Extension Tests" configuration

## Key Files to Modify

### Must Modify (Core Integration)

| File | Changes | Purpose |
|------|---------|---------|
| `src/spring-bean-navigation/models/types.ts` | Add Lombok types | Define data structures |
| `src/spring-bean-navigation/models/BeanInjectionPoint.ts` | Add `injectionType` enum | Distinguish injection sources |
| `src/spring-bean-navigation/indexer/beanMetadataExtractor.ts` | Call Lombok extraction | Integrate Lombok detection |
| `src/spring-bean-navigation/indexer/annotationScanner.ts` | Add Lombok to FQN map | Recognize Lombok annotations |

### New Files (Lombok-Specific Logic)

| File | Purpose |
|------|---------|
| `src/spring-bean-navigation/indexer/lombok/lombokAnnotationDetector.ts` | Detect Lombok constructor annotations |
| `src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts` | Extract @NonNull fields as injection points |

### Test Files (TDD)

| File | Tests |
|------|-------|
| `src/test/suite/spring-bean-navigation/lombok/lombokAnnotationDetector.test.ts` | Unit tests for detector |
| `src/test/suite/spring-bean-navigation/lombok/lombokInjectionExtractor.test.ts` | Unit tests for extractor |
| `src/test/suite/spring-bean-navigation/lombok/e2e/lombokFieldNavigation.test.ts` | End-to-end navigation tests |

## Common Tasks

### Task 1: Add Support for New OnConstructor Syntax

**Example**: Support `onConstructor___=` (triple underscore)

1. **Update Regex Pattern** in `LombokAnnotationDetector`:

```typescript
private extractOnConstructorValue(annotation: Annotation): string | undefined {
  const variants = ['onConstructor', 'onConstructor_', 'onConstructor__', 'onConstructor___']; // Add new variant
  // ... rest of method
}
```

2. **Add Test Case**:

```typescript
test('should detect onConstructor___ syntax variant', () => {
  const annotations = [
    {
      name: '@RequiredArgsConstructor',
      parameters: new Map([['onConstructor___', '{@Autowired}']]),
      // ...
    }
  ];

  const result = detector.detectConstructorInjection(annotations);

  assert.notStrictEqual(result, null);
  assert.strictEqual(result!.hasAutowired, true);
});
```

3. **Run Test and Verify**

---

### Task 2: Add Logging for Debugging

**Example**: Log when Lombok annotation is detected

```typescript
import * as vscode from 'vscode';

export class LombokAnnotationDetector {
  private readonly outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Happy Java - Lombok');
  }

  detectConstructorInjection(classAnnotations: Annotation[]): LombokConstructorAnnotation | null {
    const lombokAnnotation = classAnnotations.find(a =>
      a.name === '@RequiredArgsConstructor' || a.name === '@AllArgsConstructor'
    );

    if (lombokAnnotation) {
      this.outputChannel.appendLine(`[Lombok] Detected ${lombokAnnotation.name} at ${lombokAnnotation.location.uri.fsPath}:${lombokAnnotation.location.line}`);
    }

    // ... rest of method
  }
}
```

---

### Task 3: Handle Edge Case (Static Fields)

**Example**: Exclude static fields from injection extraction

1. **Add Test**:

```typescript
test('should exclude static fields', () => {
  const fields = [
    {
      name: 'CONSTANT',
      type: 'String',
      hasNonNull: false,
      isFinal: true,
      isStatic: true, // NEW property
      // ...
    },
    {
      name: 'service',
      type: 'UserService',
      hasNonNull: true,
      isFinal: false,
      isStatic: false,
      // ...
    }
  ];

  const filtered = extractor.filterFields(fields, lombokAnnotation);

  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].name, 'service');
});
```

2. **Update Field Extraction**:

```typescript
extractFieldInfo(cst: any, uri: vscode.Uri): LombokFieldInfo[] {
  // ... navigate to fields

  for (const fieldDecl of fieldDeclarations) {
    const modifiers = this.extractModifiers(fieldDecl);
    const isStatic = this.isStaticField(modifiers);

    if (isStatic) {
      continue; // Skip static fields
    }

    // ... extract field info
  }
}

private isStaticField(modifiers: any[]): boolean {
  return modifiers.some(mod =>
    mod.children?.Static?.[0] !== undefined
  );
}
```

---

## Debugging Tips

### Enable Debug Logging

Add to VS Code settings (`.vscode/settings.json`):

```json
{
  "happyJava.debug": true,
  "happyJava.lombok.logDetection": true
}
```

### Inspect CST Structure

```typescript
import * as fs from 'fs';

// In your detector/extractor
const cstJson = JSON.stringify(cst, null, 2);
fs.writeFileSync('/tmp/cst-debug.json', cstJson);
console.log('CST written to /tmp/cst-debug.json');
```

Then open `/tmp/cst-debug.json` in VS Code to explore the CST structure.

### Test with Real Java Files

Create test fixtures in `src/test/suite/spring-bean-navigation/fixtures/lombok/`:

**UserController.java**:
```java
package com.example.demo;

import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor(onConstructor=@__({@Autowired}))
public class UserController {

    @NonNull
    private final UserService userService;

    @GetMapping("/{id}")
    public User getUser(@PathVariable Long id) {
        return userService.findById(id);
    }
}
```

Then test with real CST:

```typescript
import * as path from 'path';
import { JavaParser } from '../../../../spring-bean-navigation/indexer/javaParser';

test('should extract injection from real Java file', async () => {
  const fixturePath = path.join(__dirname, '../../fixtures/lombok/UserController.java');
  const uri = vscode.Uri.file(fixturePath);

  const parser = new JavaParser();
  const cst = await parser.getCST(uri);

  const detector = new LombokAnnotationDetector();
  const extractor = new LombokInjectionExtractor();

  const lombokAnnotation = detector.detectConstructorInjection(/* extract class annotations from CST */);
  const injections = extractor.extract(cst, uri, lombokAnnotation!);

  assert.strictEqual(injections.length, 1);
  assert.strictEqual(injections[0].name, 'userService');
  assert.strictEqual(injections[0].type, 'UserService');
});
```

## Performance Optimization

### Benchmark Lombok Detection

```typescript
test('Lombok detection performance benchmark', () => {
  const iterations = 100;
  const start = Date.now();

  for (let i = 0; i < iterations; i++) {
    detector.detectConstructorInjection(largeAnnotationList);
  }

  const elapsed = Date.now() - start;
  const avgTime = elapsed / iterations;

  assert.ok(avgTime < 10, `Average time ${avgTime}ms exceeds 10ms threshold`);
});
```

### Cache Annotation Detection Results

```typescript
export class LombokAnnotationDetector {
  private cache = new Map<string, LombokConstructorAnnotation | null>();

  detectConstructorInjection(classAnnotations: Annotation[]): LombokConstructorAnnotation | null {
    const cacheKey = this.computeCacheKey(classAnnotations);

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const result = this.detectInternal(classAnnotations);
    this.cache.set(cacheKey, result);

    return result;
  }

  private computeCacheKey(annotations: Annotation[]): string {
    return annotations
      .filter(a => a.name === '@RequiredArgsConstructor' || a.name === '@AllArgsConstructor')
      .map(a => `${a.name}:${a.parameters.get('onConstructor')}`)
      .join('|');
  }
}
```

## Troubleshooting

### Issue: Tests Fail with "Cannot find module"

**Solution**: Ensure TypeScript compilation is up to date

```bash
npm run compile
npm test
```

### Issue: CodeLens Doesn't Appear on Lombok Fields

**Debugging Steps**:

1. Verify Lombok annotation detection:
   ```typescript
   console.log('Lombok annotation:', detector.detectConstructorInjection(classAnnotations));
   ```

2. Verify injection extraction:
   ```typescript
   console.log('Lombok injections:', extractor.extract(cst, uri, lombokAnnotation));
   ```

3. Verify BeanIndex storage:
   ```typescript
   console.log('Injections in index:', beanIndex.getInjectionPoints(uri));
   ```

4. Check CodeLensProvider query:
   ```typescript
   console.log('CodeLens candidates:', beanIndex.findCandidates(injection));
   ```

### Issue: Performance Degradation in Large Projects

**Profiling**:

```bash
# Profile extension startup
code --prof-startup --inspect-extensions=<extension-id>

# Analyze profile
node --prof-process isolate-*.log > profile.txt
```

**Optimize**:
- Add early returns for non-Lombok files
- Cache CST navigation results
- Use lazy evaluation for field filtering

## Next Steps

1. **Read Research Document**: [research.md](./research.md) for technical decisions
2. **Review Data Model**: [data-model.md](./data-model.md) for entity definitions
3. **Study Contracts**: [contracts/](./contracts/) for API specifications
4. **Write Tests First**: Follow TDD approach for all new code
5. **Run `/speckit.tasks`**: Generate detailed implementation tasks

## Resources

- **VS Code Extension API**: https://code.visualstudio.com/api
- **Java Parser Library**: https://github.com/jhipster/prettier-java (java-parser)
- **Lombok Documentation**: https://projectlombok.org/features/
- **Spring Framework Docs**: https://docs.spring.io/spring-framework/reference/

---

**Happy Coding!** 🚀 If you have questions, refer to the implementation plan (`plan.md`) or reach out to the team.
