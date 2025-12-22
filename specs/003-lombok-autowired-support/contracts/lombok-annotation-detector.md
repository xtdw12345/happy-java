/**
 * API Contract: Lombok Annotation Detector
 *
 * This interface defines the contract for detecting Lombok constructor annotations
 * with dependency injection support (onConstructor parameter containing @Autowired).
 *
 * Purpose: Identify classes that use Lombok to generate constructors with Spring
 * dependency injection, enabling downstream extraction of implicit injection points.
 *
 * Implementation: src/spring-bean-navigation/indexer/lombok/lombokAnnotationDetector.ts
 */

import * as vscode from 'vscode';
import { Annotation } from '../indexer/annotationScanner';
import { LombokConstructorAnnotation } from '../models/types';

/**
 * Lombok annotation detector interface
 */
export interface ILombokAnnotationDetector {
  /**
   * Detect Lombok constructor injection annotation on a class
   *
   * Analyzes class-level annotations to find @RequiredArgsConstructor or
   * @AllArgsConstructor with onConstructor parameter containing @Autowired.
   *
   * @param classAnnotations - All annotations extracted from class declaration
   * @returns Lombok constructor annotation info if detected, null otherwise
   *
   * @example
   * // Given class annotations:
   * // @RestController
   * // @RequiredArgsConstructor(onConstructor=@__({@Autowired}))
   * const result = detector.detectConstructorInjection(annotations);
   * // Returns: {
   * //   type: LombokConstructorType.REQUIRED_ARGS,
   * //   hasAutowired: true,
   * //   syntaxVariant: OnConstructorSyntax.JAVA7,
   * //   location: { uri, line: 2, column: 0 }
   * // }
   *
   * @example
   * // Given class annotations without onConstructor:
   * // @Service
   * // @RequiredArgsConstructor
   * const result = detector.detectConstructorInjection(annotations);
   * // Returns: null (no @Autowired in onConstructor)
   */
  detectConstructorInjection(classAnnotations: Annotation[]): LombokConstructorAnnotation | null;

  /**
   * Check if annotation is a Lombok constructor annotation
   *
   * @param annotation - Annotation to check
   * @returns True if annotation is @RequiredArgsConstructor or @AllArgsConstructor
   *
   * @example
   * const annotation = { name: '@RequiredArgsConstructor', ... };
   * const isLombok = detector.isLombokConstructorAnnotation(annotation);
   * // Returns: true
   */
  isLombokConstructorAnnotation(annotation: Annotation): boolean;

  /**
   * Extract onConstructor parameter value from annotation
   *
   * Extracts the raw onConstructor parameter value, handling all syntax variants:
   * - onConstructor=@__({@Autowired})
   * - onConstructor_={@Autowired}
   * - onConstructor__={@Autowired}
   *
   * @param annotation - Lombok constructor annotation
   * @returns onConstructor parameter value as string, or undefined if not present
   *
   * @example
   * const annotation = {
   *   name: '@RequiredArgsConstructor',
   *   parameters: new Map([['onConstructor', '@__({@Autowired})']])
   * };
   * const value = detector.extractOnConstructorValue(annotation);
   * // Returns: '@__({@Autowired})'
   */
  extractOnConstructorValue(annotation: Annotation): string | undefined;

  /**
   * Check if onConstructor value contains @Autowired
   *
   * Uses regex matching to detect @Autowired within the onConstructor parameter,
   * handling various formatting and syntax variations.
   *
   * @param onConstructorValue - Raw onConstructor parameter value
   * @returns True if @Autowired is present in the value
   *
   * @example
   * const hasAutowired = detector.containsAutowired('@__({@Autowired})');
   * // Returns: true
   *
   * @example
   * const hasAutowired = detector.containsAutowired('@__({@Qualifier("test")})');
   * // Returns: false
   */
  containsAutowired(onConstructorValue: string): boolean;

  /**
   * Determine onConstructor syntax variant
   *
   * Identifies which Lombok onConstructor syntax is used based on the raw value.
   *
   * @param onConstructorValue - Raw onConstructor parameter value
   * @returns Syntax variant enum value
   *
   * @example
   * const variant = detector.determineSyntaxVariant('@__({@Autowired})');
   * // Returns: OnConstructorSyntax.JAVA7
   *
   * @example
   * const variant = detector.determineSyntaxVariant('{@Autowired}');
   * // Returns: OnConstructorSyntax.JAVA8_UNDERSCORE (from onConstructor_=)
   */
  determineSyntaxVariant(onConstructorValue: string): OnConstructorSyntax;
}

/**
 * Implementation Notes:
 *
 * 1. Annotation Parameter Extraction:
 *    - Check for 'onConstructor', 'onConstructor_', 'onConstructor__' parameter names
 *    - Handle both array and single-value parameter formats
 *    - Normalize parameter value to string for regex matching
 *
 * 2. Regex Patterns:
 *    - @Autowired detection: /@Autowired\b/i (case-insensitive, word boundary)
 *    - Java 7 syntax: /@__\s*\(\s*\{.*@Autowired.*\}\s*\)/
 *    - Java 8 syntax: /\{.*@Autowired.*\}/
 *
 * 3. Performance:
 *    - Pre-compile regex patterns as class constants
 *    - Short-circuit evaluation: check annotation name before parameter extraction
 *    - Cache annotation detection results per file (optional optimization)
 *
 * 4. Error Handling:
 *    - Return null for malformed annotations (don't throw exceptions)
 *    - Log warnings for unexpected annotation parameter formats
 *    - Gracefully handle missing or empty parameter values
 *
 * 5. Testing Strategy:
 *    - Unit tests for each syntax variant
 *    - Unit tests for edge cases (malformed syntax, missing parameters)
 *    - Unit tests for case sensitivity and whitespace handling
 *    - Integration tests with real annotation extraction from CST
 */

/**
 * Usage Example:
 *
 * ```typescript
 * // In BeanMetadataExtractor
 * const detector = new LombokAnnotationDetector();
 *
 * // Extract class annotations using existing AnnotationScanner
 * const classAnnotations = annotationScanner.extractClassAnnotations(cst, uri);
 *
 * // Detect Lombok constructor injection
 * const lombokAnnotation = detector.detectConstructorInjection(classAnnotations);
 *
 * if (lombokAnnotation && lombokAnnotation.hasAutowired) {
 *   // Proceed to extract Lombok injection points
 *   const injectionPoints = injectionExtractor.extract(cst, uri, lombokAnnotation);
 *   allInjectionPoints.push(...injectionPoints);
 * }
 * ```
 */

/**
 * Contract Validation:
 *
 * An implementation of this interface MUST:
 * 1. Return null when no Lombok constructor annotation is found
 * 2. Return null when Lombok annotation exists but lacks @Autowired in onConstructor
 * 3. Support all three onConstructor syntax variants
 * 4. Extract correct LombokConstructorType (REQUIRED_ARGS vs ALL_ARGS)
 * 5. Provide accurate location information from annotation CST node
 * 6. Complete detection in <50ms for typical class with 5-10 annotations
 * 7. Not throw exceptions for malformed or unexpected input
 */
