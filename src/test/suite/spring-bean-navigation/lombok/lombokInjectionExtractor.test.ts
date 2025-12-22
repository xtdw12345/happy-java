/**
 * Unit tests for LombokInjectionExtractor
 *
 * Tests MUST fail initially (TDD Red phase) before implementing LombokInjectionExtractor
 */

import * as assert from 'assert';
import { LombokConstructorType, OnConstructorSyntax, LombokConstructorAnnotation, LombokFieldInfo } from '../../../../spring-bean-navigation/models/types';
import { InjectionType } from '../../../../spring-bean-navigation/models/types';
import * as vscode from 'vscode';

// Import will fail until we create the implementation
// This is expected for TDD Red phase
import { LombokInjectionExtractor } from '../../../../spring-bean-navigation/indexer/lombok/lombokInjectionExtractor';

suite('LombokInjectionExtractor', () => {
  let extractor: LombokInjectionExtractor;
  let mockUri: vscode.Uri;
  let requiredArgsAnnotation: LombokConstructorAnnotation;
  let allArgsAnnotation: LombokConstructorAnnotation;

  setup(() => {
    extractor = new LombokInjectionExtractor();
    mockUri = vscode.Uri.file('/test/Mock.java');

    requiredArgsAnnotation = {
      type: LombokConstructorType.REQUIRED_ARGS,
      hasAutowired: true,
      syntaxVariant: OnConstructorSyntax.JAVA7,
      location: { uri: mockUri, line: 0, column: 0 }
    };

    allArgsAnnotation = {
      type: LombokConstructorType.ALL_ARGS,
      hasAutowired: true,
      syntaxVariant: OnConstructorSyntax.JAVA7,
      location: { uri: mockUri, line: 0, column: 0 }
    };
  });

  // T011: Unit test - Extract @NonNull fields for RequiredArgsConstructor
  test('should extract @NonNull fields for RequiredArgsConstructor', () => {
    const fields: LombokFieldInfo[] = [
      {
        name: 'userService',
        type: 'UserService',
        location: { uri: mockUri, line: 10, column: 15 },
        hasNonNull: true,
        isFinal: false,
        annotations: ['@NonNull']
      },
      {
        name: 'optionalService',
        type: 'OptionalService',
        location: { uri: mockUri, line: 12, column: 15 },
        hasNonNull: false,
        isFinal: false,
        annotations: []
      }
    ];

    const filtered = extractor.filterFields(fields, requiredArgsAnnotation);

    assert.strictEqual(filtered.length, 1, 'Should include only @NonNull field');
    assert.strictEqual(filtered[0].name, 'userService');
  });

  // T012: Unit test - Extract field type and location correctly
  test('should extract field type and location correctly', () => {
    const fields: LombokFieldInfo[] = [
      {
        name: 'userService',
        type: 'com.example.UserService',
        location: { uri: mockUri, line: 10, column: 15 },
        hasNonNull: true,
        isFinal: true,
        annotations: ['@NonNull']
      }
    ];

    const injections = extractor.convertToInjectionPoints(fields);

    assert.strictEqual(injections.length, 1);
    assert.strictEqual(injections[0].beanType, 'com.example.UserService', 'Should preserve field type');
    assert.strictEqual(injections[0].location.line, 10, 'Should preserve location line');
    assert.strictEqual(injections[0].location.column, 15, 'Should preserve location column');
    assert.strictEqual(injections[0].fieldName, 'userService', 'Should set fieldName');
  });

  // T013: Unit test - Skip fields without @NonNull when RequiredArgs
  test('should skip fields without @NonNull when RequiredArgs', () => {
    const fields: LombokFieldInfo[] = [
      {
        name: 'regularField',
        type: 'String',
        location: { uri: mockUri, line: 10, column: 0 },
        hasNonNull: false,
        isFinal: false,
        annotations: []
      },
      {
        name: 'nonNullField',
        type: 'UserService',
        location: { uri: mockUri, line: 12, column: 0 },
        hasNonNull: true,
        isFinal: false,
        annotations: ['@NonNull']
      }
    ];

    const filtered = extractor.filterFields(fields, requiredArgsAnnotation);

    assert.strictEqual(filtered.length, 1, 'Should skip non-@NonNull field');
    assert.strictEqual(filtered[0].name, 'nonNullField');
  });

  // T014: Unit test - Include final fields for RequiredArgsConstructor
  test('should include final fields for RequiredArgsConstructor', () => {
    const fields: LombokFieldInfo[] = [
      {
        name: 'finalField',
        type: 'UserService',
        location: { uri: mockUri, line: 10, column: 0 },
        hasNonNull: false,
        isFinal: true,
        annotations: []
      },
      {
        name: 'regularField',
        type: 'String',
        location: { uri: mockUri, line: 12, column: 0 },
        hasNonNull: false,
        isFinal: false,
        annotations: []
      }
    ];

    const filtered = extractor.filterFields(fields, requiredArgsAnnotation);

    assert.strictEqual(filtered.length, 1, 'Should include final field');
    assert.strictEqual(filtered[0].name, 'finalField');
  });

  test('should include both @NonNull and final fields for RequiredArgsConstructor', () => {
    const fields: LombokFieldInfo[] = [
      {
        name: 'nonNullField',
        type: 'UserService',
        location: { uri: mockUri, line: 10, column: 0 },
        hasNonNull: true,
        isFinal: false,
        annotations: ['@NonNull']
      },
      {
        name: 'finalField',
        type: 'OrderService',
        location: { uri: mockUri, line: 12, column: 0 },
        hasNonNull: false,
        isFinal: true,
        annotations: []
      },
      {
        name: 'bothField',
        type: 'PaymentService',
        location: { uri: mockUri, line: 14, column: 0 },
        hasNonNull: true,
        isFinal: true,
        annotations: ['@NonNull']
      }
    ];

    const filtered = extractor.filterFields(fields, requiredArgsAnnotation);

    assert.strictEqual(filtered.length, 3, 'Should include all @NonNull and final fields');
  });

  test('should include all fields for AllArgsConstructor', () => {
    const fields: LombokFieldInfo[] = [
      {
        name: 'field1',
        type: 'String',
        location: { uri: mockUri, line: 10, column: 0 },
        hasNonNull: false,
        isFinal: false,
        annotations: []
      },
      {
        name: 'field2',
        type: 'UserService',
        location: { uri: mockUri, line: 12, column: 0 },
        hasNonNull: true,
        isFinal: false,
        annotations: ['@NonNull']
      },
      {
        name: 'field3',
        type: 'OrderService',
        location: { uri: mockUri, line: 14, column: 0 },
        hasNonNull: false,
        isFinal: true,
        annotations: []
      }
    ];

    const filtered = extractor.filterFields(fields, allArgsAnnotation);

    assert.strictEqual(filtered.length, 3, 'Should include all fields for AllArgsConstructor');
  });

  test('should set injectionType to LOMBOK_CONSTRUCTOR', () => {
    const fields: LombokFieldInfo[] = [
      {
        name: 'userService',
        type: 'UserService',
        location: { uri: mockUri, line: 10, column: 0 },
        hasNonNull: true,
        isFinal: false,
        annotations: ['@NonNull']
      }
    ];

    const injections = extractor.convertToInjectionPoints(fields);

    assert.strictEqual(injections.length, 1);
    assert.strictEqual(injections[0].injectionType, InjectionType.LOMBOK_CONSTRUCTOR, 'Should mark as LOMBOK_CONSTRUCTOR');
  });

  test('should handle empty field list', () => {
    const fields: LombokFieldInfo[] = [];

    const filtered = extractor.filterFields(fields, requiredArgsAnnotation);
    const injections = extractor.convertToInjectionPoints(filtered);

    assert.strictEqual(filtered.length, 0);
    assert.strictEqual(injections.length, 0);
  });

  test('should preserve qualifier in injection point', () => {
    const fields: LombokFieldInfo[] = [
      {
        name: 'userRepository',
        type: 'UserRepository',
        location: { uri: mockUri, line: 10, column: 0 },
        hasNonNull: true,
        isFinal: false,
        qualifier: 'primaryRepository',
        annotations: ['@NonNull', '@Qualifier']
      }
    ];

    const injections = extractor.convertToInjectionPoints(fields);

    assert.strictEqual(injections.length, 1);
    assert.strictEqual(injections[0].qualifier, 'primaryRepository', 'Should preserve qualifier');
  });

  test('should set isRequired to true for Lombok injections', () => {
    const fields: LombokFieldInfo[] = [
      {
        name: 'userService',
        type: 'UserService',
        location: { uri: mockUri, line: 10, column: 0 },
        hasNonNull: true,
        isFinal: false,
        annotations: ['@NonNull']
      }
    ];

    const injections = extractor.convertToInjectionPoints(fields);

    assert.strictEqual(injections[0].isRequired, true, 'Lombok injections are always required');
  });

  // T042: Unit test - Extract all fields for @AllArgsConstructor (already tested above)
  test('should extract all fields unconditionally for AllArgsConstructor (already tested)', () => {
    // This test is already covered by "should include all fields for AllArgsConstructor"
    // Skipping duplicate
  });

  // T056: Unit test - Extract @Qualifier from Lombok fields (already tested above in "should preserve qualifier in injection point")
  test('should extract @Qualifier annotation from Lombok field', () => {
    const fields: LombokFieldInfo[] = [
      {
        name: 'primaryRepository',
        type: 'UserRepository',
        location: { uri: mockUri, line: 10, column: 0 },
        hasNonNull: true,
        isFinal: false,
        qualifier: 'userRepositoryImpl',
        annotations: ['@NonNull', '@Qualifier']
      }
    ];

    const injections = extractor.convertToInjectionPoints(fields);

    assert.strictEqual(injections.length, 1);
    assert.strictEqual(injections[0].qualifier, 'userRepositoryImpl', 'Should extract and preserve qualifier');
    assert.strictEqual(injections[0].beanType, 'UserRepository');
  });

  // T057: Unit test - Create BeanInjectionPoint with correct qualifier value
  test('should create BeanInjectionPoint with correct qualifier value', () => {
    const fields: LombokFieldInfo[] = [
      {
        name: 'repository',
        type: 'Repository',
        location: { uri: mockUri, line: 10, column: 0 },
        hasNonNull: true,
        isFinal: false,
        qualifier: 'customQualifier',
        annotations: ['@NonNull', '@Qualifier']
      }
    ];

    const injections = extractor.convertToInjectionPoints(fields);

    assert.strictEqual(injections[0].qualifier, 'customQualifier', 'Qualifier should match extracted value');
  });

  test('should handle field without qualifier', () => {
    const fields: LombokFieldInfo[] = [
      {
        name: 'simpleService',
        type: 'SimpleService',
        location: { uri: mockUri, line: 10, column: 0 },
        hasNonNull: true,
        isFinal: false,
        qualifier: undefined,
        annotations: ['@NonNull']
      }
    ];

    const injections = extractor.convertToInjectionPoints(fields);

    assert.strictEqual(injections[0].qualifier, undefined, 'Qualifier should be undefined when not present');
  });
});
