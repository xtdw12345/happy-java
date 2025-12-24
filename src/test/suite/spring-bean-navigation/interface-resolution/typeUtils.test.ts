/**
 * Unit tests for typeUtils - Type matching and normalization utilities
 */

import * as assert from 'assert';
import { extractRawType, normalizeFQN, matchesInterface } from '../../../../spring-bean-navigation/utils/typeUtils';

suite('typeUtils Test Suite', () => {

  suite('extractRawType()', () => {
    test('should return type as-is when no generics present', () => {
      assert.strictEqual(extractRawType('UserRepository'), 'UserRepository');
      assert.strictEqual(extractRawType('com.example.UserRepository'), 'com.example.UserRepository');
    });

    test('should remove single generic parameter', () => {
      assert.strictEqual(extractRawType('Repository<User>'), 'Repository');
      assert.strictEqual(extractRawType('List<String>'), 'List');
      assert.strictEqual(extractRawType('com.example.Repository<User>'), 'com.example.Repository');
    });

    test('should remove multiple generic parameters', () => {
      assert.strictEqual(extractRawType('Map<String, Object>'), 'Map');
      assert.strictEqual(extractRawType('BiFunction<T, U, R>'), 'BiFunction');
      assert.strictEqual(extractRawType('com.example.Cache<K, V>'), 'com.example.Cache');
    });

    test('should remove nested generic parameters', () => {
      assert.strictEqual(extractRawType('Map<String, List<User>>'), 'Map');
      assert.strictEqual(extractRawType('Repository<Optional<User>>'), 'Repository');
      assert.strictEqual(
        extractRawType('com.example.Service<Map<String, List<Object>>>'),
        'com.example.Service'
      );
    });

    test('should handle empty string', () => {
      assert.strictEqual(extractRawType(''), '');
    });

    test('should trim whitespace', () => {
      assert.strictEqual(extractRawType('  UserRepository  '), 'UserRepository');
      assert.strictEqual(extractRawType('  Repository<User>  '), 'Repository');
    });

    test('should handle type with whitespace around generics', () => {
      assert.strictEqual(extractRawType('Repository< User >'), 'Repository');
      assert.strictEqual(extractRawType('Map< String , Object >'), 'Map');
    });
  });

  suite('normalizeFQN()', () => {
    test('should normalize FQN with generics by removing them', () => {
      assert.strictEqual(
        normalizeFQN('com.example.Repository<User>'),
        'com.example.Repository'
      );
      assert.strictEqual(
        normalizeFQN('java.util.Map<String, Object>'),
        'java.util.Map'
      );
    });

    test('should normalize FQN without generics by trimming', () => {
      assert.strictEqual(normalizeFQN('com.example.UserRepository'), 'com.example.UserRepository');
      assert.strictEqual(normalizeFQN('  com.example.Foo  '), 'com.example.Foo');
    });

    test('should normalize simple name', () => {
      assert.strictEqual(normalizeFQN('UserRepository'), 'UserRepository');
      assert.strictEqual(normalizeFQN('Repository<User>'), 'Repository');
    });

    test('should normalize path separators to dots', () => {
      assert.strictEqual(normalizeFQN('com/example/UserRepository'), 'com.example.UserRepository');
      assert.strictEqual(normalizeFQN('com\\example\\UserRepository'), 'com.example.UserRepository');
      assert.strictEqual(normalizeFQN('com/example\\UserRepository'), 'com.example.UserRepository');
    });

    test('should handle empty string', () => {
      assert.strictEqual(normalizeFQN(''), '');
    });

    test('should handle complex case: generics + whitespace + path separators', () => {
      assert.strictEqual(
        normalizeFQN('  com/example/Repository<User>  '),
        'com.example.Repository'
      );
      assert.strictEqual(
        normalizeFQN('com\\example\\Map<String, Object>'),
        'com.example.Map'
      );
    });
  });

  suite('matchesInterface()', () => {
    test('should match exact FQN', () => {
      assert.strictEqual(
        matchesInterface('com.example.UserRepository', 'com.example.UserRepository'),
        true
      );
      assert.strictEqual(
        matchesInterface('java.util.List', 'java.util.List'),
        true
      );
    });

    test('should match simple name when FQN differs', () => {
      assert.strictEqual(
        matchesInterface('com.example.UserRepository', 'UserRepository'),
        true
      );
      assert.strictEqual(
        matchesInterface('UserRepository', 'com.example.UserRepository'),
        true
      );
      assert.strictEqual(
        matchesInterface('com.foo.Repository', 'com.bar.Repository'),
        true
      );
    });

    test('should match when generics differ but raw type matches', () => {
      assert.strictEqual(
        matchesInterface('Repository<User>', 'Repository<Order>'),
        true
      );
      assert.strictEqual(
        matchesInterface('com.example.Repository<User>', 'com.example.Repository<Order>'),
        true
      );
      assert.strictEqual(
        matchesInterface('Map<String, Object>', 'Map<Integer, String>'),
        true
      );
    });

    test('should not match when simple names differ', () => {
      assert.strictEqual(
        matchesInterface('com.example.UserRepository', 'com.example.OrderRepository'),
        false
      );
      assert.strictEqual(
        matchesInterface('UserRepository', 'OrderRepository'),
        false
      );
    });

    test('should not match when both are empty', () => {
      assert.strictEqual(matchesInterface('', ''), false);
    });

    test('should not match when one is empty', () => {
      assert.strictEqual(matchesInterface('UserRepository', ''), false);
      assert.strictEqual(matchesInterface('', 'UserRepository'), false);
    });

    test('should match FQN with simple name (with generics)', () => {
      assert.strictEqual(
        matchesInterface('com.example.Repository<User>', 'Repository'),
        true
      );
      assert.strictEqual(
        matchesInterface('Repository<User>', 'com.example.Repository'),
        true
      );
    });

    test('should not match when simple name is empty after split', () => {
      assert.strictEqual(matchesInterface('com.example.', 'UserRepository'), false);
      assert.strictEqual(matchesInterface('UserRepository', 'com.example.'), false);
    });

    test('should handle complex nested generics', () => {
      assert.strictEqual(
        matchesInterface(
          'com.example.Repository<Map<String, List<User>>>',
          'com.example.Repository<Set<Object>>'
        ),
        true
      );
    });
  });
});
