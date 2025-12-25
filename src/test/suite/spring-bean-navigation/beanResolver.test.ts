/**
 * Unit tests for BeanResolver type matching
 */

import * as assert from 'assert';
import { BeanResolver } from '../../../resolver/beanResolver';
import { BeanDefinition } from '../../../models/BeanDefinition';
import { BeanInjectionPoint } from '../../../models/BeanInjectionPoint';
import { BeanDefinitionType, InjectionType, MatchReason } from '../../../models/types';
import { BeanLocation } from '../../../models/BeanLocation';
import * as vscode from 'vscode';

suite('BeanResolver Type Matching Test Suite', () => {
  let resolver: BeanResolver;
  let mockLocation: BeanLocation;

  setup(() => {
    resolver = new BeanResolver();
    mockLocation = {
      uri: vscode.Uri.file('/test.java'),
      line: 0,
      column: 0
    };
  });

  test('should match exact FQN types', () => {
    const bean: BeanDefinition = {
      name: 'userService',
      type: 'com.example.service.UserService',
      definitionType: BeanDefinitionType.COMPONENT,
      location: mockLocation,
      annotationType: '@Service',
      scope: 'singleton',
      qualifiers: [],
      isPrimary: false,
      isConditional: false
    };

    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'com.example.service.UserService',
      location: mockLocation,
      isRequired: true
    };

    const result = resolver.matches(bean, injection);
    assert.strictEqual(result.isMatch, true, 'Should match exact FQN');
    assert.strictEqual(result.reason, MatchReason.TYPE_MATCH);
  });

  test('should match simple name against FQN bean type', () => {
    const bean: BeanDefinition = {
      name: 'userService',
      type: 'com.example.service.UserService',
      definitionType: BeanDefinitionType.COMPONENT,
      location: mockLocation,
      annotationType: '@Service',
      scope: 'singleton',
      qualifiers: [],
      isPrimary: false,
      isConditional: false
    };

    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'UserService', // Simple name
      location: mockLocation,
      isRequired: true
    };

    const result = resolver.matches(bean, injection);
    assert.strictEqual(result.isMatch, true, 'Should match simple name against FQN');
    assert.strictEqual(result.reason, MatchReason.TYPE_MATCH);
  });

  test('should match FQN injection against simple bean type', () => {
    const bean: BeanDefinition = {
      name: 'userService',
      type: 'UserService', // Simple name
      definitionType: BeanDefinitionType.COMPONENT,
      location: mockLocation,
      annotationType: '@Service',
      scope: 'singleton',
      qualifiers: [],
      isPrimary: false,
      isConditional: false
    };

    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'com.example.service.UserService', // FQN
      location: mockLocation,
      isRequired: true
    };

    const result = resolver.matches(bean, injection);
    assert.strictEqual(result.isMatch, true, 'Should match FQN against simple bean type');
    assert.strictEqual(result.reason, MatchReason.TYPE_MATCH);
  });

  test('should match exact simple names', () => {
    const bean: BeanDefinition = {
      name: 'userService',
      type: 'UserService',
      definitionType: BeanDefinitionType.COMPONENT,
      location: mockLocation,
      annotationType: '@Service',
      scope: 'singleton',
      qualifiers: [],
      isPrimary: false,
      isConditional: false
    };

    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'UserService',
      location: mockLocation,
      isRequired: true
    };

    const result = resolver.matches(bean, injection);
    assert.strictEqual(result.isMatch, true, 'Should match exact simple names');
    assert.strictEqual(result.reason, MatchReason.TYPE_MATCH);
  });

  test('should not match different types', () => {
    const bean: BeanDefinition = {
      name: 'userService',
      type: 'com.example.service.UserService',
      definitionType: BeanDefinitionType.COMPONENT,
      location: mockLocation,
      annotationType: '@Service',
      scope: 'singleton',
      qualifiers: [],
      isPrimary: false,
      isConditional: false
    };

    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'OrderService', // Different type
      location: mockLocation,
      isRequired: true
    };

    const result = resolver.matches(bean, injection);
    assert.strictEqual(result.isMatch, false, 'Should not match different types');
  });

  test('should not match partial class names', () => {
    const bean: BeanDefinition = {
      name: 'userService',
      type: 'com.example.service.UserService',
      definitionType: BeanDefinitionType.COMPONENT,
      location: mockLocation,
      annotationType: '@Service',
      scope: 'singleton',
      qualifiers: [],
      isPrimary: false,
      isConditional: false
    };

    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'Service', // Partial match, should not work
      location: mockLocation,
      isRequired: true
    };

    const result = resolver.matches(bean, injection);
    assert.strictEqual(result.isMatch, false, 'Should not match partial class names');
  });

  test('should prioritize Primary bean in type matching', () => {
    const bean: BeanDefinition = {
      name: 'userService',
      type: 'com.example.service.UserService',
      definitionType: BeanDefinitionType.COMPONENT,
      location: mockLocation,
      annotationType: '@Service',
      scope: 'singleton',
      qualifiers: [],
      isPrimary: true, // Primary bean
      isConditional: false
    };

    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'UserService',
      location: mockLocation,
      isRequired: true
    };

    const result = resolver.matches(bean, injection);
    assert.strictEqual(result.isMatch, true, 'Should match');
    assert.strictEqual(result.reason, MatchReason.PRIMARY_BEAN, 'Should identify as primary bean');
    assert.strictEqual(result.score, 80, 'Primary bean should have score 80');
  });

  test('should match CopyService example', () => {
    // Real-world test case from user's CopyController
    const bean: BeanDefinition = {
      name: 'copyService',
      type: 'com.translationcenter.service.CopyService', // FQN from indexer
      definitionType: BeanDefinitionType.COMPONENT,
      location: mockLocation,
      annotationType: '@Service',
      scope: 'singleton',
      qualifiers: [],
      isPrimary: false,
      isConditional: false
    };

    const injection: BeanInjectionPoint = {
      injectionType: InjectionType.FIELD,
      beanType: 'CopyService', // Simple name from field declaration
      location: mockLocation,
      isRequired: true,
      fieldName: 'copyService'
    };

    const result = resolver.matches(bean, injection);
    assert.strictEqual(result.isMatch, true, 'Should match CopyService');
    assert.strictEqual(result.reason, MatchReason.TYPE_MATCH);
    assert.strictEqual(result.score, 70, 'Type match should have score 70');
  });
});
