/**
 * Type Utilities - Functions for type matching and normalization
 */

/**
 * Extract raw type by removing generic parameters
 *
 * @param type - Type string possibly with generics
 * @returns Raw type without generic parameters
 *
 * @example
 * extractRawType("Repository<User>") // => "Repository"
 * extractRawType("Map<String, Object>") // => "Map"
 * extractRawType("UserRepository") // => "UserRepository"
 */
export function extractRawType(type: string): string {
  if (!type) {
    return '';
  }

  // Find first < and remove everything from there to the matching >
  const genericStart = type.indexOf('<');
  if (genericStart === -1) {
    return type.trim();
  }

  return type.substring(0, genericStart).trim();
}

/**
 * Normalize FQN for consistent comparison
 *
 * - Removes generic parameters
 * - Trims whitespace
 * - Normalizes package separators
 *
 * @param fqn - Fully qualified name to normalize
 * @returns Normalized FQN
 *
 * @example
 * normalizeFQN("com.example.Repository<User>") // => "com.example.Repository"
 * normalizeFQN("  com.example.Foo  ") // => "com.example.Foo"
 */
export function normalizeFQN(fqn: string): string {
  if (!fqn) {
    return '';
  }

  // 1. Remove generic parameters
  const rawType = extractRawType(fqn);

  // 2. Trim whitespace
  const trimmed = rawType.trim();

  // 3. Normalize package separators (ensure . is used, not / or \)
  const normalized = trimmed.replace(/[/\\]/g, '.');

  return normalized;
}

/**
 * Check if bean type matches interface type
 *
 * Tries in order:
 * 1. Exact FQN match
 * 2. Simple name match (last component after final dot)
 *
 * @param beanType - Type of the bean (may be FQN or simple name)
 * @param interfaceType - Type of the interface (may be FQN or simple name)
 * @returns True if types match
 *
 * @example
 * matchesInterface("com.example.UserRepositoryImpl", "com.example.UserRepository")
 *   // => false (different classes)
 * matchesInterface("com.example.UserRepository", "UserRepository")
 *   // => true (simple name matches)
 * matchesInterface("Repository<User>", "Repository<Order>")
 *   // => true (both normalize to "Repository")
 */
export function matchesInterface(beanType: string, interfaceType: string): boolean {
  if (!beanType || !interfaceType) {
    return false;
  }

  // Normalize both types (remove generics, trim)
  const normalizedBean = normalizeFQN(beanType);
  const normalizedInterface = normalizeFQN(interfaceType);

  // Try exact FQN match first
  if (normalizedBean === normalizedInterface) {
    return true;
  }

  // Fallback: Simple name match (extract last component after final dot)
  const beanSimpleName = normalizedBean.split('.').pop() || '';
  const interfaceSimpleName = normalizedInterface.split('.').pop() || '';

  return beanSimpleName === interfaceSimpleName && beanSimpleName !== '';
}
