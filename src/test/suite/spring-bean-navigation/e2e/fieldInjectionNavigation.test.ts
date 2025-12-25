/**
 * E2E test for field injection navigation
 * Tests the complete flow from @Autowired field to Bean definition
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { BeanIndex } from '../../../../models/BeanIndex';
import { BeanIndexer } from '../../../../indexer/beanIndexer';
import { BeanResolver } from '../../../../resolver/beanResolver';
import { BeanFactory } from '../fixtures/BeanFactory';

suite('Field Injection Navigation E2E Test Suite', () => {
  test('should navigate from field injection to bean definition', () => {
    // Setup: Create a bean definition
    const beanDef = BeanFactory.createServiceBean('userService', 'com.example.UserService');

    // Create injection point
    const injection = BeanFactory.createFieldInjection('com.example.UserService', 'userService');

    // Build index
    const index = new BeanIndex();
    index.addBeans([beanDef]);

    // Resolve
    const resolver = new BeanResolver();
    const candidates = resolver.resolve(injection, index);

    // Verify
    assert.strictEqual(candidates.length, 1, 'Should find one bean');
    assert.strictEqual(candidates[0].beanDefinition.name, 'userService', 'Bean name should match');
    assert.strictEqual(candidates[0].beanDefinition.type, 'com.example.UserService', 'Bean type should match');
    assert.strictEqual(candidates[0].beanDefinition.annotationType, '@Service', 'Annotation type should match');

    // Verify location can be used for navigation
    const location = candidates[0].beanDefinition.location;
    assert.ok(location.uri, 'Should have URI');
    assert.ok(location.line >= 0, 'Should have line number');
  });

  test('should show multiple candidates when multiple beans match', () => {
    // Setup: Create multiple beans of same type
    const bean1 = BeanFactory.createServiceBean('alipayService', 'com.example.PaymentService');
    const bean2 = BeanFactory.createServiceBean('wechatPayService', 'com.example.PaymentService');

    // Create injection point
    const injection = BeanFactory.createFieldInjection('com.example.PaymentService', 'paymentService');

    // Build index
    const index = new BeanIndex();
    index.addBeans([bean1, bean2]);

    // Resolve
    const resolver = new BeanResolver();
    const candidates = resolver.resolve(injection, index);

    // Verify multiple candidates
    assert.strictEqual(candidates.length, 2, 'Should find two beans');

    // Verify candidates are properly formatted for Quick Pick
    candidates.forEach(candidate => {
      assert.ok(candidate.displayLabel, 'Should have display label');
      assert.ok(candidate.displayDescription, 'Should have display description');
      assert.ok(candidate.matchScore > 0, 'Should have match score');
    });
  });

  test('should prioritize @Primary bean in navigation', () => {
    // Setup: Create regular and primary beans
    const bean1 = BeanFactory.createServiceBean('service1', 'com.example.Service');
    const bean2 = BeanFactory.createPrimaryBean('service2', 'com.example.Service');
    bean2.annotationType = '@Service';

    // Create injection point
    const injection = BeanFactory.createFieldInjection('com.example.Service', 'service');

    // Build index
    const index = new BeanIndex();
    index.addBeans([bean1, bean2]);

    // Resolve
    const resolver = new BeanResolver();
    const candidates = resolver.resolve(injection, index);

    // Should return only primary bean
    assert.strictEqual(candidates.length, 1, 'Should return only primary bean');
    assert.strictEqual(candidates[0].beanDefinition.name, 'service2', 'Primary bean should be selected');
    assert.strictEqual(candidates[0].beanDefinition.isPrimary, true, 'Bean should be marked as primary');
  });

  test('should handle @Qualifier matching in navigation', () => {
    // Setup: Create qualified beans
    const bean1 = BeanFactory.createQualifiedBean('service1', 'com.example.Service', 'primary');
    const bean2 = BeanFactory.createQualifiedBean('service2', 'com.example.Service', 'secondary');

    // Create injection with qualifier
    const injection = BeanFactory.createFieldInjection('com.example.Service', 'service');
    injection.qualifier = 'primary';

    // Build index
    const index = new BeanIndex();
    index.addBeans([bean1, bean2]);

    // Resolve
    const resolver = new BeanResolver();
    const candidates = resolver.resolve(injection, index);

    // Should return only qualified bean
    assert.strictEqual(candidates.length, 1, 'Should return only qualified bean');
    assert.strictEqual(candidates[0].beanDefinition.name, 'service1', 'Qualified bean should be selected');
    assert.strictEqual(candidates[0].matchScore, 100, 'Qualifier match should have highest score');
  });

  test('should return empty when no bean matches', () => {
    // Create injection point for non-existent bean
    const injection = BeanFactory.createFieldInjection('com.example.NonExistentService', 'service');

    // Build empty index
    const index = new BeanIndex();

    // Resolve
    const resolver = new BeanResolver();
    const candidates = resolver.resolve(injection, index);

    // Should return empty
    assert.strictEqual(candidates.length, 0, 'Should return no candidates');
  });

  test('should verify indexer can build index from workspace', async () => {
    // This test verifies the indexer infrastructure
    const indexer = new BeanIndexer();

    // Initialize with empty workspace folders array (test mode)
    await indexer.initialize({} as any, []);

    // Get initial stats
    const stats = indexer.getStats();
    assert.ok(stats, 'Should return stats');
    assert.strictEqual(stats.totalBeans, 0, 'Initial index should be empty');
  });
});
