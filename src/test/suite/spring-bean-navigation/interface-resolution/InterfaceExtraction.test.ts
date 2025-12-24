/**
 * Unit tests for interface extraction - CST parsing for interfaces and implementations
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { InterfaceDefinition } from '../../../../spring-bean-navigation/models/types';
import { InterfaceExtractor } from '../../../../spring-bean-navigation/indexing/InterfaceExtractor';

suite('Interface Extraction Test Suite', () => {
  let extractor: InterfaceExtractor;
  // __dirname = out/test/suite/spring-bean-navigation/interface-resolution
  // Go up 5 levels to project root, then to src fixtures
  const fixturesPath = path.join(__dirname, '../../../../../src/test/suite/spring-bean-navigation/fixtures/interfaces');

  setup(() => {
    extractor = new InterfaceExtractor();
  });

  suite('extractInterfaces() - Interface declarations', () => {
    test('should extract interface from UserRepository.java', async () => {
      const filePath = path.join(fixturesPath, 'UserRepository.java');
      const interfaces = await extractor.extractInterfaces(filePath);

      assert.strictEqual(interfaces.length, 1);
      assert.strictEqual(interfaces[0].fullyQualifiedName, 'com.example.repository.UserRepository');
      assert.strictEqual(interfaces[0].simpleName, 'UserRepository');
      assert.strictEqual(interfaces[0].packageName, 'com.example.repository');
      assert.strictEqual(interfaces[0].isAbstract, false);
      assert.strictEqual(interfaces[0].rawType, 'UserRepository');
    });

    test('should extract interface from PaymentService.java', async () => {
      const filePath = path.join(fixturesPath, 'PaymentService.java');
      const interfaces = await extractor.extractInterfaces(filePath);

      assert.strictEqual(interfaces.length, 1);
      assert.strictEqual(interfaces[0].fullyQualifiedName, 'com.example.service.PaymentService');
      assert.strictEqual(interfaces[0].simpleName, 'PaymentService');
      assert.strictEqual(interfaces[0].packageName, 'com.example.service');
      assert.strictEqual(interfaces[0].isAbstract, false);
    });

    test('should extract abstract class as interface from DataSource.java', async () => {
      const filePath = path.join(fixturesPath, 'DataSource.java');
      const interfaces = await extractor.extractInterfaces(filePath);

      assert.strictEqual(interfaces.length, 1);
      assert.strictEqual(interfaces[0].fullyQualifiedName, 'com.example.datasource.DataSource');
      assert.strictEqual(interfaces[0].simpleName, 'DataSource');
      assert.strictEqual(interfaces[0].isAbstract, true);
    });

    test('should return empty array for non-interface files', async () => {
      const filePath = path.join(fixturesPath, 'UserRepositoryImpl.java');
      const interfaces = await extractor.extractInterfaces(filePath);

      // UserRepositoryImpl is a class, not an interface
      assert.strictEqual(interfaces.length, 0);
    });

    test('should handle file with multiple interfaces', async () => {
      // This test is for future support of multiple interfaces in one file
      const filePath = path.join(fixturesPath, 'MultipleInterfaces.java');
      const interfaces = await extractor.extractInterfaces(filePath);

      // For now, expecting empty since file doesn't exist in fixtures
      assert.ok(Array.isArray(interfaces));
    });
  });

  suite('extractImplementedInterfaces() - Implementation detection', () => {
    test('should extract implemented interfaces from UserRepositoryImpl.java', async () => {
      const filePath = path.join(fixturesPath, 'UserRepositoryImpl.java');
      const implementations = await extractor.extractImplementedInterfaces(filePath);

      assert.strictEqual(implementations.size, 1);
      assert.ok(implementations.has('UserRepositoryImpl'));

      const interfaces = implementations.get('UserRepositoryImpl');
      assert.strictEqual(interfaces?.length, 1);
      assert.strictEqual(interfaces?.[0], 'com.example.repository.UserRepository');
    });

    test('should extract implemented interfaces from StripePaymentService.java', async () => {
      const filePath = path.join(fixturesPath, 'StripePaymentService.java');
      const implementations = await extractor.extractImplementedInterfaces(filePath);

      assert.strictEqual(implementations.size, 1);
      assert.ok(implementations.has('StripePaymentService'));

      const interfaces = implementations.get('StripePaymentService');
      assert.strictEqual(interfaces?.length, 1);
      assert.strictEqual(interfaces?.[0], 'com.example.service.PaymentService');
    });

    test('should extract implemented interfaces from PayPalPaymentService.java', async () => {
      const filePath = path.join(fixturesPath, 'PayPalPaymentService.java');
      const implementations = await extractor.extractImplementedInterfaces(filePath);

      assert.strictEqual(implementations.size, 1);
      assert.ok(implementations.has('PayPalPaymentService'));

      const interfaces = implementations.get('PayPalPaymentService');
      assert.strictEqual(interfaces?.length, 1);
      assert.strictEqual(interfaces?.[0], 'com.example.service.PaymentService');
    });

    test('should return empty map for interface files (no implementations)', async () => {
      const filePath = path.join(fixturesPath, 'UserRepository.java');
      const implementations = await extractor.extractImplementedInterfaces(filePath);

      // Interface files don't implement anything
      assert.strictEqual(implementations.size, 0);
    });

    test('should handle class implementing multiple interfaces', async () => {
      // This test is for future support
      const filePath = path.join(fixturesPath, 'MultiImplementation.java');
      const implementations = await extractor.extractImplementedInterfaces(filePath);

      // For now, just verify it returns a Map
      assert.ok(implementations instanceof Map);
    });
  });

  suite('Edge cases', () => {
    test('should handle non-existent file gracefully', async () => {
      const filePath = path.join(fixturesPath, 'NonExistent.java');

      try {
        const interfaces = await extractor.extractInterfaces(filePath);
        // Should return empty array or throw - either is acceptable
        assert.ok(Array.isArray(interfaces));
      } catch (error) {
        // File not found is also acceptable
        assert.ok(error);
      }
    });

    test('should handle malformed Java files', async () => {
      const filePath = path.join(fixturesPath, 'Malformed.java');

      try {
        const interfaces = await extractor.extractInterfaces(filePath);
        assert.ok(Array.isArray(interfaces));
      } catch (error) {
        // Parse error is acceptable
        assert.ok(error);
      }
    });

    test('should handle interfaces with generic parameters', async () => {
      // Future test for interfaces like Repository<T>
      const filePath = path.join(fixturesPath, 'GenericInterface.java');
      const interfaces = await extractor.extractInterfaces(filePath);

      assert.ok(Array.isArray(interfaces));
      // When implemented, should extract raw type without generics
    });

    test('should handle nested interfaces', async () => {
      // Future test for nested interface declarations
      const filePath = path.join(fixturesPath, 'OuterClass.java');
      const interfaces = await extractor.extractInterfaces(filePath);

      assert.ok(Array.isArray(interfaces));
      // When implemented, should extract nested interfaces with proper FQN
    });
  });

  suite('Integration with fixtures', () => {
    test('should correctly pair interface and implementation for UserRepository', async () => {
      const interfaceFile = path.join(fixturesPath, 'UserRepository.java');
      const implFile = path.join(fixturesPath, 'UserRepositoryImpl.java');

      const interfaces = await extractor.extractInterfaces(interfaceFile);
      const implementations = await extractor.extractImplementedInterfaces(implFile);

      assert.strictEqual(interfaces.length, 1);
      assert.strictEqual(implementations.size, 1);

      const interfaceFQN = interfaces[0].fullyQualifiedName;
      const implInterfaces = implementations.get('UserRepositoryImpl');

      assert.ok(implInterfaces?.includes(interfaceFQN));
    });

    test('should correctly pair interface and multiple implementations for PaymentService', async () => {
      const interfaceFile = path.join(fixturesPath, 'PaymentService.java');
      const stripeFile = path.join(fixturesPath, 'StripePaymentService.java');
      const paypalFile = path.join(fixturesPath, 'PayPalPaymentService.java');

      const interfaces = await extractor.extractInterfaces(interfaceFile);
      const stripeImpl = await extractor.extractImplementedInterfaces(stripeFile);
      const paypalImpl = await extractor.extractImplementedInterfaces(paypalFile);

      assert.strictEqual(interfaces.length, 1);
      const interfaceFQN = interfaces[0].fullyQualifiedName;

      const stripeInterfaces = stripeImpl.get('StripePaymentService');
      const paypalInterfaces = paypalImpl.get('PayPalPaymentService');

      assert.ok(stripeInterfaces?.includes(interfaceFQN));
      assert.ok(paypalInterfaces?.includes(interfaceFQN));
    });
  });
});
