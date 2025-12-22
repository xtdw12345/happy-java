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

import * as vscode from 'vscode';
import { BeanInjectionPoint } from '../models/BeanInjectionPoint';
import { LombokConstructorAnnotation, LombokFieldInfo } from '../models/types';

/**
 * Lombok injection extractor interface
 */
export interface ILombokInjectionExtractor {
  /**
   * Extract injection points from Lombok-annotated class
   *
   * Scans class fields and creates BeanInjectionPoint objects for fields that will
   * be included in the Lombok-generated constructor based on the constructor type.
   *
   * Field inclusion rules:
   * - @RequiredArgsConstructor: Only @NonNull fields and final fields
   * - @AllArgsConstructor: All fields regardless of modifiers
   *
   * @param cst - Java CST from java-parser
   * @param uri - File URI for location information
   * @param lombokAnnotation - Detected Lombok constructor annotation
   * @returns Array of injection points for Lombok-injected fields
   *
   * @example
   * // Given class:
   * // @RequiredArgsConstructor(onConstructor=@__({@Autowired}))
   * // public class UserController {
   * //   @NonNull private final UserService userService;
   * //   private String optionalField; // Not included
   * // }
   * const injections = extractor.extract(cst, uri, lombokAnnotation);
   * // Returns: [
   * //   {
   * //     name: "userService",
   * //     type: "UserService",
   * //     location: { uri, line: 3, column: 25 },
   * //     qualifier: undefined,
   * //     injectionType: InjectionType.LOMBOK_CONSTRUCTOR
   * //   }
   * // ]
   */
  extract(cst: any, uri: vscode.Uri, lombokAnnotation: LombokConstructorAnnotation): BeanInjectionPoint[];

  /**
   * Extract field information from CST
   *
   * Scans all field declarations in the class body and extracts relevant information
   * for Lombok injection point detection.
   *
   * @param cst - Java CST from java-parser
   * @param uri - File URI for location information
   * @returns Array of field information objects
   *
   * @example
   * const fields = extractor.extractFieldInfo(cst, uri);
   * // Returns: [
   * //   {
   * //     name: "userService",
   * //     type: "UserService",
   * //     hasNonNull: true,
   * //     isFinal: true,
   * //     qualifier: undefined,
   * //     annotations: ["@NonNull"],
   * //     location: { uri, line: 3, column: 25 }
   * //   },
   * //   ...
   * // ]
   */
  extractFieldInfo(cst: any, uri: vscode.Uri): LombokFieldInfo[];

  /**
   * Filter fields based on Lombok constructor type
   *
   * Applies field inclusion rules based on the type of Lombok constructor annotation.
   *
   * @param fields - All fields extracted from class
   * @param lombokAnnotation - Lombok constructor annotation with type information
   * @returns Filtered fields that will be included in generated constructor
   *
   * @example
   * // For @RequiredArgsConstructor
   * const filtered = extractor.filterFields(allFields, {
   *   type: LombokConstructorType.REQUIRED_ARGS,
   *   ...
   * });
   * // Returns: Only fields with hasNonNull=true OR isFinal=true
   *
   * @example
   * // For @AllArgsConstructor
   * const filtered = extractor.filterFields(allFields, {
   *   type: LombokConstructorType.ALL_ARGS,
   *   ...
   * });
   * // Returns: All fields unconditionally
   */
  filterFields(fields: LombokFieldInfo[], lombokAnnotation: LombokConstructorAnnotation): LombokFieldInfo[];

  /**
   * Convert field info to injection points
   *
   * Transforms LombokFieldInfo objects into BeanInjectionPoint objects suitable
   * for storage in BeanIndex and use by CodeLensProvider.
   *
   * @param fields - Filtered field information
   * @returns Array of injection points
   *
   * @example
   * const injections = extractor.convertToInjectionPoints(filteredFields);
   * // Returns: BeanInjectionPoint[] with injectionType = LOMBOK_CONSTRUCTOR
   */
  convertToInjectionPoints(fields: LombokFieldInfo[]): BeanInjectionPoint[];

  /**
   * Extract field type from CST node
   *
   * Navigates field declaration CST to extract type information. Handles simple
   * types, qualified types, and generic types (extracts base type).
   *
   * @param fieldDeclaration - Field declaration CST node
   * @returns Field type as string (simple name or qualified name)
   *
   * @example
   * const type = extractor.extractFieldType(fieldDeclNode);
   * // For "private UserService userService"
   * // Returns: "UserService"
   *
   * @example
   * const type = extractor.extractFieldType(fieldDeclNode);
   * // For "private List<User> users"
   * // Returns: "List" (base type, generics ignored)
   */
  extractFieldType(fieldDeclaration: any): string;

  /**
   * Check if field has @NonNull annotation
   *
   * Scans field modifiers for @NonNull annotation, handling both lombok.NonNull
   * and fully qualified usage.
   *
   * @param fieldModifiers - Field modifier CST nodes (includes annotations)
   * @returns True if @NonNull annotation present
   *
   * @example
   * const hasNonNull = extractor.hasNonNullAnnotation(modifiers);
   * // Returns: true for "@NonNull private UserService userService"
   */
  hasNonNullAnnotation(fieldModifiers: any[]): boolean;

  /**
   * Check if field is final
   *
   * Scans field modifiers for final keyword.
   *
   * @param fieldModifiers - Field modifier CST nodes
   * @returns True if final modifier present
   *
   * @example
   * const isFinal = extractor.isFinalField(modifiers);
   * // Returns: true for "private final UserService userService"
   */
  isFinalField(fieldModifiers: any[]): boolean;

  /**
   * Extract @Qualifier value from field
   *
   * Scans field annotations for @Qualifier and extracts its value parameter.
   *
   * @param fieldModifiers - Field modifier CST nodes (includes annotations)
   * @returns Qualifier value if present, undefined otherwise
   *
   * @example
   * const qualifier = extractor.extractQualifier(modifiers);
   * // For "@Qualifier('userRepository') @NonNull private UserRepository repo"
   * // Returns: "userRepository"
   */
  extractQualifier(fieldModifiers: any[]): string | undefined;
}

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
