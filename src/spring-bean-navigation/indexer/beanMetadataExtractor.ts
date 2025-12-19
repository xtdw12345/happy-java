/**
 * Bean metadata extractor - extracts Bean definitions and injection points from Java files
 */

import * as vscode from 'vscode';
import { JavaParser } from './javaParser';
import { AnnotationScanner, Annotation } from './annotationScanner';
import { BeanDefinition } from '../models/BeanDefinition';
import { BeanInjectionPoint } from '../models/BeanInjectionPoint';
import { BeanDefinitionType, InjectionType } from '../models/types';
import { BeanLocation } from '../models/BeanLocation';

/**
 * Bean metadata extraction result
 */
export interface ExtractionResult {
  definitions: BeanDefinition[];
  injectionPoints: BeanInjectionPoint[];
}

/**
 * Bean metadata extractor
 * Extracts bean definitions and injection points from parsed Java files
 */
export class BeanMetadataExtractor {
  private javaParser: JavaParser;
  private annotationScanner: AnnotationScanner;

  constructor() {
    this.javaParser = new JavaParser();
    this.annotationScanner = new AnnotationScanner();
  }

  /**
   * Extract bean metadata from a Java file
   * @param uri File URI
   * @returns Extraction result with definitions and injection points
   */
  async extractFromFile(uri: vscode.Uri): Promise<ExtractionResult> {
    const result: ExtractionResult = {
      definitions: [],
      injectionPoints: []
    };

    try {
      // Get CST from parser
      const cst = await this.javaParser.getCST(uri);
      if (!cst) {
        return result;
      }

      // Extract annotations
      const annotations = this.annotationScanner.extractAnnotations(cst, uri);

      // Extract bean definitions
      result.definitions = this.extractBeanDefinitions(annotations, uri, cst);

      // Extract injection points
      result.injectionPoints = this.extractInjectionPoints(annotations, uri, cst);

    } catch (error) {
      console.error(`[BeanMetadataExtractor] Failed to extract metadata from ${uri.fsPath}:`, error);
    }

    return result;
  }

  /**
   * Extract bean definitions from annotations
   * @param annotations List of annotations
   * @param uri File URI
   * @param cst Java CST
   * @returns Array of bean definitions
   */
  private extractBeanDefinitions(annotations: Annotation[], uri: vscode.Uri, cst: any): BeanDefinition[] {
    const definitions: BeanDefinition[] = [];

    for (const annotation of annotations) {
      if (this.annotationScanner.isBeanDefinitionAnnotation(annotation)) {
        const definition = this.createBeanDefinition(annotation, uri, cst);
        if (definition) {
          definitions.push(definition);
        }
      }
    }

    return definitions;
  }

  /**
   * Extract injection points from annotations
   * @param annotations List of annotations
   * @param uri File URI
   * @param cst Java CST
   * @returns Array of injection points
   */
  private extractInjectionPoints(annotations: Annotation[], uri: vscode.Uri, cst: any): BeanInjectionPoint[] {
    const injectionPoints: BeanInjectionPoint[] = [];

    for (const annotation of annotations) {
      if (this.annotationScanner.isInjectionAnnotation(annotation)) {
        const injectionPoint = this.createInjectionPoint(annotation, uri, cst);
        if (injectionPoint) {
          injectionPoints.push(injectionPoint);
        }
      }
    }

    return injectionPoints;
  }

  /**
   * Create a bean definition from an annotation
   * @param annotation Bean definition annotation
   * @param uri File URI
   * @param cst Java CST
   * @returns Bean definition or undefined
   */
  private createBeanDefinition(annotation: Annotation, uri: vscode.Uri, cst: any): BeanDefinition | undefined {
    try {
      // Extract bean name from annotation parameter or derive from class name
      const explicitName = this.annotationScanner.extractAnnotationParameter(annotation, 'value') ||
                          this.annotationScanner.extractAnnotationParameter(annotation, 'name');

      // Get class information from CST
      const classInfo = this.extractClassInfo(cst);
      if (!classInfo) {
        return undefined;
      }

      const beanName = explicitName || BeanDefinition.getDefaultBeanName(classInfo.className);
      const beanType = classInfo.fullyQualifiedName;

      // Determine definition type
      const definitionType = annotation.name === '@Bean'
        ? BeanDefinitionType.BEAN_METHOD
        : BeanDefinitionType.COMPONENT;

      // Extract qualifiers (look for @Qualifier annotation nearby)
      const qualifiers: string[] = [];

      // Check for @Primary
      const isPrimary = false; // Will be enhanced in user story implementation

      return {
        name: beanName,
        type: beanType,
        definitionType,
        location: annotation.location,
        annotationType: annotation.name,
        scope: 'singleton',
        qualifiers,
        isPrimary,
        isConditional: false
      };
    } catch (error) {
      console.error('[BeanMetadataExtractor] Failed to create bean definition:', error);
      return undefined;
    }
  }

  /**
   * Create an injection point from an annotation
   * @param annotation Injection annotation
   * @param uri File URI
   * @param cst Java CST
   * @returns Injection point or undefined
   */
  private createInjectionPoint(annotation: Annotation, uri: vscode.Uri, cst: any): BeanInjectionPoint | undefined {
    try {
      // Determine injection type based on context
      const injectionType = this.determineInjectionType(annotation, cst);

      // Extract field or parameter information
      const fieldInfo = this.extractFieldInfo(cst, annotation.location);
      if (!fieldInfo) {
        return undefined;
      }

      // Extract qualifier if present
      const qualifier = this.annotationScanner.extractAnnotationParameter(annotation, 'value');

      // Check if required (for @Autowired)
      const isRequired = annotation.name === '@Autowired' ? true : true;

      return {
        injectionType,
        beanType: fieldInfo.type,
        location: annotation.location,
        qualifier,
        isRequired,
        fieldName: fieldInfo.name
      };
    } catch (error) {
      console.error('[BeanMetadataExtractor] Failed to create injection point:', error);
      return undefined;
    }
  }

  /**
   * Extract class information from CST
   * @param cst Java CST
   * @returns Class info or undefined
   */
  private extractClassInfo(cst: any): { className: string; fullyQualifiedName: string; packageName: string } | undefined {
    try {
      // Extract package name
      const packageDecl = cst.children?.compilationUnit?.[0]?.children?.packageDeclaration?.[0];
      const packageName = this.extractPackageName(packageDecl) || '';

      // Extract class name
      const typeDecl = cst.children?.compilationUnit?.[0]?.children?.typeDeclaration?.[0];
      const classDecl = typeDecl?.children?.classDeclaration?.[0];
      const className = classDecl?.children?.typeIdentifier?.[0]?.children?.Identifier?.[0]?.image;

      if (!className) {
        return undefined;
      }

      const fullyQualifiedName = packageName ? `${packageName}.${className}` : className;

      return {
        className,
        fullyQualifiedName,
        packageName
      };
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Extract package name from package declaration
   * @param packageDecl Package declaration CST node
   * @returns Package name or empty string
   */
  private extractPackageName(packageDecl: any): string {
    try {
      if (!packageDecl) {
        return '';
      }

      const packageName = packageDecl.children?.Identifier || [];
      const parts = packageName.map((id: any) => id.image);
      return parts.join('.');
    } catch (error) {
      return '';
    }
  }

  /**
   * Determine injection type from context
   * @param annotation Injection annotation
   * @param cst Java CST
   * @returns Injection type
   */
  private determineInjectionType(annotation: Annotation, cst: any): InjectionType {
    // Simplified: assume field injection for now
    // Will be enhanced in user story implementation to detect constructor/method injection
    return InjectionType.FIELD;
  }

  /**
   * Extract field information from CST
   * @param cst Java CST
   * @param location Annotation location
   * @returns Field info or undefined
   */
  private extractFieldInfo(cst: any, location: BeanLocation): { name: string; type: string } | undefined {
    try {
      // Simplified: extract field information near the annotation location
      // Full implementation will properly navigate CST based on annotation position
      const fieldInfo = {
        name: 'unknownField',
        type: 'java.lang.Object'
      };

      return fieldInfo;
    } catch (error) {
      return undefined;
    }
  }
}
