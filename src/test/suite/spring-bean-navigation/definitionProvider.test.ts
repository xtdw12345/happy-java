/**
 * Integration tests for DefinitionProvider
 * Tests the Definition Provider with field injection scenarios
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { BeanIndex } from '../../../models/BeanIndex';
import { BeanResolver } from '../../../resolver/beanResolver';
import { BeanFactory } from './fixtures/BeanFactory';

suite('DefinitionProvider Integration Test Suite', () => {
  let index: BeanIndex;
  let resolver: BeanResolver;

  setup(() => {
    index = new BeanIndex();
    resolver = new BeanResolver();
  });

  test('should resolve single bean candidate', () => {
    // Setup: Add a bean to index
    const bean = BeanFactory.createServiceBean('userService', 'com.example.UserService');
    index.addBeans([bean]);

    // Create injection point
    const injection = BeanFactory.createFieldInjection('com.example.UserService', 'userService');

    // Resolve
    const candidates = resolver.resolve(injection, index);

    assert.strictEqual(candidates.length, 1, 'Should find one candidate');
    assert.strictEqual(candidates[0].beanDefinition.name, 'userService', 'Candidate should match');
  });

  test('should return empty for non-existent bean', () => {
    // Create injection point for non-existent bean
    const injection = BeanFactory.createFieldInjection('com.example.NonExistent', 'service');

    // Resolve
    const candidates = resolver.resolve(injection, index);

    assert.strictEqual(candidates.length, 0, 'Should return empty array');
  });

  test('should handle multiple candidates', () => {
    // Setup: Add multiple beans of same type
    const bean1 = BeanFactory.createServiceBean('service1', 'com.example.Service');
    const bean2 = BeanFactory.createServiceBean('service2', 'com.example.Service');
    index.addBeans([bean1, bean2]);

    // Create injection point
    const injection = BeanFactory.createFieldInjection('com.example.Service', 'service');

    // Resolve
    const candidates = resolver.resolve(injection, index);

    assert.strictEqual(candidates.length, 2, 'Should find two candidates');
  });

  test('should prioritize primary bean', () => {
    // Setup: Add regular and primary bean
    const bean1 = BeanFactory.createServiceBean('service1', 'com.example.Service');
    const bean2 = BeanFactory.createPrimaryBean('service2', 'com.example.Service');
    bean2.annotationType = '@Service';

    index.addBeans([bean1, bean2]);

    // Create injection point
    const injection = BeanFactory.createFieldInjection('com.example.Service', 'service');

    // Resolve
    const candidates = resolver.resolve(injection, index);

    // Should return only primary
    assert.strictEqual(candidates.length, 1, 'Should return only primary bean');
    assert.strictEqual(candidates[0].beanDefinition.name, 'service2', 'Primary bean should be selected');
  });

  test('should match by qualifier', () => {
    // Setup: Add qualified bean
    const bean = BeanFactory.createQualifiedBean('userService', 'com.example.Service', 'primary');
    index.addBeans([bean]);

    // Create injection with qualifier
    const injection = BeanFactory.createFieldInjection('com.example.Service', 'service');
    injection.qualifier = 'primary';

    // Resolve
    const candidates = resolver.resolve(injection, index);

    assert.strictEqual(candidates.length, 1, 'Should find qualified bean');
    assert.strictEqual(candidates[0].matchScore, 100, 'Qualifier match should have highest score');
  });

  test('should match by bean name', () => {
    // Setup: Add bean
    const bean = BeanFactory.createServiceBean('customService', 'com.example.Service');
    index.addBeans([bean]);

    // Create injection with explicit bean name
    const injection = BeanFactory.createFieldInjection('com.example.Service', 'service');
    injection.beanName = 'customService';

    // Resolve
    const candidates = resolver.resolve(injection, index);

    assert.strictEqual(candidates.length, 1, 'Should find bean by name');
    assert.strictEqual(candidates[0].matchScore, 90, 'Name match should have score 90');
  });

  test('should verify bean location information', () => {
    // Setup
    const bean = BeanFactory.createServiceBean('userService', 'com.example.UserService');
    index.addBeans([bean]);

    const injection = BeanFactory.createFieldInjection('com.example.UserService', 'userService');

    // Resolve
    const candidates = resolver.resolve(injection, index);

    assert.ok(candidates[0].beanDefinition.location, 'Bean should have location');
    assert.ok(candidates[0].beanDefinition.location.uri, 'Location should have URI');
  });

  // Constructor injection tests (User Story 2)
  test('should resolve constructor parameter injection', () => {
    // Setup: Add a bean to index
    const bean = BeanFactory.createServiceBean('userRepository', 'com.example.UserRepository');
    index.addBeans([bean]);

    // Create constructor injection point
    const injection = BeanFactory.createConstructorInjection('com.example.UserRepository', 'userRepository', 0);

    // Resolve
    const candidates = resolver.resolve(injection, index);

    assert.strictEqual(candidates.length, 1, 'Should find one candidate');
    assert.strictEqual(candidates[0].beanDefinition.name, 'userRepository', 'Candidate should match');
  });

  test('should resolve multiple constructor parameters', () => {
    // Setup: Add multiple beans
    const bean1 = BeanFactory.createServiceBean('userRepository', 'com.example.UserRepository');
    const bean2 = BeanFactory.createServiceBean('paymentService', 'com.example.PaymentService');
    index.addBeans([bean1, bean2]);

    // First constructor parameter
    const injection1 = BeanFactory.createConstructorInjection('com.example.UserRepository', 'userRepository', 0);
    const candidates1 = resolver.resolve(injection1, index);
    assert.strictEqual(candidates1.length, 1, 'Should find first parameter bean');

    // Second constructor parameter
    const injection2 = BeanFactory.createConstructorInjection('com.example.PaymentService', 'paymentService', 1);
    const candidates2 = resolver.resolve(injection2, index);
    assert.strictEqual(candidates2.length, 1, 'Should find second parameter bean');
  });

  test('should handle @Qualifier on constructor parameter', () => {
    // Setup: Add qualified bean
    const bean = BeanFactory.createQualifiedBean('alipayService', 'com.example.PaymentService', 'alipay');
    index.addBeans([bean]);

    // Create constructor injection with qualifier
    const injection = BeanFactory.createConstructorInjection('com.example.PaymentService', 'paymentService', 0);
    injection.qualifier = 'alipay';

    // Resolve
    const candidates = resolver.resolve(injection, index);

    assert.strictEqual(candidates.length, 1, 'Should find qualified bean');
    assert.strictEqual(candidates[0].matchScore, 100, 'Qualifier match should have highest score');
  });
});
