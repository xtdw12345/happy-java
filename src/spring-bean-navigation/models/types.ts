/**
 * Type definitions and enumerations for Spring Bean navigation
 */

/**
 * Bean definition type - how the bean is defined
 */
export enum BeanDefinitionType {
  /** Bean defined via @Component/@Service/@Repository/@Controller annotations */
  COMPONENT = 'COMPONENT',
  /** Bean defined via @Bean method in @Configuration class */
  BEAN_METHOD = 'BEAN_METHOD',
  /** @Configuration class itself (rarely used for navigation) */
  CONFIGURATION = 'CONFIGURATION'
}

/**
 * Injection type - how the bean is injected
 */
export enum InjectionType {
  /** Field injection via @Autowired/@Resource/@Inject */
  FIELD = 'FIELD',
  /** Constructor parameter injection */
  CONSTRUCTOR = 'CONSTRUCTOR',
  /** Setter method injection */
  SETTER_METHOD = 'SETTER_METHOD'
}

/**
 * Match reason - why a bean candidate matches an injection point
 */
export enum MatchReason {
  /** Exact @Qualifier match (highest priority, score: 100) */
  EXACT_QUALIFIER = 'EXACT_QUALIFIER',
  /** Bean name exact match (score: 90) */
  EXACT_NAME = 'EXACT_NAME',
  /** @Primary bean (score: 80) */
  PRIMARY_BEAN = 'PRIMARY_BEAN',
  /** Type exact match (score: 70) */
  TYPE_MATCH = 'TYPE_MATCH',
  /** Subtype match (score: 60) */
  SUBTYPE_MATCH = 'SUBTYPE_MATCH'
}

/**
 * Get match score for a given match reason
 * @param reason Match reason
 * @returns Match score (0-100)
 */
export function getMatchScore(reason: MatchReason): number {
  switch (reason) {
    case MatchReason.EXACT_QUALIFIER:
      return 100;
    case MatchReason.EXACT_NAME:
      return 90;
    case MatchReason.PRIMARY_BEAN:
      return 80;
    case MatchReason.TYPE_MATCH:
      return 70;
    case MatchReason.SUBTYPE_MATCH:
      return 60;
    default:
      return 0;
  }
}
