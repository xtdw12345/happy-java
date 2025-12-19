/**
 * Bean injection point entity - represents where a Bean is injected
 */

import { BeanLocation } from './BeanLocation';
import { InjectionType } from './types';

/**
 * Represents a Bean injection point (dependency injection site)
 */
export interface BeanInjectionPoint {
  /** Type of injection */
  injectionType: InjectionType;
  
  /** Type of bean being injected (interface or class fully qualified name) */
  beanType: string;
  
  /** Explicitly specified bean name (e.g., @Resource(name="xxx")) */
  beanName?: string;
  
  /** Location in source code */
  location: BeanLocation;
  
  /** @Qualifier value */
  qualifier?: string;
  
  /** Whether injection is required (@Autowired(required=true), default: true) */
  isRequired: boolean;
  
  /** Field name (only for field injection) */
  fieldName?: string;
  
  /** Parameter name (for constructor/method injection) */
  parameterName?: string;
  
  /** Parameter index (for constructor/method injection) */
  parameterIndex?: number;
}

/**
 * Validation utilities for BeanInjectionPoint
 */
export namespace BeanInjectionPoint {
  /**
   * Validate a BeanInjectionPoint
   * @param injection Injection point to validate
   * @returns Validation errors, empty array if valid
   */
  export function validate(injection: BeanInjectionPoint): string[] {
    const errors: string[] = [];

    // Required fields
    if (!injection.beanType || injection.beanType.trim() === '') {
      errors.push('Bean type is required');
    }
    if (!injection.location) {
      errors.push('Injection location is required');
    }

    // Type-specific validation
    if (injection.injectionType === InjectionType.FIELD) {
      if (!injection.fieldName) {
        errors.push('Field name is required for field injection');
      }
    }

    if (injection.injectionType === InjectionType.CONSTRUCTOR || 
        injection.injectionType === InjectionType.SETTER_METHOD) {
      if (!injection.parameterName) {
        errors.push('Parameter name is required for constructor/method injection');
      }
      if (injection.parameterIndex === undefined || injection.parameterIndex < 0) {
        errors.push('Valid parameter index is required for constructor/method injection');
      }
    }

    // Logical validation
    if (injection.qualifier && injection.beanName) {
      errors.push('Cannot have both qualifier and beanName (qualifier takes precedence)');
    }

    // Location validation
    if (injection.location && injection.location.line < 0) {
      errors.push('Line number must be >= 0');
    }

    return errors;
  }

  /**
   * Check if injection point uses explicit bean name
   * @param injection Injection point
   * @returns True if uses explicit bean name
   */
  export function hasExplicitName(injection: BeanInjectionPoint): boolean {
    return !!injection.beanName || !!injection.qualifier;
  }

  /**
   * Get display name for injection point
   * @param injection Injection point
   * @returns Human-readable display name
   */
  export function getDisplayName(injection: BeanInjectionPoint): string {
    if (injection.injectionType === InjectionType.FIELD && injection.fieldName) {
      return `field: ${injection.fieldName}`;
    }
    if (injection.parameterName) {
      return `parameter: ${injection.parameterName}`;
    }
    return 'unknown';
  }

  /**
   * Get effective bean identifier for matching
   * Priority: qualifier > beanName > default (type-based)
   * @param injection Injection point
   * @returns Bean identifier string
   */
  export function getEffectiveIdentifier(injection: BeanInjectionPoint): string | undefined {
    if (injection.qualifier) {
      return injection.qualifier;
    }
    if (injection.beanName) {
      return injection.beanName;
    }
    return undefined;
  }
}
