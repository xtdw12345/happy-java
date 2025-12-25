/**
 * E2E test for constructor injection navigation
 * Tests the complete flow from constructor parameter to Bean definition
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { BeanIndex } from '../../../../models/BeanIndex';
import { BeanResolver } from '../../../../resolver/beanResolver';
import { BeanFactory } from '../fixtures/BeanFactory';

suite('Constructor Injection Navigation E2E Test Suite', () => {
  test('should navigate from constructor parameter to bean definition', () => {
    // Setup: Create a bean definition
    const beanDef = BeanFactory.createServiceBean('userRepository', 'com.example.UserRepository');

    // Create constructor injection point
    const injection = BeanFactory.createConstructorInjection('com.example.UserRepository', 'userRepository', 0);

    // Build index
    const index = new BeanIndex();
    index.addBeans([beanDef]);

    // Resolve
    const resolver = new BeanResolver();
    const candidates = resolver.resolve(injection, index);

    // Verify
    assert.strictEqual(candidates.length, 1, 'Should find one bean');
    assert.strictEqual(candidates[0].beanDefinition.name, 'userRepository', 'Bean name should match');
    assert.strictEqual(candidates[0].beanDefinition.type, 'com.example.UserRepository', 'Bean type should match');
    assert.strictEqual(candidates[0].beanDefinition.annotationType, '@Service', 'Annotation type should match');

    // Verify location can be used for navigation
    const location = candidates[0].beanDefinition.location;
    assert.ok(location.uri, 'Should have URI');
    assert.ok(location.line >= 0, 'Should have line number');
  });

  test('should handle multi-parameter constructor', () => {
    // Setup: Create multiple beans
    const bean1 = BeanFactory.createServiceBean('userRepository', 'com.example.UserRepository');
    const bean2 = BeanFactory.createServiceBean('paymentService', 'com.example.PaymentService');
    const bean3 = BeanFactory.createServiceBean('notificationService', 'com.example.NotificationService');

    // Build index
    const index = new BeanIndex();
    index.addBeans([bean1, bean2, bean3]);

    const resolver = new BeanResolver();

    // Test first parameter
    const injection1 = BeanFactory.createConstructorInjection('com.example.UserRepository', 'userRepository', 0);
    const candidates1 = resolver.resolve(injection1, index);
    assert.strictEqual(candidates1.length, 1, 'Should resolve first parameter');
    assert.strictEqual(candidates1[0].beanDefinition.name, 'userRepository');

    // Test second parameter
    const injection2 = BeanFactory.createConstructorInjection('com.example.PaymentService', 'paymentService', 1);
    const candidates2 = resolver.resolve(injection2, index);
    assert.strictEqual(candidates2.length, 1, 'Should resolve second parameter');
    assert.strictEqual(candidates2[0].beanDefinition.name, 'paymentService');

    // Test third parameter
    const injection3 = BeanFactory.createConstructorInjection('com.example.NotificationService', 'notificationService', 2);
    const candidates3 = resolver.resolve(injection3, index);
    assert.strictEqual(candidates3.length, 1, 'Should resolve third parameter');
    assert.strictEqual(candidates3[0].beanDefinition.name, 'notificationService');
  });

  test('should prioritize @Primary bean for constructor parameter', () => {
    // Setup: Create regular and primary beans
    const bean1 = BeanFactory.createServiceBean('repo1', 'com.example.Repository');
    const bean2 = BeanFactory.createPrimaryBean('repo2', 'com.example.Repository');
    bean2.annotationType = '@Repository';

    // Create constructor injection
    const injection = BeanFactory.createConstructorInjection('com.example.Repository', 'repository', 0);

    // Build index
    const index = new BeanIndex();
    index.addBeans([bean1, bean2]);

    // Resolve
    const resolver = new BeanResolver();
    const candidates = resolver.resolve(injection, index);

    // Should return only primary bean
    assert.strictEqual(candidates.length, 1, 'Should return only primary bean');
    assert.strictEqual(candidates[0].beanDefinition.name, 'repo2', 'Primary bean should be selected');
    assert.strictEqual(candidates[0].beanDefinition.isPrimary, true, 'Bean should be marked as primary');
  });

  test('should handle @Qualifier on constructor parameter', () => {
    // Setup: Create qualified beans
    const bean1 = BeanFactory.createQualifiedBean('alipayService', 'com.example.PaymentService', 'alipay');
    const bean2 = BeanFactory.createQualifiedBean('wechatPayService', 'com.example.PaymentService', 'wechatpay');

    // Create constructor injection with qualifier
    const injection = BeanFactory.createConstructorInjection('com.example.PaymentService', 'paymentService', 0);
    injection.qualifier = 'alipay';

    // Build index
    const index = new BeanIndex();
    index.addBeans([bean1, bean2]);

    // Resolve
    const resolver = new BeanResolver();
    const candidates = resolver.resolve(injection, index);

    // Should return only qualified bean
    assert.strictEqual(candidates.length, 1, 'Should return only qualified bean');
    assert.strictEqual(candidates[0].beanDefinition.name, 'alipayService', 'Qualified bean should be selected');
    assert.strictEqual(candidates[0].matchScore, 100, 'Qualifier match should have highest score');
  });

  test('should show multiple candidates when multiple beans match constructor parameter', () => {
    // Setup: Create multiple beans of same type
    const bean1 = BeanFactory.createServiceBean('mysqlRepo', 'com.example.DataRepository');
    const bean2 = BeanFactory.createServiceBean('mongoRepo', 'com.example.DataRepository');
    const bean3 = BeanFactory.createServiceBean('redisRepo', 'com.example.DataRepository');

    // Create constructor injection
    const injection = BeanFactory.createConstructorInjection('com.example.DataRepository', 'dataRepository', 0);

    // Build index
    const index = new BeanIndex();
    index.addBeans([bean1, bean2, bean3]);

    // Resolve
    const resolver = new BeanResolver();
    const candidates = resolver.resolve(injection, index);

    // Verify multiple candidates
    assert.strictEqual(candidates.length, 3, 'Should find three beans');

    // Verify candidates are properly formatted for Quick Pick
    candidates.forEach(candidate => {
      assert.ok(candidate.displayLabel, 'Should have display label');
      assert.ok(candidate.displayDescription, 'Should have display description');
      assert.ok(candidate.matchScore > 0, 'Should have match score');
    });
  });

  test('should return empty when no bean matches constructor parameter', () => {
    // Create injection point for non-existent bean
    const injection = BeanFactory.createConstructorInjection('com.example.NonExistentRepository', 'repository', 0);

    // Build empty index
    const index = new BeanIndex();

    // Resolve
    const resolver = new BeanResolver();
    const candidates = resolver.resolve(injection, index);

    // Should return empty
    assert.strictEqual(candidates.length, 0, 'Should return no candidates');
  });

  test('should handle constructor with both autowired and manual dependencies', () => {
    // Scenario: Constructor has multiple parameters, only some are Spring beans
    // Setup: Only create bean for autowired dependency
    const autowiredBean = BeanFactory.createServiceBean('userService', 'com.example.UserService');

    // Build index
    const index = new BeanIndex();
    index.addBeans([autowiredBean]);

    const resolver = new BeanResolver();

    // Autowired parameter - should resolve
    const autowiredInjection = BeanFactory.createConstructorInjection('com.example.UserService', 'userService', 0);
    const autowiredCandidates = resolver.resolve(autowiredInjection, index);
    assert.strictEqual(autowiredCandidates.length, 1, 'Autowired parameter should resolve');

    // Manual parameter (like String, int) - should not resolve to any bean
    const manualInjection = BeanFactory.createConstructorInjection('java.lang.String', 'configValue', 1);
    const manualCandidates = resolver.resolve(manualInjection, index);
    assert.strictEqual(manualCandidates.length, 0, 'Manual parameter should not resolve');
  });
});
