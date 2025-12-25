/**
 * Annotation scanner - extracts Spring annotations from Java CST
 */

import * as vscode from 'vscode';
import { BeanLocation } from '../models/BeanLocation';

/**
 * Annotation information extracted from CST
 */
export interface Annotation {
  /** Annotation name (e.g., "@Service") */
  name: string;
  /** Fully qualified name */
  fullyQualifiedName: string;
  /** Annotation parameters */
  parameters: Map<string, any>;
  /** Location in source code */
  location: BeanLocation;
}

/**
 * Annotation scanner interface
 */
export interface IAnnotationScanner {
  /**
   * Extract annotations from CST
   * @param cst Java CST from java-parser
   * @param uri File URI for location information
   * @returns Array of annotations
   */
  extractAnnotations(cst: any, uri: vscode.Uri): Annotation[];

  /**
   * Check if annotation is a bean definition annotation
   * @param annotation Annotation to check
   * @returns True if bean definition annotation
   */
  isBeanDefinitionAnnotation(annotation: Annotation): boolean;

  /**
   * Check if annotation is an injection annotation
   * @param annotation Annotation to check
   * @returns True if injection annotation
   */
  isInjectionAnnotation(annotation: Annotation): boolean;

  /**
   * Extract annotation parameter value
   * @param annotation Annotation
   * @param paramName Parameter name
   * @returns Parameter value or undefined
   */
  extractAnnotationParameter(annotation: Annotation, paramName: string): string | undefined;
}

/**
 * Bean definition annotations
 */
const BEAN_DEFINITION_ANNOTATIONS = [
  '@Component',
  '@Service',
  '@Repository',
  '@Controller',
  '@RestController',
  '@Configuration',
  '@Bean'
];

/**
 * Injection annotations
 */
const INJECTION_ANNOTATIONS = [
  '@Autowired',
  '@Resource',
  '@Inject',
  '@Qualifier'
];

/**
 * Spring annotation scanner implementation
 */
export class AnnotationScanner implements IAnnotationScanner {
  /**
   * Extract annotations from Java CST
   * @param cst Java CST
   * @param uri File URI
   * @returns Array of annotations
   */
  extractAnnotations(cst: any, uri: vscode.Uri): Annotation[] {
    const annotations: Annotation[] = [];

    try {
      // Navigate CST to find annotations
      // java-parser CST structure: ordinaryCompilationUnit -> typeDeclaration -> classDeclaration
      if (!cst || !cst.children) {
        console.log(`[AnnotationScanner] No CST or children`);
        return annotations;
      }

      // Extract class-level annotations
      const classAnnotations = this.extractClassAnnotations(cst, uri);
      annotations.push(...classAnnotations);

      // Extract field annotations
      const fieldAnnotations = this.extractFieldAnnotations(cst, uri);
      annotations.push(...fieldAnnotations);

      // Extract method annotations
      const methodAnnotations = this.extractMethodAnnotations(cst, uri);
      annotations.push(...methodAnnotations);

    } catch (error) {
      console.error('[AnnotationScanner] Failed to extract annotations:', error);
    }

    return annotations;
  }

  /**
   * Check if annotation is a bean definition annotation
   * @param annotation Annotation
   * @returns True if bean definition annotation
   */
  isBeanDefinitionAnnotation(annotation: Annotation): boolean {
    return BEAN_DEFINITION_ANNOTATIONS.includes(annotation.name);
  }

  /**
   * Check if annotation is an injection annotation
   * @param annotation Annotation
   * @returns True if injection annotation
   */
  isInjectionAnnotation(annotation: Annotation): boolean {
    return INJECTION_ANNOTATIONS.includes(annotation.name);
  }

  /**
   * Extract annotation parameter value
   * @param annotation Annotation
   * @param paramName Parameter name (default is "value")
   * @returns Parameter value as string
   */
  extractAnnotationParameter(annotation: Annotation, paramName: string = 'value'): string | undefined {
    return annotation.parameters.get(paramName);
  }

  /**
   * Extract class-level annotations
   * @param cst Java CST
   * @param uri File URI
   * @returns Array of annotations
   */
  private extractClassAnnotations(cst: any, uri: vscode.Uri): Annotation[] {
    const annotations: Annotation[] = [];

    try {
      // Navigate to class declaration
      // Note: java-parser returns ordinaryCompilationUnit, not compilationUnit
      const ordinaryCompilationUnit = cst.children?.ordinaryCompilationUnit?.[0];
      if (!ordinaryCompilationUnit) {
        console.log('[AnnotationScanner] No ordinaryCompilationUnit found');
        return annotations;
      }

      const typeDeclarations = ordinaryCompilationUnit.children?.typeDeclaration || [];
      console.log(`[AnnotationScanner] Found ${typeDeclarations.length} type declarations`);

      for (const typeDecl of typeDeclarations) {
        const classDecl = typeDecl.children?.classDeclaration?.[0];
        if (!classDecl) {
          continue;
        }

        console.log('[AnnotationScanner] Found class declaration');

        // Extract annotations from class modifiers
        const modifiers = classDecl.children?.classModifier || [];
        console.log(`[AnnotationScanner] Found ${modifiers.length} class modifiers`);

        for (const modifier of modifiers) {
          const annotation = this.extractAnnotationFromModifier(modifier, uri);
          if (annotation) {
            console.log(`[AnnotationScanner] Extracted class annotation: ${annotation.name}`);
            annotations.push(annotation);
          }
        }
      }
    } catch (error) {
      console.error('[AnnotationScanner] Error extracting class annotations:', error);
    }

    return annotations;
  }

  /**
   * Extract field annotations
   * @param cst Java CST
   * @param uri File URI
   * @returns Array of annotations
   */
  private extractFieldAnnotations(cst: any, uri: vscode.Uri): Annotation[] {
    const annotations: Annotation[] = [];

    try {
      // Navigate to field declarations
      const ordinaryCompilationUnit = cst.children?.ordinaryCompilationUnit?.[0];
      if (!ordinaryCompilationUnit) {
        return annotations;
      }

      const typeDeclarations = ordinaryCompilationUnit.children?.typeDeclaration || [];

      for (const typeDecl of typeDeclarations) {
        const classDecl = typeDecl.children?.classDeclaration?.[0];
        if (!classDecl) {
          continue;
        }

        // Access normalClassDeclaration first
        const normalClassDecl = classDecl.children?.normalClassDeclaration?.[0];
        if (!normalClassDecl) {
          continue;
        }

        const classBody = normalClassDecl.children?.classBody?.[0];
        if (!classBody) {
          continue;
        }

        const classBodyDecls = classBody.children?.classBodyDeclaration || [];

        for (const bodyDecl of classBodyDecls) {
          const fieldDecl = bodyDecl.children?.classMemberDeclaration?.[0]?.children?.fieldDeclaration?.[0];
          if (!fieldDecl) {
            continue;
          }

          // Extract field modifiers (annotations)
          const modifiers = bodyDecl.children?.modifier || [];
          for (const modifier of modifiers) {
            const annotation = this.extractAnnotationFromModifier(modifier, uri);
            if (annotation) {
              console.log(`[AnnotationScanner] Extracted field annotation: ${annotation.name}`);
              annotations.push(annotation);
            }
          }
        }
      }
    } catch (error) {
      console.error('[AnnotationScanner] Error extracting field annotations:', error);
    }

    return annotations;
  }

  /**
   * Extract method annotations
   * @param cst Java CST
   * @param uri File URI
   * @returns Array of annotations
   */
  private extractMethodAnnotations(cst: any, uri: vscode.Uri): Annotation[] {
    const annotations: Annotation[] = [];

    try {
      // Similar to field annotations, but for methods
      const ordinaryCompilationUnit = cst.children?.ordinaryCompilationUnit?.[0];
      if (!ordinaryCompilationUnit) {
        return annotations;
      }

      const typeDeclarations = ordinaryCompilationUnit.children?.typeDeclaration || [];

      for (const typeDecl of typeDeclarations) {
        const classDecl = typeDecl.children?.classDeclaration?.[0];
        if (!classDecl) {
          continue;
        }

        // Access normalClassDeclaration first
        const normalClassDecl = classDecl.children?.normalClassDeclaration?.[0];
        if (!normalClassDecl) {
          continue;
        }

        const classBody = normalClassDecl.children?.classBody?.[0];
        if (!classBody) {
          continue;
        }

        const classBodyDecls = classBody.children?.classBodyDeclaration || [];

        for (const bodyDecl of classBodyDecls) {
          const methodDecl = bodyDecl.children?.classMemberDeclaration?.[0]?.children?.methodDeclaration?.[0];
          if (!methodDecl) {
            continue;
          }

          // Extract method modifiers (annotations)
          const modifiers = bodyDecl.children?.modifier || [];
          for (const modifier of modifiers) {
            const annotation = this.extractAnnotationFromModifier(modifier, uri);
            if (annotation) {
              console.log(`[AnnotationScanner] Extracted method annotation: ${annotation.name}`);
              annotations.push(annotation);
            }
          }
        }
      }
    } catch (error) {
      console.error('[AnnotationScanner] Error extracting method annotations:', error);
    }

    return annotations;
  }

  /**
   * Extract annotation from CST modifier node
   * @param modifier Modifier CST node
   * @param uri File URI
   * @returns Annotation or undefined
   */
  private extractAnnotationFromModifier(modifier: any, uri: vscode.Uri): Annotation | undefined {
    try {
      const annotationNode = modifier.children?.annotation?.[0];
      if (!annotationNode) {
        return undefined;
      }

      // Get annotation name
      const name = this.getAnnotationName(annotationNode);
      if (!name) {
        return undefined;
      }

      // Get location
      const location = this.getAnnotationLocation(annotationNode, uri);

      // Extract parameters
      const parameters = this.extractAnnotationParameters(annotationNode);

      return {
        name: `@${name}`,
        fullyQualifiedName: this.getFullyQualifiedName(name),
        parameters,
        location
      };
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get annotation name from CST node
   * @param annotationNode Annotation CST node
   * @returns Annotation name
   */
  private getAnnotationName(annotationNode: any): string | undefined {
    try {
      const typeName = annotationNode.children?.typeName?.[0];
      if (!typeName) {
        return undefined;
      }

      // Get identifier
      const identifier = typeName.children?.Identifier?.[0];
      if (identifier?.image) {
        return identifier.image;
      }

      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get annotation location from CST node
   * @param annotationNode Annotation CST node
   * @param uri File URI
   * @returns Bean location
   */
  private getAnnotationLocation(annotationNode: any, uri: vscode.Uri): BeanLocation {
    try {
      // Extract location from token
      const location = annotationNode.location;
      if (location) {
        return {
          uri,
          line: location.startLine ? location.startLine - 1 : 0,
          column: location.startColumn ? location.startColumn - 1 : 0
        };
      }
    } catch (error) {
      // Fall back to default location
    }

    return {
      uri,
      line: 0,
      column: 0
    };
  }

  /**
   * Extract annotation parameters
   * @param annotationNode Annotation CST node
   * @returns Map of parameters
   */
  private extractAnnotationParameters(annotationNode: any): Map<string, any> {
    const parameters = new Map<string, any>();

    try {
      // Extract annotation parameters
      // This is simplified - full implementation would parse elementValuePairList
      const elementValuePairs = annotationNode.children?.elementValuePairList?.[0]?.children?.elementValuePair || [];

      for (const pair of elementValuePairs) {
        const key = pair.children?.Identifier?.[0]?.image || 'value';
        const value = this.extractElementValue(pair.children?.elementValue?.[0]);
        parameters.set(key, value);
      }

      // Handle single-value annotation like @Service("userService")
      const elementValue = annotationNode.children?.elementValue?.[0];
      if (elementValue) {
        const value = this.extractElementValue(elementValue);
        parameters.set('value', value);
      }
    } catch (error) {
      // Return empty parameters
    }

    return parameters;
  }

  /**
   * Extract element value from CST
   * @param elementValue Element value CST node
   * @returns Value as string
   */
  private extractElementValue(elementValue: any): string | undefined {
    if (!elementValue) {
      return undefined;
    }

    try {
      // String literal
      const stringLiteral = elementValue.children?.expression?.[0]?.children?.lambdaExpression?.[0]?.children?.ternaryExpression?.[0]?.children?.binaryExpression?.[0]?.children?.unaryExpression?.[0]?.children?.primary?.[0]?.children?.primaryPrefix?.[0]?.children?.literal?.[0]?.children?.StringLiteral?.[0];
      if (stringLiteral?.image) {
        // Remove quotes
        return stringLiteral.image.replace(/^["']|["']$/g, '');
      }

      // Identifier
      const identifier = elementValue.children?.Identifier?.[0];
      if (identifier?.image) {
        return identifier.image;
      }

      // For complex values (like annotations), extract all tokens
      const tokens = this.extractAllTokens(elementValue);
      if (tokens.length > 0) {
        return tokens.join('');
      }
    } catch (error) {
      // Return undefined
    }

    return undefined;
  }

  /**
   * Recursively extract all tokens from a CST node
   * @param node CST node
   * @returns Array of token images
   */
  private extractAllTokens(node: any): string[] {
    const tokens: string[] = [];

    if (!node) {
      return tokens;
    }

    // If this node has an image, it's a token
    if (node.image !== undefined) {
      tokens.push(node.image);
      return tokens;
    }

    // If this node has children, recursively extract from children
    if (node.children) {
      for (const key in node.children) {
        const children = node.children[key];
        if (Array.isArray(children)) {
          for (const child of children) {
            tokens.push(...this.extractAllTokens(child));
          }
        }
      }
    }

    return tokens;
  }

  /**
   * Get fully qualified name for annotation
   * @param simpleName Simple annotation name
   * @returns Fully qualified name
   */
  private getFullyQualifiedName(simpleName: string): string {
    // Map common Spring annotations to FQN
    const fqnMap: Record<string, string> = {
      'Component': 'org.springframework.stereotype.Component',
      'Service': 'org.springframework.stereotype.Service',
      'Repository': 'org.springframework.stereotype.Repository',
      'Controller': 'org.springframework.stereotype.Controller',
      'RestController': 'org.springframework.web.bind.annotation.RestController',
      'Configuration': 'org.springframework.context.annotation.Configuration',
      'Bean': 'org.springframework.context.annotation.Bean',
      'Autowired': 'org.springframework.beans.factory.annotation.Autowired',
      'Resource': 'javax.annotation.Resource',
      'Inject': 'javax.inject.Inject',
      'Qualifier': 'org.springframework.beans.factory.annotation.Qualifier',
      'Primary': 'org.springframework.context.annotation.Primary',
      // Lombok annotations
      'NonNull': 'lombok.NonNull',
      'RequiredArgsConstructor': 'lombok.RequiredArgsConstructor',
      'AllArgsConstructor': 'lombok.AllArgsConstructor'
    };

    return fqnMap[simpleName] || simpleName;
  }
}
