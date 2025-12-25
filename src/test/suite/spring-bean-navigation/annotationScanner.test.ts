/**
 * Unit tests for AnnotationScanner
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { AnnotationScanner } from '../../../indexer/annotationScanner';

suite('AnnotationScanner Test Suite', () => {
  let scanner: AnnotationScanner;

  setup(() => {
    scanner = new AnnotationScanner();
  });

  test('should identify @Service as bean definition annotation', () => {
    const annotation = {
      name: '@Service',
      fullyQualifiedName: 'org.springframework.stereotype.Service',
      parameters: new Map(),
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 5,
        column: 0
      }
    };

    const result = scanner.isBeanDefinitionAnnotation(annotation);
    assert.strictEqual(result, true, '@Service should be recognized as bean definition');
  });

  test('should identify @Component as bean definition annotation', () => {
    const annotation = {
      name: '@Component',
      fullyQualifiedName: 'org.springframework.stereotype.Component',
      parameters: new Map(),
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 5,
        column: 0
      }
    };

    const result = scanner.isBeanDefinitionAnnotation(annotation);
    assert.strictEqual(result, true, '@Component should be recognized as bean definition');
  });

  test('should identify @Autowired as injection annotation', () => {
    const annotation = {
      name: '@Autowired',
      fullyQualifiedName: 'org.springframework.beans.factory.annotation.Autowired',
      parameters: new Map(),
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 10,
        column: 4
      }
    };

    const result = scanner.isInjectionAnnotation(annotation);
    assert.strictEqual(result, true, '@Autowired should be recognized as injection annotation');
  });

  test('should identify @Resource as injection annotation', () => {
    const annotation = {
      name: '@Resource',
      fullyQualifiedName: 'javax.annotation.Resource',
      parameters: new Map(),
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 10,
        column: 4
      }
    };

    const result = scanner.isInjectionAnnotation(annotation);
    assert.strictEqual(result, true, '@Resource should be recognized as injection annotation');
  });

  test('should not identify non-Spring annotations', () => {
    const annotation = {
      name: '@Override',
      fullyQualifiedName: 'java.lang.Override',
      parameters: new Map(),
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 10,
        column: 4
      }
    };

    const isBeanDef = scanner.isBeanDefinitionAnnotation(annotation);
    const isInjection = scanner.isInjectionAnnotation(annotation);

    assert.strictEqual(isBeanDef, false, '@Override should not be bean definition');
    assert.strictEqual(isInjection, false, '@Override should not be injection annotation');
  });

  test('should extract annotation parameter value', () => {
    const annotation = {
      name: '@Service',
      fullyQualifiedName: 'org.springframework.stereotype.Service',
      parameters: new Map([['value', 'userService']]),
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 5,
        column: 0
      }
    };

    const value = scanner.extractAnnotationParameter(annotation, 'value');
    assert.strictEqual(value, 'userService', 'Should extract parameter value');
  });

  test('should return undefined for missing parameter', () => {
    const annotation = {
      name: '@Service',
      fullyQualifiedName: 'org.springframework.stereotype.Service',
      parameters: new Map(),
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 5,
        column: 0
      }
    };

    const value = scanner.extractAnnotationParameter(annotation, 'value');
    assert.strictEqual(value, undefined, 'Should return undefined for missing parameter');
  });
});
