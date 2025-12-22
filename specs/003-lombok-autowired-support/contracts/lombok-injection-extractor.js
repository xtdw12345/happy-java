"use strict";
/**
 * API Contract: Lombok Injection Extractor
 *
 * This interface defines the contract for extracting injection points from fields
 * in classes with Lombok constructor injection annotations.
 *
 * Purpose: Convert @NonNull and final fields in Lombok classes into BeanInjectionPoint
 * objects that can be processed by existing bean resolution and CodeLens infrastructure.
 *
 * Implementation: src/spring-bean-navigation/indexer/lombok/lombokInjectionExtractor.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Implementation Notes:
 *
 * 1. CST Navigation for Fields:
 *    Path: ordinaryCompilationUnit
 *          → typeDeclaration
 *          → classDeclaration
 *          → normalClassDeclaration
 *          → classBody
 *          → classBodyDeclaration[]
 *          → classMemberDeclaration
 *          → fieldDeclaration
 *
 * 2. Field Type Extraction:
 *    - Navigate: fieldDeclaration → unannType → classOrInterfaceType → Identifier
 *    - Handle qualified names: com.example.UserService → extract "UserService"
 *    - Handle generics: List<User> → extract "List"
 *    - Fallback: If extraction fails, use "Object" or skip field
 *
 * 3. Modifier Scanning:
 *    - Field modifiers are in classBodyDeclaration.children.modifier[]
 *    - Each modifier can be: annotation, keyword (public/private/final), or other
 *    - @NonNull appears as annotation modifier
 *    - final appears as keyword modifier
 *
 * 4. Field Filtering Performance:
 *    - @RequiredArgsConstructor: O(n) where n = number of fields
 *    - @AllArgsConstructor: O(1) - no filtering, return all fields immediately
 *    - Optimize: Early return for @AllArgsConstructor
 *
 * 5. Error Handling:
 *    - Skip fields with malformed type declarations (log warning)
 *    - Skip fields where CST navigation fails
 *    - Never throw exceptions - return empty array instead
 *    - Log detailed warnings for debugging
 *
 * 6. Testing Strategy:
 *    - Unit tests for @RequiredArgsConstructor field filtering
 *    - Unit tests for @AllArgsConstructor (all fields included)
 *    - Unit tests for @Qualifier extraction
 *    - Unit tests for final field detection
 *    - Unit tests for @NonNull detection (import variations)
 *    - Integration tests with real CST from java-parser
 */
/**
 * Usage Example:
 *
 * ```typescript
 * // In BeanMetadataExtractor
 * const extractor = new LombokInjectionExtractor();
 * const detector = new LombokAnnotationDetector();
 *
 * // Detect Lombok annotation
 * const lombokAnnotation = detector.detectConstructorInjection(classAnnotations);
 *
 * if (lombokAnnotation && lombokAnnotation.hasAutowired) {
 *   // Extract Lombok injection points
 *   const lombokInjections = extractor.extract(cst, uri, lombokAnnotation);
 *
 *   // Merge with existing injections
 *   allInjectionPoints.push(...lombokInjections);
 * }
 *
 * return allInjectionPoints;
 * ```
 */
/**
 * Contract Validation:
 *
 * An implementation of this interface MUST:
 * 1. Extract all fields for @AllArgsConstructor
 * 2. Extract only @NonNull and final fields for @RequiredArgsConstructor
 * 3. Set injectionType = LOMBOK_CONSTRUCTOR for all extracted injection points
 * 4. Extract @Qualifier values correctly
 * 5. Handle missing or malformed field declarations gracefully (skip, don't crash)
 * 6. Provide accurate location information (line and column of field declaration)
 * 7. Complete extraction in <100ms for typical class with 10-20 fields
 * 8. Return empty array (not null) when no eligible fields found
 */
/**
 * Field Filtering Decision Table:
 *
 * | Constructor Type          | Field Modifiers      | @NonNull | Included? |
 * |--------------------------|---------------------|----------|-----------|
 * | @RequiredArgsConstructor | final               | No       | Yes       |
 * | @RequiredArgsConstructor | final               | Yes      | Yes       |
 * | @RequiredArgsConstructor | (not final)         | Yes      | Yes       |
 * | @RequiredArgsConstructor | (not final)         | No       | No        |
 * | @AllArgsConstructor      | (any)               | (any)    | Yes       |
 *
 * Note: Static fields are always excluded (Lombok doesn't include them in constructors)
 */
//# sourceMappingURL=lombok-injection-extractor.js.map