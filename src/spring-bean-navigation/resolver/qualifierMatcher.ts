/**
 * Qualifier matcher - handles @Qualifier matching logic
 */

import { BeanDefinition } from '../models/BeanDefinition';
import { BeanInjectionPoint } from '../models/BeanInjectionPoint';

/**
 * Qualifier matcher for beans
 */
export class QualifierMatcher {
  /**
   * Check if bean matches qualifier
   * @param bean Bean definition
   * @param qualifier Qualifier value
   * @returns True if matches
   */
  matchesQualifier(bean: BeanDefinition, qualifier: string): boolean {
    if (!bean.qualifiers) {
      return false;
    }
    return bean.qualifiers.includes(qualifier);
  }

  /**
   * Get all beans matching qualifier
   * @param beans Array of bean definitions
   * @param qualifier Qualifier value
   * @returns Filtered array of beans
   */
  filterByQualifier(beans: BeanDefinition[], qualifier: string): BeanDefinition[] {
    return beans.filter(bean => this.matchesQualifier(bean, qualifier));
  }

  /**
   * Check if injection point has qualifier
   * @param injection Injection point
   * @returns True if has qualifier
   */
  hasQualifier(injection: BeanInjectionPoint): boolean {
    return !!injection.qualifier;
  }

  /**
   * Get effective qualifier for injection point
   * Priority: @Qualifier > @Resource(name) > none
   * @param injection Injection point
   * @returns Qualifier value or undefined
   */
  getEffectiveQualifier(injection: BeanInjectionPoint): string | undefined {
    if (injection.qualifier) {
      return injection.qualifier;
    }
    if (injection.beanName) {
      // @Resource(name="xxx") is similar to @Qualifier
      return injection.beanName;
    }
    return undefined;
  }
}
