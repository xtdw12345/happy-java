/**
 * Lombok Annotation Detector
 *
 * Detects Lombok constructor annotations (@RequiredArgsConstructor, @AllArgsConstructor)
 * with onConstructor parameter containing @Autowired for dependency injection.
 */

import { Annotation } from '../annotationScanner';
import {
  LombokConstructorAnnotation,
  LombokConstructorType,
  OnConstructorSyntax
} from '../../models/types';

/**
 * Detects Lombok constructor injection annotations
 */
export class LombokAnnotationDetector {
  /** Pre-compiled regex for @Autowired detection (case-insensitive) */
  private static readonly AUTOWIRED_PATTERN = /@Autowired\b/i;

  /** Pre-compiled regex for Java 7 syntax: @__( */
  private static readonly JAVA7_PATTERN = /@__\s*\(/;

  /**
   * Detect Lombok constructor injection annotation from class annotations
   *
   * @param classAnnotations All annotations from class declaration
   * @returns Lombok annotation info if detected with @Autowired, null otherwise
   */
  detectConstructorInjection(classAnnotations: Annotation[]): LombokConstructorAnnotation | null {
    // Find Lombok constructor annotation
    const lombokAnnotation = classAnnotations.find(annotation =>
      this.isLombokConstructorAnnotation(annotation)
    );

    if (!lombokAnnotation) {
      return null;
    }

    // Extract onConstructor parameter and track which variant was used
    const { value: onConstructorValue, variant: parameterVariant } = this.extractOnConstructorValueWithVariant(lombokAnnotation);
    if (!onConstructorValue) {
      return null;
    }

    // Check if contains @Autowired
    if (!this.containsAutowired(onConstructorValue)) {
      return null;
    }

    // Determine constructor type
    const constructorType = lombokAnnotation.name === '@RequiredArgsConstructor'
      ? LombokConstructorType.REQUIRED_ARGS
      : LombokConstructorType.ALL_ARGS;

    // Determine syntax variant based on both value content and parameter name
    const syntaxVariant = this.determineSyntaxVariant(onConstructorValue, parameterVariant);

    return {
      type: constructorType,
      hasAutowired: true,
      syntaxVariant,
      location: lombokAnnotation.location
    };
  }

  /**
   * Check if annotation is a Lombok constructor annotation
   *
   * @param annotation Annotation to check
   * @returns True if @RequiredArgsConstructor or @AllArgsConstructor
   */
  isLombokConstructorAnnotation(annotation: Annotation): boolean {
    return annotation.name === '@RequiredArgsConstructor' ||
           annotation.name === '@AllArgsConstructor';
  }

  /**
   * Extract onConstructor parameter value from annotation
   *
   * Supports all three syntax variants:
   * - onConstructor
   * - onConstructor_
   * - onConstructor__
   *
   * @param annotation Lombok constructor annotation
   * @returns onConstructor parameter value, or undefined if not present
   */
  extractOnConstructorValue(annotation: Annotation): string | undefined {
    // Check all variants in order
    const variants = ['onConstructor', 'onConstructor_', 'onConstructor__'];

    for (const variant of variants) {
      const value = annotation.parameters.get(variant);
      if (value !== undefined) {
        return String(value);
      }
    }

    return undefined;
  }

  /**
   * Extract onConstructor parameter value with variant tracking
   *
   * Returns both the value and which parameter name was found
   *
   * @param annotation Lombok constructor annotation
   * @returns Object with value and variant, or undefined value if not present
   */
  extractOnConstructorValueWithVariant(annotation: Annotation): { value: string | undefined; variant: string | undefined } {
    // Check all variants in order
    const variants = ['onConstructor', 'onConstructor_', 'onConstructor__'];

    for (const variant of variants) {
      const value = annotation.parameters.get(variant);
      if (value !== undefined) {
        return {
          value: String(value),
          variant: variant
        };
      }
    }

    return { value: undefined, variant: undefined };
  }

  /**
   * Check if onConstructor value contains @Autowired
   *
   * Uses case-insensitive matching to handle various formatting
   *
   * @param onConstructorValue Raw onConstructor parameter value
   * @returns True if @Autowired is present
   */
  containsAutowired(onConstructorValue: string): boolean {
    return LombokAnnotationDetector.AUTOWIRED_PATTERN.test(onConstructorValue);
  }

  /**
   * Determine onConstructor syntax variant
   *
   * Uses both the value content and the parameter name to determine the correct variant
   *
   * @param onConstructorValue Raw onConstructor parameter value
   * @param parameterVariant The parameter name that was found (onConstructor, onConstructor_, onConstructor__)
   * @returns Syntax variant enum
   */
  determineSyntaxVariant(onConstructorValue: string, parameterVariant?: string): OnConstructorSyntax {
    // Use parameter name to determine variant if available
    if (parameterVariant === 'onConstructor__') {
      return OnConstructorSyntax.JAVA8_DOUBLE_UNDERSCORE;
    }
    if (parameterVariant === 'onConstructor_') {
      return OnConstructorSyntax.JAVA8_UNDERSCORE;
    }

    // For 'onConstructor' parameter, check if it uses Java 7 @__( pattern
    if (LombokAnnotationDetector.JAVA7_PATTERN.test(onConstructorValue)) {
      return OnConstructorSyntax.JAVA7;
    }

    // Default fallback (shouldn't reach here if parameter variant is provided)
    return OnConstructorSyntax.JAVA8_UNDERSCORE;
  }
}
