/**
 * Unit tests for InterfaceRegistry - Interface-to-implementation mapping
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { InterfaceDefinition, ImplementationRelationship, BeanDefinitionType } from '../../../../spring-bean-navigation/models/types';
import { BeanDefinition } from '../../../../spring-bean-navigation/models/BeanDefinition';
import { BeanLocation } from '../../../../spring-bean-navigation/models/BeanLocation';
import { InterfaceRegistry } from '../../../../spring-bean-navigation/indexing/InterfaceRegistry';

suite('InterfaceRegistry Test Suite', () => {
  let registry: InterfaceRegistry;

  const mockLocation: BeanLocation = {
    uri: vscode.Uri.file('/test/UserRepository.java'),
    line: 10,
    column: 1
  };

  const mockInterface: InterfaceDefinition = {
    fullyQualifiedName: 'com.example.repository.UserRepository',
    simpleName: 'UserRepository',
    packageName: 'com.example.repository',
    location: mockLocation,
    isAbstract: false,
    rawType: 'UserRepository'
  };

  const mockBean: BeanDefinition = {
    name: 'userRepositoryImpl',
    type: 'com.example.repository.UserRepositoryImpl',
    definitionType: BeanDefinitionType.COMPONENT,
    location: mockLocation,
    annotationType: '@Repository',
    isPrimary: false,
    isConditional: false,
    implementedInterfaces: ['com.example.repository.UserRepository']
  };

  setup(() => {
    registry = new InterfaceRegistry();
  });

  suite('registerInterface()', () => {
    test('should register a new interface', () => {
      registry.registerInterface(mockInterface);
      assert.strictEqual(registry.hasInterface('com.example.repository.UserRepository'), true);
    });

    test('should allow registering multiple interfaces', () => {
      const interface1: InterfaceDefinition = {
        ...mockInterface,
        fullyQualifiedName: 'com.example.Interface1',
        simpleName: 'Interface1'
      };
      const interface2: InterfaceDefinition = {
        ...mockInterface,
        fullyQualifiedName: 'com.example.Interface2',
        simpleName: 'Interface2'
      };

      registry.registerInterface(interface1);
      registry.registerInterface(interface2);

      assert.strictEqual(registry.hasInterface('com.example.Interface1'), true);
      assert.strictEqual(registry.hasInterface('com.example.Interface2'), true);
    });

    test('should update interface if registered again with same FQN', () => {
      registry.registerInterface(mockInterface);

      const updatedInterface: InterfaceDefinition = {
        ...mockInterface,
        simpleName: 'UpdatedName'
      };

      registry.registerInterface(updatedInterface);
      const interfaces = registry.getAllInterfaces();
      const found = interfaces.find(i => i.fullyQualifiedName === mockInterface.fullyQualifiedName);

      assert.strictEqual(found?.simpleName, 'UpdatedName');
    });
  });

  suite('registerImplementation()', () => {
    test('should register a bean as implementation of an interface', () => {
      registry.registerImplementation('com.example.repository.UserRepository', mockBean, 'implements_clause');

      const implementations = registry.getImplementations('com.example.repository.UserRepository');
      assert.strictEqual(implementations.length, 1);
      assert.strictEqual(implementations[0].name, 'userRepositoryImpl');
    });

    test('should allow multiple implementations for same interface', () => {
      const bean1: BeanDefinition = {
        ...mockBean,
        name: 'impl1'
      };
      const bean2: BeanDefinition = {
        ...mockBean,
        name: 'impl2'
      };

      registry.registerImplementation('com.example.Interface', bean1, 'implements_clause');
      registry.registerImplementation('com.example.Interface', bean2, 'implements_clause');

      const implementations = registry.getImplementations('com.example.Interface');
      assert.strictEqual(implementations.length, 2);
    });

    test('should track bidirectional mapping (bean to interfaces)', () => {
      registry.registerImplementation('com.example.Interface1', mockBean, 'implements_clause');
      registry.registerImplementation('com.example.Interface2', mockBean, 'implements_clause');

      const interfaces = registry.getInterfaceFor('userRepositoryImpl');
      assert.strictEqual(interfaces.length, 2);
      assert.ok(interfaces.includes('com.example.Interface1'));
      assert.ok(interfaces.includes('com.example.Interface2'));
    });
  });

  suite('getImplementations()', () => {
    test('should return empty array for interface with no implementations', () => {
      const implementations = registry.getImplementations('com.example.NonExistent');
      assert.strictEqual(implementations.length, 0);
    });

    test('should return all implementations for an interface', () => {
      const bean1: BeanDefinition = { ...mockBean, name: 'bean1' };
      const bean2: BeanDefinition = { ...mockBean, name: 'bean2' };
      const bean3: BeanDefinition = { ...mockBean, name: 'bean3' };

      registry.registerImplementation('com.example.Interface', bean1, 'implements_clause');
      registry.registerImplementation('com.example.Interface', bean2, 'bean_return_type');
      registry.registerImplementation('com.example.Interface', bean3, 'extends_abstract');

      const implementations = registry.getImplementations('com.example.Interface');
      assert.strictEqual(implementations.length, 3);
    });
  });

  suite('getInterfaceFor()', () => {
    test('should return empty array for bean not implementing any interface', () => {
      const interfaces = registry.getInterfaceFor('nonExistentBean');
      assert.strictEqual(interfaces.length, 0);
    });

    test('should return all interfaces implemented by a bean', () => {
      registry.registerImplementation('com.example.Interface1', mockBean, 'implements_clause');
      registry.registerImplementation('com.example.Interface2', mockBean, 'implements_clause');
      registry.registerImplementation('com.example.Interface3', mockBean, 'implements_clause');

      const interfaces = registry.getInterfaceFor('userRepositoryImpl');
      assert.strictEqual(interfaces.length, 3);
    });
  });

  suite('hasInterface()', () => {
    test('should return false for non-existent interface', () => {
      assert.strictEqual(registry.hasInterface('com.example.NonExistent'), false);
    });

    test('should return true for registered interface', () => {
      registry.registerInterface(mockInterface);
      assert.strictEqual(registry.hasInterface('com.example.repository.UserRepository'), true);
    });
  });

  suite('getAllInterfaces()', () => {
    test('should return empty array when no interfaces registered', () => {
      const interfaces = registry.getAllInterfaces();
      assert.strictEqual(interfaces.length, 0);
    });

    test('should return all registered interfaces', () => {
      const interface1: InterfaceDefinition = {
        ...mockInterface,
        fullyQualifiedName: 'com.example.Interface1',
        simpleName: 'Interface1'
      };
      const interface2: InterfaceDefinition = {
        ...mockInterface,
        fullyQualifiedName: 'com.example.Interface2',
        simpleName: 'Interface2'
      };

      registry.registerInterface(interface1);
      registry.registerInterface(interface2);

      const interfaces = registry.getAllInterfaces();
      assert.strictEqual(interfaces.length, 2);
    });
  });

  suite('clear()', () => {
    test('should clear all registered interfaces and implementations', () => {
      registry.registerInterface(mockInterface);
      registry.registerImplementation('com.example.Interface', mockBean, 'implements_clause');

      registry.clear();

      assert.strictEqual(registry.getAllInterfaces().length, 0);
      assert.strictEqual(registry.getImplementations('com.example.Interface').length, 0);
      assert.strictEqual(registry.getInterfaceFor('userRepositoryImpl').length, 0);
    });

    test('should allow re-registration after clear', () => {
      registry.registerInterface(mockInterface);
      registry.clear();
      registry.registerInterface(mockInterface);

      assert.strictEqual(registry.hasInterface('com.example.repository.UserRepository'), true);
    });
  });

  suite('Integration scenarios', () => {
    test('should handle single interface with single implementation', () => {
      registry.registerInterface(mockInterface);
      registry.registerImplementation(mockInterface.fullyQualifiedName, mockBean, 'implements_clause');

      assert.strictEqual(registry.hasInterface(mockInterface.fullyQualifiedName), true);
      assert.strictEqual(registry.getImplementations(mockInterface.fullyQualifiedName).length, 1);
      assert.strictEqual(registry.getInterfaceFor(mockBean.name).length, 1);
    });

    test('should handle single interface with multiple implementations', () => {
      const paymentInterface: InterfaceDefinition = {
        fullyQualifiedName: 'com.example.PaymentService',
        simpleName: 'PaymentService',
        packageName: 'com.example',
        location: mockLocation,
        isAbstract: false,
        rawType: 'PaymentService'
      };

      const stripeBean: BeanDefinition = {
        ...mockBean,
        name: 'stripePaymentService',
        type: 'com.example.StripePaymentService',
        isPrimary: true
      };

      const paypalBean: BeanDefinition = {
        ...mockBean,
        name: 'paypalPaymentService',
        type: 'com.example.PayPalPaymentService',
        isPrimary: false,
        qualifiers: ['paypal']
      };

      registry.registerInterface(paymentInterface);
      registry.registerImplementation(paymentInterface.fullyQualifiedName, stripeBean, 'implements_clause');
      registry.registerImplementation(paymentInterface.fullyQualifiedName, paypalBean, 'implements_clause');

      const implementations = registry.getImplementations(paymentInterface.fullyQualifiedName);
      assert.strictEqual(implementations.length, 2);
      assert.ok(implementations.some(b => b.name === 'stripePaymentService'));
      assert.ok(implementations.some(b => b.name === 'paypalPaymentService'));
    });

    test('should handle bean implementing multiple interfaces', () => {
      const interface1: InterfaceDefinition = {
        fullyQualifiedName: 'com.example.Readable',
        simpleName: 'Readable',
        packageName: 'com.example',
        location: mockLocation,
        isAbstract: false,
        rawType: 'Readable'
      };

      const interface2: InterfaceDefinition = {
        fullyQualifiedName: 'com.example.Writable',
        simpleName: 'Writable',
        packageName: 'com.example',
        location: mockLocation,
        isAbstract: false,
        rawType: 'Writable'
      };

      const multiBean: BeanDefinition = {
        ...mockBean,
        name: 'dataService',
        implementedInterfaces: ['com.example.Readable', 'com.example.Writable']
      };

      registry.registerInterface(interface1);
      registry.registerInterface(interface2);
      registry.registerImplementation(interface1.fullyQualifiedName, multiBean, 'implements_clause');
      registry.registerImplementation(interface2.fullyQualifiedName, multiBean, 'implements_clause');

      const readableImpls = registry.getImplementations(interface1.fullyQualifiedName);
      const writableImpls = registry.getImplementations(interface2.fullyQualifiedName);
      const interfaces = registry.getInterfaceFor('dataService');

      assert.strictEqual(readableImpls.length, 1);
      assert.strictEqual(writableImpls.length, 1);
      assert.strictEqual(interfaces.length, 2);
    });
  });
});
