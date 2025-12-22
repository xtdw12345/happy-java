"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
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
//# sourceMappingURL=lombok-annotation-detector.js.map