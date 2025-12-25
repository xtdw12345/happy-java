/**
 * Bean candidate entity - represents a candidate Bean for an injection point
 */

import { BeanDefinition } from './BeanDefinition';
import { MatchReason, getMatchScore } from './types';

/**
 * Represents a candidate Bean that matches an injection point
 * Used when multiple beans could satisfy the same injection
 */
export interface BeanCandidate {
  /** The candidate bean definition */
  beanDefinition: BeanDefinition;

  /** Match score (0-100, higher is better) */
  matchScore: number;

  /** Reason for the match */
  matchReason: MatchReason;

  /** Display label for Quick Pick UI */
  displayLabel: string;

  /** Display description for Quick Pick UI (usually file path) */
  displayDescription?: string;

  /** Display detail for Quick Pick UI (bean information) */
  displayDetail?: string;
}

/**
 * Utilities for BeanCandidate
 */
export namespace BeanCandidate {
  /**
   * Create a BeanCandidate from a BeanDefinition
   * @param bean Bean definition
   * @param matchReason Why this bean matches
   * @returns BeanCandidate instance
   */
  export function create(bean: BeanDefinition, matchReason: MatchReason): BeanCandidate {
    return {
      beanDefinition: bean,
      matchScore: getMatchScore(matchReason),
      matchReason,
      displayLabel: formatDisplayLabel(bean),
      displayDescription: formatDisplayDescription(bean),
      displayDetail: formatDisplayDetail(bean)
    };
  }

  /**
   * Format display label for Quick Pick
   * @param bean Bean definition
   * @returns Formatted label with icon
   */
  function formatDisplayLabel(bean: BeanDefinition): string {
    const icon = getIconForAnnotation(bean.annotationType);
    const className = BeanDefinition.getSimpleClassName(bean.type);
    return `${icon} ${className}`;
  }

  /**
   * Format display description for Quick Pick
   * @param bean Bean definition
   * @returns Package name
   */
  function formatDisplayDescription(bean: BeanDefinition): string {
    return BeanDefinition.getPackageName(bean.type);
  }

  /**
   * Format display detail for Quick Pick
   * @param bean Bean definition
   * @returns Detailed information
   */
  function formatDisplayDetail(bean: BeanDefinition): string {
    const parts: string[] = [];

    // Annotation type
    parts.push(bean.annotationType);

    // Bean name
    parts.push(bean.name);

    // Primary marker
    if (bean.isPrimary) {
      parts.push('@Primary');
    }

    // Qualifiers
    if (bean.qualifiers && bean.qualifiers.length > 0) {
      const qualifierStr = bean.qualifiers.join(', ');
      parts.push(`@Qualifier(${qualifierStr})`);
    }

    // Scope (if not default)
    if (bean.scope && bean.scope !== 'singleton') {
      parts.push(`scope: ${bean.scope}`);
    }

    // File path
    const filePath = bean.location.uri.fsPath;
    parts.push(`${filePath}:${bean.location.line + 1}`);

    return parts.join(' • ');
  }

  /**
   * Get VS Code icon for annotation type
   * @param annotationType Annotation type string
   * @returns Icon string for VS Code
   */
  function getIconForAnnotation(annotationType: string): string {
    switch (annotationType) {
      case '@Service':
        return '$(gear)';
      case '@Repository':
        return '$(database)';
      case '@Controller':
      case '@RestController':
        return '$(globe)';
      case '@Component':
        return '$(symbol-class)';
      case '@Bean':
        return '$(symbol-method)';
      case '@Configuration':
        return '$(file-code)';
      default:
        return '$(symbol-class)';
    }
  }

  /**
   * Sort candidates by match score (descending)
   * @param candidates List of candidates
   * @returns Sorted list
   */
  export function sortByScore(candidates: BeanCandidate[]): BeanCandidate[] {
    return [...candidates].sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Filter candidates to only those with the highest score
   * @param candidates List of candidates
   * @returns Candidates with highest score
   */
  export function filterTopMatches(candidates: BeanCandidate[]): BeanCandidate[] {
    if (candidates.length === 0) {
      return [];
    }

    const sorted = sortByScore(candidates);
    const topScore = sorted[0].matchScore;
    return sorted.filter(c => c.matchScore === topScore);
  }

  /**
   * Get match reason description for display
   * @param reason Match reason
   * @returns Human-readable description
   */
  export function getMatchReasonDescription(reason: MatchReason): string {
    switch (reason) {
      case MatchReason.EXACT_QUALIFIER:
        return 'Exact @Qualifier match';
      case MatchReason.EXACT_NAME:
        return 'Exact bean name match';
      case MatchReason.PRIMARY_BEAN:
        return '@Primary bean';
      case MatchReason.TYPE_MATCH:
        return 'Type match';
      case MatchReason.SUBTYPE_MATCH:
        return 'Subtype match';
      default:
        return 'Unknown';
    }
  }
}
