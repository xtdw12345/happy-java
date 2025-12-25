/**
 * InterfaceResolver - Resolution logic for interface-to-bean mapping
 *
 * Applies Spring's disambiguation cascade:
 * 1. @Qualifier match (highest priority)
 * 2. @Primary bean
 * 3. Single implementation
 * 4. Multiple candidates (user must choose)
 */

import { InterfaceResolutionResult, DisambiguationContext } from '../models/types';
import { BeanDefinition } from '../models/BeanDefinition';
import { matchesInterface } from '../utils/typeUtils';

/**
 * Interface resolver for finding bean implementations
 */
export class InterfaceResolver {
  /**
   * Resolve interface to bean implementation using full disambiguation cascade
   *
   * @param context Disambiguation context with interface and candidates
   * @returns Resolution result indicating how bean was resolved
   */
  resolve(context: DisambiguationContext): InterfaceResolutionResult {
    // Filter candidates by type first
    const typedCandidates = this.filterByType(context.candidates, context.interfaceFQN);

    // Apply disambiguation cascade: Qualifier → @Primary → Single → Multiple
    if (context.qualifier) {
      const qualifierResult = this.resolveByQualifier(typedCandidates, context.qualifier);
      if (qualifierResult.status !== 'none') {
        return qualifierResult;
      }
    }

    const primaryResult = this.resolveByPrimary(typedCandidates);
    if (primaryResult.status !== 'none') {
      return primaryResult;
    }

    return this.resolveSingle(typedCandidates);
  }

  /**
   * Resolve when exactly one candidate or multiple candidates
   *
   * @param candidates Bean candidates
   * @returns Resolution result
   */
  resolveSingle(candidates: BeanDefinition[]): InterfaceResolutionResult {
    if (candidates.length === 0) {
      return { status: 'none' };
    }
    if (candidates.length === 1) {
      return { status: 'single', bean: candidates[0] };
    }
    return { status: 'multiple', candidates };
  }

  /**
   * Resolve by @Primary annotation
   *
   * @param candidates Bean candidates
   * @returns Resolution result with primary bean or none
   */
  resolveByPrimary(candidates: BeanDefinition[]): InterfaceResolutionResult {
    const primaryBeans = candidates.filter(b => b.isPrimary);

    if (primaryBeans.length === 1) {
      return { status: 'primary', bean: primaryBeans[0] };
    }

    // Multiple @Primary beans is a configuration error - return none
    // No @Primary beans - return none to continue cascade
    return { status: 'none' };
  }

  /**
   * Resolve by @Qualifier annotation or bean name
   *
   * @param candidates Bean candidates
   * @param qualifier Qualifier value to match
   * @returns Resolution result with qualified bean or none
   */
  resolveByQualifier(candidates: BeanDefinition[], qualifier: string): InterfaceResolutionResult {
    const matched = candidates.filter(b =>
      b.qualifiers?.includes(qualifier) || b.name === qualifier
    );

    if (matched.length === 1) {
      return { status: 'qualified', bean: matched[0] };
    }

    if (matched.length === 0) {
      return { status: 'none' };
    }

    // Multiple beans with same qualifier - return multiple for user selection
    return { status: 'multiple', candidates: matched };
  }

  /**
   * Filter candidates by interface type matching
   *
   * @param candidates All bean candidates
   * @param interfaceType Interface type to match
   * @returns Filtered beans that implement the interface
   */
  filterByType(candidates: BeanDefinition[], interfaceType: string): BeanDefinition[] {
    return candidates.filter(bean => {
      // Check if bean's implementedInterfaces includes this interface
      if (bean.implementedInterfaces) {
        for (const impl of bean.implementedInterfaces) {
          if (matchesInterface(impl, interfaceType)) {
            return true;
          }
        }
      }

      // Fallback: check if bean type matches interface type directly
      if (matchesInterface(bean.type, interfaceType)) {
        return true;
      }

      return false;
    });
  }
}
