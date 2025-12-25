/**
 * Bean definition entity - represents a Spring Bean definition
 */

import { BeanLocation } from './BeanLocation';
import { BeanDefinitionType } from './types';

/**
 * Represents a Spring Bean definition
 */
export interface BeanDefinition {
  /** Bean name (e.g., "userService") */
  name: string;
  
  /** Bean's Java type fully qualified name (e.g., "com.example.service.UserService") */
  type: string;
  
  /** How the bean is defined (Component, Bean method, etc.) */
  definitionType: BeanDefinitionType;
  
  /** Location in source code */
  location: BeanLocation;
  
  /** Annotation type used (e.g., "@Service", "@Bean") */
  annotationType: string;
  
  /** Bean scope (default: "singleton") */
  scope?: string;
  
  /** List of @Qualifier values */
  qualifiers?: string[];
  
  /** Whether marked with @Primary */
  isPrimary: boolean;
  
  /** Whether has @Conditional annotation */
  isConditional: boolean;
  
  /** Conditional annotation details */
  conditionalInfo?: string;

  /** Interfaces implemented by this bean (empty array if none) */
  implementedInterfaces?: string[];
}

/**
 * Validation utilities for BeanDefinition
 */
export namespace BeanDefinition {
  /**
   * Validate a BeanDefinition
   * @param bean Bean definition to validate
   * @returns Validation errors, empty array if valid
   */
  export function validate(bean: BeanDefinition): string[] {
    const errors: string[] = [];

    // Required fields
    if (!bean.name || bean.name.trim() === '') {
      errors.push('Bean name is required');
    }
    if (!bean.type || bean.type.trim() === '') {
      errors.push('Bean type is required');
    }
    if (!bean.location) {
      errors.push('Bean location is required');
    }

    // Format validation
    if (bean.type && !isValidJavaType(bean.type)) {
      errors.push(`Invalid Java type: ${bean.type}`);
    }

    // Logical validation
    if (bean.definitionType === BeanDefinitionType.BEAN_METHOD && !bean.type.includes('.')) {
      errors.push('@Bean method must return a fully qualified type');
    }

    // Location validation
    if (bean.location && bean.location.line < 0) {
      errors.push('Line number must be >= 0');
    }

    return errors;
  }

  /**
   * Check if a string is a valid Java type name
   * @param type Type string to check
   * @returns True if valid Java type
   */
  function isValidJavaType(type: string): boolean {
    // Basic check: should contain package path (at least one dot)
    // and follow Java naming conventions
    return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*\.[A-Z][a-zA-Z0-9_]*$/.test(type);
  }

  /**
   * Get default bean name from class name
   * Spring convention: first letter lowercase
   * @param className Simple class name (e.g., "UserService")
   * @returns Bean name (e.g., "userService")
   */
  export function getDefaultBeanName(className: string): string {
    if (!className || className.length === 0) {
      return '';
    }
    return className.charAt(0).toLowerCase() + className.slice(1);
  }

  /**
   * Extract simple class name from fully qualified type
   * @param type Fully qualified type (e.g., "com.example.UserService")
   * @returns Simple class name (e.g., "UserService")
   */
  export function getSimpleClassName(type: string): string {
    const lastDot = type.lastIndexOf('.');
    return lastDot >= 0 ? type.substring(lastDot + 1) : type;
  }

  /**
   * Extract package name from fully qualified type
   * @param type Fully qualified type (e.g., "com.example.UserService")
   * @returns Package name (e.g., "com.example")
   */
  export function getPackageName(type: string): string {
    const lastDot = type.lastIndexOf('.');
    return lastDot >= 0 ? type.substring(0, lastDot) : '';
  }
}
