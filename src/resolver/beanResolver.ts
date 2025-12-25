/**
 * Bean resolver - resolves bean injection points to bean definitions
 */

import { BeanDefinition } from '../models/BeanDefinition';
import { BeanInjectionPoint } from '../models/BeanInjectionPoint';
import { BeanCandidate } from '../models/BeanCandidate';
import { BeanIndex } from '../models/BeanIndex';
import { MatchReason } from '../models/types';

/**
 * Match result for bean resolution
 */
export interface MatchResult {
  isMatch: boolean;
  score: number;
  reason: MatchReason;
}

/**
 * Bean resolver interface
 */
export interface IBeanResolver {
  /**
   * Resolve injection point to bean candidates
   * @param injection Injection point
   * @param index Bean index
   * @returns Array of bean candidates sorted by match score
   */
  resolve(injection: BeanInjectionPoint, index: BeanIndex): BeanCandidate[];

  /**
   * Check if bean matches injection point
   * @param bean Bean definition
   * @param injection Injection point
   * @returns Match result
   */
  matches(bean: BeanDefinition, injection: BeanInjectionPoint): MatchResult;
}

/**
 * Bean resolver implementation
 */
export class BeanResolver implements IBeanResolver {
  /**
   * Resolve injection point to bean candidates
   * @param injection Injection point
   * @param index Bean index
   * @returns Array of bean candidates
   */
  resolve(injection: BeanInjectionPoint, index: BeanIndex): BeanCandidate[] {
    // Delegate to BeanIndex which has the resolution logic
    return index.findCandidates(injection);
  }

  /**
   * Check if bean matches injection point
   * @param bean Bean definition
   * @param injection Injection point
   * @returns Match result
   */
  matches(bean: BeanDefinition, injection: BeanInjectionPoint): MatchResult {
    // Check for Qualifier match
    if (injection.qualifier && bean.qualifiers) {
      const hasQualifier = bean.qualifiers.includes(injection.qualifier);
      if (hasQualifier) {
        return {
          isMatch: true,
          score: 100,
          reason: MatchReason.EXACT_QUALIFIER
        };
      }
    }

    // Check for name match
    if (injection.beanName && bean.name === injection.beanName) {
      return {
        isMatch: true,
        score: 90,
        reason: MatchReason.EXACT_NAME
      };
    }

    // Check for type match
    // Support both FQN match and simple name match
    const isTypeMatch = this.isTypeMatch(bean.type, injection.beanType);
    if (isTypeMatch) {
      if (bean.isPrimary) {
        return {
          isMatch: true,
          score: 80,
          reason: MatchReason.PRIMARY_BEAN
        };
      }
      return {
        isMatch: true,
        score: 70,
        reason: MatchReason.TYPE_MATCH
      };
    }

    // No match
    return {
      isMatch: false,
      score: 0,
      reason: MatchReason.TYPE_MATCH
    };
  }

  /**
   * Check if bean type matches injection type
   * Supports both FQN and simple class name matching
   * @param beanType Bean type (e.g., "com.example.UserService")
   * @param injectionType Injection type (e.g., "UserService" or "com.example.UserService")
   * @returns True if types match
   */
  private isTypeMatch(beanType: string, injectionType: string): boolean {
    // Exact match (both FQN or both simple names)
    if (beanType === injectionType) {
      return true;
    }

    // Check if injection type is a simple name that matches bean's FQN
    // e.g., beanType="com.example.UserService", injectionType="UserService"
    if (beanType.endsWith('.' + injectionType)) {
      return true;
    }

    // Check if bean type is a simple name that matches injection's FQN
    // e.g., beanType="UserService", injectionType="com.example.UserService"
    if (injectionType.endsWith('.' + beanType)) {
      return true;
    }

    return false;
  }
}
