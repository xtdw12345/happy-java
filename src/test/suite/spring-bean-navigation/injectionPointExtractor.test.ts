/**
 * Unit tests for injection point extraction logic
 * This tests the core logic that will be in DefinitionProvider
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { BeanInjectionPoint } from '../../../models/BeanInjectionPoint';
import { InjectionType } from '../../../models/types';

suite('Injection Point Extraction Test Suite', () => {
  test('should validate field injection point structure', () => {
    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'com.example.UserService',
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 10,
        column: 4
      },
      isRequired: true,
      fieldName: 'userService'
    };

    const errors = BeanInjectionPoint.validate(injection);
    assert.strictEqual(errors.length, 0, 'Field injection should be valid');
  });

  test('should validate injection point with qualifier', () => {
    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'com.example.Service',
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 10,
        column: 4
      },
      qualifier: 'primaryService',
      isRequired: true,
      fieldName: 'service'
    };

    const errors = BeanInjectionPoint.validate(injection);
    assert.strictEqual(errors.length, 0, 'Qualified injection should be valid');
  });

  test('should require field name for field injection', () => {
    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'com.example.UserService',
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 10,
        column: 4
      },
      isRequired: true
      // Missing fieldName
    };

    const errors = BeanInjectionPoint.validate(injection);
    assert.ok(errors.length > 0, 'Should have validation error');
    assert.ok(errors.some(e => e.includes('Field name')), 'Should require field name');
  });

  test('should get display name for field injection', () => {
    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'com.example.UserService',
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 10,
        column: 4
      },
      isRequired: true,
      fieldName: 'userService'
    };

    const displayName = BeanInjectionPoint.getDisplayName(injection);
    assert.strictEqual(displayName, 'field: userService', 'Display name should match');
  });

  test('should detect explicit name usage', () => {
    const injection1: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'com.example.UserService',
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 10,
        column: 4
      },
      isRequired: true,
      fieldName: 'userService',
      beanName: 'customService'
    };

    const hasName = BeanInjectionPoint.hasExplicitName(injection1);
    assert.strictEqual(hasName, true, 'Should detect explicit bean name');
  });

  test('should get effective identifier with qualifier priority', () => {
    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'com.example.Service',
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 10,
        column: 4
      },
      qualifier: 'primary',
      beanName: 'service1',
      isRequired: true,
      fieldName: 'service'
    };

    const identifier = BeanInjectionPoint.getEffectiveIdentifier(injection);
    assert.strictEqual(identifier, 'primary', 'Qualifier should have priority');
  });

  test('should return undefined for type-only injection', () => {
    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'com.example.Service',
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 10,
        column: 4
      },
      isRequired: true,
      fieldName: 'service'
    };

    const identifier = BeanInjectionPoint.getEffectiveIdentifier(injection);
    assert.strictEqual(identifier, undefined, 'Should return undefined for type-only matching');
  });

  // Constructor injection tests (User Story 2)
  test('should validate constructor injection point structure', () => {
    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.CONSTRUCTOR,
      beanType: 'com.example.UserRepository',
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 15,
        column: 8
      },
      isRequired: true,
      parameterName: 'userRepository',
      parameterIndex: 0
    };

    const errors = BeanInjectionPoint.validate(injection);
    assert.strictEqual(errors.length, 0, 'Constructor injection should be valid');
  });

  test('should require parameter name for constructor injection', () => {
    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.CONSTRUCTOR,
      beanType: 'com.example.UserRepository',
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 15,
        column: 8
      },
      isRequired: true,
      parameterIndex: 0
      // Missing parameterName
    };

    const errors = BeanInjectionPoint.validate(injection);
    assert.ok(errors.length > 0, 'Should have validation error');
    assert.ok(errors.some(e => e.includes('Parameter name')), 'Should require parameter name');
  });

  test('should require parameter index for constructor injection', () => {
    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.CONSTRUCTOR,
      beanType: 'com.example.UserRepository',
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 15,
        column: 8
      },
      isRequired: true,
      parameterName: 'userRepository'
      // Missing parameterIndex
    };

    const errors = BeanInjectionPoint.validate(injection);
    assert.ok(errors.length > 0, 'Should have validation error');
    assert.ok(errors.some(e => e.includes('parameter index')), 'Should require parameter index');
  });

  test('should get display name for constructor injection', () => {
    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.CONSTRUCTOR,
      beanType: 'com.example.UserRepository',
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 15,
        column: 8
      },
      isRequired: true,
      parameterName: 'userRepository',
      parameterIndex: 0
    };

    const displayName = BeanInjectionPoint.getDisplayName(injection);
    assert.strictEqual(displayName, 'parameter: userRepository', 'Display name should match');
  });

  test('should support @Qualifier on constructor parameter', () => {
    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.CONSTRUCTOR,
      beanType: 'com.example.PaymentService',
      location: {
        uri: vscode.Uri.file('/test/Test.java'),
        line: 20,
        column: 8
      },
      qualifier: 'alipayService',
      isRequired: true,
      parameterName: 'paymentService',
      parameterIndex: 1
    };

    const errors = BeanInjectionPoint.validate(injection);
    assert.strictEqual(errors.length, 0, 'Constructor injection with qualifier should be valid');

    const identifier = BeanInjectionPoint.getEffectiveIdentifier(injection);
    assert.strictEqual(identifier, 'alipayService', 'Should extract qualifier');
  });
});
