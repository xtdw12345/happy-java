/**
 * Unit tests for InterfaceResolver - Resolution logic for interface-to-bean mapping
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { InterfaceResolutionResult, DisambiguationContext, BeanDefinitionType } from '../../../../spring-bean-navigation/models/types';
import { BeanDefinition } from '../../../../spring-bean-navigation/models/BeanDefinition';
import { BeanLocation } from '../../../../spring-bean-navigation/models/BeanLocation';
import { InterfaceResolver } from '../../../../spring-bean-navigation/indexing/InterfaceResolver';

suite('InterfaceResolver Test Suite', () => {
  let resolver: InterfaceResolver;

  const mockLocation: BeanLocation = {
    uri: vscode.Uri.file('/test/Test.java'),
    line: 10,
    column: 1
  };

  const createMockBean = (
    name: string,
    type: string,
    isPrimary: boolean = false,
    qualifiers?: string[]
  ): BeanDefinition => ({
    name,
    type,
    definitionType: BeanDefinitionType.COMPONENT,
    location: mockLocation,
    annotationType: '@Service',
    isPrimary,
    isConditional: false,
    qualifiers,
    implementedInterfaces: ['com.example.TestInterface']
  });

  setup(() => {
    resolver = new InterfaceResolver();
  });

  suite('resolveSingle() - Single implementation resolution', () => {
    test('should return "single" when exactly one candidate', () => {
      const bean = createMockBean('testBean', 'com.example.TestBean');
      const result = resolver.resolveSingle([bean]);

      assert.strictEqual(result.status, 'single');
      if (result.status === 'single') {
        assert.strictEqual(result.bean.name, 'testBean');
      }
    });

    test('should return "none" when no candidates', () => {
      const result = resolver.resolveSingle([]);

      assert.strictEqual(result.status, 'none');
    });

    test('should return "multiple" when more than one candidate', () => {
      const bean1 = createMockBean('bean1', 'com.example.Bean1');
      const bean2 = createMockBean('bean2', 'com.example.Bean2');
      const result = resolver.resolveSingle([bean1, bean2]);

      assert.strictEqual(result.status, 'multiple');
      if (result.status === 'multiple') {
        assert.strictEqual(result.candidates.length, 2);
      }
    });
  });

  suite('resolveByPrimary() - @Primary disambiguation', () => {
    test('should return "primary" when one @Primary bean exists', () => {
      const primaryBean = createMockBean('primaryBean', 'com.example.Primary', true);
      const regularBean = createMockBean('regularBean', 'com.example.Regular');
      const result = resolver.resolveByPrimary([primaryBean, regularBean]);

      assert.strictEqual(result.status, 'primary');
      if (result.status === 'primary') {
        assert.strictEqual(result.bean.name, 'primaryBean');
        assert.strictEqual(result.bean.isPrimary, true);
      }
    });

    test('should return "none" when no @Primary beans', () => {
      const bean1 = createMockBean('bean1', 'com.example.Bean1');
      const bean2 = createMockBean('bean2', 'com.example.Bean2');
      const result = resolver.resolveByPrimary([bean1, bean2]);

      assert.strictEqual(result.status, 'none');
    });

    test('should return "none" when multiple @Primary beans exist', () => {
      const primary1 = createMockBean('primary1', 'com.example.Primary1', true);
      const primary2 = createMockBean('primary2', 'com.example.Primary2', true);
      const result = resolver.resolveByPrimary([primary1, primary2]);

      // Multiple @Primary is a configuration error - return none
      assert.strictEqual(result.status, 'none');
    });

    test('should return "none" for empty candidates', () => {
      const result = resolver.resolveByPrimary([]);

      assert.strictEqual(result.status, 'none');
    });
  });

  suite('resolveByQualifier() - @Qualifier matching', () => {
    test('should return "qualified" when qualifier matches bean name', () => {
      const bean1 = createMockBean('specificBean', 'com.example.Bean1');
      const bean2 = createMockBean('otherBean', 'com.example.Bean2');
      const result = resolver.resolveByQualifier([bean1, bean2], 'specificBean');

      assert.strictEqual(result.status, 'qualified');
      if (result.status === 'qualified') {
        assert.strictEqual(result.bean.name, 'specificBean');
      }
    });

    test('should return "qualified" when qualifier matches @Qualifier annotation', () => {
      const bean1 = createMockBean('bean1', 'com.example.Bean1', false, ['custom']);
      const bean2 = createMockBean('bean2', 'com.example.Bean2');
      const result = resolver.resolveByQualifier([bean1, bean2], 'custom');

      assert.strictEqual(result.status, 'qualified');
      if (result.status === 'qualified') {
        assert.strictEqual(result.bean.name, 'bean1');
      }
    });

    test('should return "none" when qualifier does not match any bean', () => {
      const bean1 = createMockBean('bean1', 'com.example.Bean1');
      const bean2 = createMockBean('bean2', 'com.example.Bean2');
      const result = resolver.resolveByQualifier([bean1, bean2], 'nonExistent');

      assert.strictEqual(result.status, 'none');
    });

    test('should return "multiple" when qualifier matches multiple beans', () => {
      // This is a rare edge case - multiple beans with same qualifier
      const bean1 = createMockBean('bean1', 'com.example.Bean1', false, ['shared']);
      const bean2 = createMockBean('bean2', 'com.example.Bean2', false, ['shared']);
      const result = resolver.resolveByQualifier([bean1, bean2], 'shared');

      assert.strictEqual(result.status, 'multiple');
      if (result.status === 'multiple') {
        assert.strictEqual(result.candidates.length, 2);
      }
    });
  });

  suite('filterByType() - Type filtering', () => {
    test('should filter beans implementing specific interface', () => {
      const bean1 = createMockBean('bean1', 'com.example.Bean1');
      bean1.implementedInterfaces = ['com.example.Interface1'];

      const bean2 = createMockBean('bean2', 'com.example.Bean2');
      bean2.implementedInterfaces = ['com.example.Interface2'];

      const filtered = resolver.filterByType([bean1, bean2], 'com.example.Interface1');

      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].name, 'bean1');
    });

    test('should return empty array when no beans match type', () => {
      const bean1 = createMockBean('bean1', 'com.example.Bean1');
      bean1.implementedInterfaces = ['com.example.Interface1'];

      const filtered = resolver.filterByType([bean1], 'com.example.NonExistent');

      assert.strictEqual(filtered.length, 0);
    });

    test('should match beans by exact type if no implemented interfaces', () => {
      const bean1 = createMockBean('bean1', 'com.example.Bean1');
      bean1.implementedInterfaces = undefined;

      const filtered = resolver.filterByType([bean1], 'com.example.Bean1');

      assert.strictEqual(filtered.length, 1);
    });
  });

  suite('resolve() - Full resolution cascade', () => {
    test('should resolve to single bean when only one candidate', () => {
      const bean = createMockBean('onlyBean', 'com.example.OnlyBean');
      const context: DisambiguationContext = {
        interfaceFQN: 'com.example.TestInterface',
        rawType: 'TestInterface',
        candidates: [bean],
        injectionLocation: mockLocation
      };

      const result = resolver.resolve(context);

      assert.strictEqual(result.status, 'single');
    });

    test('should prioritize qualifier over @Primary', () => {
      const primaryBean = createMockBean('primaryBean', 'com.example.Primary', true);
      const qualifiedBean = createMockBean('qualifiedBean', 'com.example.Qualified', false, ['special']);

      const context: DisambiguationContext = {
        interfaceFQN: 'com.example.TestInterface',
        rawType: 'TestInterface',
        qualifier: 'special',
        candidates: [primaryBean, qualifiedBean],
        injectionLocation: mockLocation
      };

      const result = resolver.resolve(context);

      assert.strictEqual(result.status, 'qualified');
      if (result.status === 'qualified') {
        assert.strictEqual(result.bean.name, 'qualifiedBean');
      }
    });

    test('should fall back to @Primary when no qualifier', () => {
      const primaryBean = createMockBean('primaryBean', 'com.example.Primary', true);
      const regularBean = createMockBean('regularBean', 'com.example.Regular');

      const context: DisambiguationContext = {
        interfaceFQN: 'com.example.TestInterface',
        rawType: 'TestInterface',
        candidates: [primaryBean, regularBean],
        injectionLocation: mockLocation
      };

      const result = resolver.resolve(context);

      assert.strictEqual(result.status, 'primary');
      if (result.status === 'primary') {
        assert.strictEqual(result.bean.name, 'primaryBean');
      }
    });

    test('should return multiple when no disambiguation possible', () => {
      const bean1 = createMockBean('bean1', 'com.example.Bean1');
      const bean2 = createMockBean('bean2', 'com.example.Bean2');

      const context: DisambiguationContext = {
        interfaceFQN: 'com.example.TestInterface',
        rawType: 'TestInterface',
        candidates: [bean1, bean2],
        injectionLocation: mockLocation
      };

      const result = resolver.resolve(context);

      assert.strictEqual(result.status, 'multiple');
      if (result.status === 'multiple') {
        assert.strictEqual(result.candidates.length, 2);
      }
    });

    test('should return none when no candidates', () => {
      const context: DisambiguationContext = {
        interfaceFQN: 'com.example.NonExistent',
        rawType: 'NonExistent',
        candidates: [],
        injectionLocation: mockLocation
      };

      const result = resolver.resolve(context);

      assert.strictEqual(result.status, 'none');
    });
  });

  suite('Integration scenarios', () => {
    test('User Story 1: Single implementation (80% of cases)', () => {
      const userRepo = createMockBean('userRepositoryImpl', 'com.example.UserRepositoryImpl');
      userRepo.implementedInterfaces = ['com.example.repository.UserRepository'];

      const context: DisambiguationContext = {
        interfaceFQN: 'com.example.repository.UserRepository',
        rawType: 'UserRepository',
        candidates: [userRepo],
        injectionLocation: mockLocation
      };

      const result = resolver.resolve(context);

      assert.strictEqual(result.status, 'single');
      if (result.status === 'single') {
        assert.strictEqual(result.bean.name, 'userRepositoryImpl');
      }
    });

    test('User Story 2: Multiple implementations with @Primary', () => {
      const stripe = createMockBean('stripePaymentService', 'com.example.StripePaymentService', true);
      const paypal = createMockBean('paypalPaymentService', 'com.example.PayPalPaymentService');

      stripe.implementedInterfaces = ['com.example.service.PaymentService'];
      paypal.implementedInterfaces = ['com.example.service.PaymentService'];

      const context: DisambiguationContext = {
        interfaceFQN: 'com.example.service.PaymentService',
        rawType: 'PaymentService',
        candidates: [stripe, paypal],
        injectionLocation: mockLocation
      };

      const result = resolver.resolve(context);

      assert.strictEqual(result.status, 'primary');
      if (result.status === 'primary') {
        assert.strictEqual(result.bean.name, 'stripePaymentService');
      }
    });

    test('User Story 3: @Qualifier disambiguation', () => {
      const stripe = createMockBean('stripePaymentService', 'com.example.StripePaymentService', true);
      const paypal = createMockBean('paypalPaymentService', 'com.example.PayPalPaymentService', false, ['paypal']);

      stripe.implementedInterfaces = ['com.example.service.PaymentService'];
      paypal.implementedInterfaces = ['com.example.service.PaymentService'];

      const context: DisambiguationContext = {
        interfaceFQN: 'com.example.service.PaymentService',
        rawType: 'PaymentService',
        qualifier: 'paypal',
        candidates: [stripe, paypal],
        injectionLocation: mockLocation
      };

      const result = resolver.resolve(context);

      assert.strictEqual(result.status, 'qualified');
      if (result.status === 'qualified') {
        assert.strictEqual(result.bean.name, 'paypalPaymentService');
      }
    });
  });
});
