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
  SETTER_METHOD = 'SETTER_METHOD',
  /** Lombok-generated constructor injection (@RequiredArgsConstructor/@AllArgsConstructor with onConstructor) */
  LOMBOK_CONSTRUCTOR = 'LOMBOK_CONSTRUCTOR'
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

/**
 * Lombok constructor annotation types
 */
export enum LombokConstructorType {
  /** @RequiredArgsConstructor - includes @NonNull and final fields */
  REQUIRED_ARGS = 'required-args',
  /** @AllArgsConstructor - includes all fields */
  ALL_ARGS = 'all-args'
}

/**
 * OnConstructor parameter syntax variants
 */
export enum OnConstructorSyntax {
  /** Java 7 style: onConstructor=@__({@Autowired}) */
  JAVA7 = 'java7',
  /** Java 8+ style: onConstructor_={@Autowired} */
  JAVA8_UNDERSCORE = 'java8-underscore',
  /** Java 8+ style: onConstructor__={@Autowired} */
  JAVA8_DOUBLE_UNDERSCORE = 'java8-double-underscore'
}

/**
 * Detected Lombok constructor annotation with dependency injection
 */
export interface LombokConstructorAnnotation {
  /** Type of Lombok constructor */
  type: LombokConstructorType;
  /** Whether onConstructor contains @Autowired */
  hasAutowired: boolean;
  /** OnConstructor syntax variant detected */
  syntaxVariant: OnConstructorSyntax;
  /** Location of the annotation */
  location: import('./BeanLocation').BeanLocation;
}

/**
 * Field information extracted from CST for Lombok processing
 */
export interface LombokFieldInfo {
  /** Field name */
  name: string;
  /** Field type (fully qualified if possible, simple name otherwise) */
  type: string;
  /** Location in source code */
  location: import('./BeanLocation').BeanLocation;
  /** Whether field has @NonNull annotation */
  hasNonNull: boolean;
  /** Whether field is final */
  isFinal: boolean;
  /** Optional @Qualifier value */
  qualifier?: string;
  /** Field annotations (for future extensibility) */
  annotations: string[];
}
