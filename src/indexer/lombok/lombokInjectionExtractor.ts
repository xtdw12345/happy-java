/**
 * Lombok Injection Extractor
 *
 * Extracts injection points from fields in classes with Lombok constructor annotations.
 * Converts @NonNull and final fields into BeanInjectionPoint objects based on constructor type.
 */

import * as vscode from 'vscode';
import { BeanInjectionPoint } from '../../models/BeanInjectionPoint';
import {
  LombokConstructorAnnotation,
  LombokConstructorType,
  LombokFieldInfo
} from '../../models/types';
import { InjectionType } from '../../models/types';

/**
 * Extracts injection points from Lombok-annotated classes
 */
export class LombokInjectionExtractor {
  /**
   * Extract injection points from Lombok-annotated class
   *
   * Main entry point that orchestrates field extraction and filtering
   *
   * @param cst Java CST from java-parser
   * @param uri File URI for location information
   * @param lombokAnnotation Detected Lombok constructor annotation
   * @returns Array of injection points for Lombok-injected fields
   */
  extract(cst: any, uri: vscode.Uri, lombokAnnotation: LombokConstructorAnnotation): BeanInjectionPoint[] {
    try {
      // Extract all field information from CST
      const allFields = this.extractFieldInfo(cst, uri);

      // Filter fields based on Lombok constructor type
      const eligibleFields = this.filterFields(allFields, lombokAnnotation);

      // Convert to BeanInjectionPoint objects
      const injectionPoints = this.convertToInjectionPoints(eligibleFields);

      return injectionPoints;
    } catch (error) {
      console.error('[LombokInjectionExtractor] Failed to extract injection points:', error);
      return []; // Return empty array on error (don't throw)
    }
  }

  /**
   * Extract field information from CST
   *
   * Navigates CST to find all field declarations and extracts relevant metadata
   *
   * @param cst Java CST from java-parser
   * @param uri File URI for location information
   * @returns Array of field information objects
   */
  extractFieldInfo(cst: any, uri: vscode.Uri): LombokFieldInfo[] {
    const fields: LombokFieldInfo[] = [];

    try {
      // Navigate CST: ordinaryCompilationUnit → typeDeclaration → classDeclaration
      // → normalClassDeclaration → classBody → classBodyDeclaration
      const ordinaryCompilationUnit = cst.children?.ordinaryCompilationUnit?.[0];
      if (!ordinaryCompilationUnit) {
        return fields;
      }

      const typeDeclarations = ordinaryCompilationUnit.children?.typeDeclaration || [];

      for (const typeDecl of typeDeclarations) {
        const classDecl = typeDecl.children?.classDeclaration?.[0];
        if (!classDecl) {
          continue;
        }

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

          // Extract field modifiers (includes annotations and keywords)
          const modifiers = bodyDecl.children?.modifier || [];

          // Extract field metadata
          const fieldName = this.extractFieldName(fieldDecl);
          const fieldType = this.extractFieldType(fieldDecl);
          const location = this.extractFieldLocation(fieldDecl, uri);
          const hasNonNull = this.hasNonNullAnnotation(modifiers);
          const isFinal = this.isFinalField(modifiers);
          const qualifier = this.extractQualifier(modifiers);
          const annotations = this.extractAnnotationNames(modifiers);

          if (fieldName && fieldType) {
            fields.push({
              name: fieldName,
              type: fieldType,
              location,
              hasNonNull,
              isFinal,
              qualifier,
              annotations
            });
          }
        }
      }
    } catch (error) {
      console.warn('[LombokInjectionExtractor] Error extracting field info:', error);
    }

    return fields;
  }

  /**
   * Filter fields based on Lombok constructor type
   *
   * @param fields All fields extracted from class
   * @param lombokAnnotation Lombok constructor annotation with type information
   * @returns Filtered fields that will be included in generated constructor
   */
  filterFields(fields: LombokFieldInfo[], lombokAnnotation: LombokConstructorAnnotation): LombokFieldInfo[] {
    // For @AllArgsConstructor, include all fields (no filtering)
    if (lombokAnnotation.type === LombokConstructorType.ALL_ARGS) {
      return fields;
    }

    // For @RequiredArgsConstructor, include only @NonNull and final fields
    if (lombokAnnotation.type === LombokConstructorType.REQUIRED_ARGS) {
      return fields.filter(field => field.hasNonNull || field.isFinal);
    }

    return [];
  }

  /**
   * Convert field info to injection points
   *
   * Transforms LombokFieldInfo objects into BeanInjectionPoint objects
   *
   * @param fields Filtered field information
   * @returns Array of injection points with injectionType = LOMBOK_CONSTRUCTOR
   */
  convertToInjectionPoints(fields: LombokFieldInfo[]): BeanInjectionPoint[] {
    return fields.map(field => ({
      injectionType: InjectionType.LOMBOK_CONSTRUCTOR,
      beanType: field.type,
      location: field.location,
      qualifier: field.qualifier,
      isRequired: true, // Lombok constructor injections are always required
      fieldName: field.name
    }));
  }

  /**
   * Extract field type from CST node
   *
   * Navigates fieldDeclaration → unannType → classOrInterfaceType → Identifier
   *
   * @param fieldDeclaration Field declaration CST node
   * @returns Field type as string (simple name or qualified name)
   */
  extractFieldType(fieldDeclaration: any): string {
    try {
      // Navigate: fieldDeclaration → unannType → classOrInterfaceType → typeIdentifier → Identifier
      const unannType = fieldDeclaration.children?.unannType?.[0];
      if (!unannType) {
        return 'Object';
      }

      const classOrInterfaceType = unannType.children?.classOrInterfaceType?.[0];
      if (!classOrInterfaceType) {
        return 'Object';
      }

      const typeIdentifier = classOrInterfaceType.children?.typeIdentifier?.[0];
      if (!typeIdentifier) {
        return 'Object';
      }

      const identifier = typeIdentifier.children?.Identifier?.[0];
      if (identifier?.image) {
        return identifier.image;
      }

      return 'Object';
    } catch (error) {
      console.warn('[LombokInjectionExtractor] Failed to extract field type:', error);
      return 'Object';
    }
  }

  /**
   * Extract field name from field declaration
   *
   * @param fieldDeclaration Field declaration CST node
   * @returns Field name
   */
  private extractFieldName(fieldDeclaration: any): string | undefined {
    try {
      const variableDeclaratorList = fieldDeclaration.children?.variableDeclaratorList?.[0];
      if (!variableDeclaratorList) {
        return undefined;
      }

      const variableDeclarator = variableDeclaratorList.children?.variableDeclarator?.[0];
      if (!variableDeclarator) {
        return undefined;
      }

      const variableDeclaratorId = variableDeclarator.children?.variableDeclaratorId?.[0];
      if (!variableDeclaratorId) {
        return undefined;
      }

      const identifier = variableDeclaratorId.children?.Identifier?.[0];
      return identifier?.image;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Extract field location from CST node
   *
   * @param fieldDeclaration Field declaration CST node
   * @param uri File URI
   * @returns Field location
   */
  private extractFieldLocation(fieldDeclaration: any, uri: vscode.Uri): any {
    try {
      const location = fieldDeclaration.location;
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
   * Check if field has @NonNull annotation
   *
   * @param fieldModifiers Field modifier CST nodes (includes annotations)
   * @returns True if @NonNull annotation present
   */
  hasNonNullAnnotation(fieldModifiers: any[]): boolean {
    for (const modifier of fieldModifiers) {
      const annotation = modifier.children?.annotation?.[0];
      if (!annotation) {
        continue;
      }

      const typeName = annotation.children?.typeName?.[0];
      const identifier = typeName?.children?.Identifier?.[0];

      if (identifier?.image === 'NonNull') {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if field is final
   *
   * @param fieldModifiers Field modifier CST nodes
   * @returns True if final modifier present
   */
  isFinalField(fieldModifiers: any[]): boolean {
    for (const modifier of fieldModifiers) {
      const finalKeyword = modifier.children?.Final?.[0];
      if (finalKeyword) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract @Qualifier value from field
   *
   * @param fieldModifiers Field modifier CST nodes (includes annotations)
   * @returns Qualifier value if present, undefined otherwise
   */
  extractQualifier(fieldModifiers: any[]): string | undefined {
    for (const modifier of fieldModifiers) {
      const annotation = modifier.children?.annotation?.[0];
      if (!annotation) {
        continue;
      }

      const typeName = annotation.children?.typeName?.[0];
      const identifier = typeName?.children?.Identifier?.[0];

      if (identifier?.image === 'Qualifier') {
        // Extract value parameter
        const elementValue = annotation.children?.elementValue?.[0];
        if (elementValue) {
          const stringLiteral = this.extractStringLiteral(elementValue);
          if (stringLiteral) {
            // Remove quotes
            return stringLiteral.replace(/^["']|["']$/g, '');
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Extract annotation names from modifiers
   *
   * @param modifiers Field modifiers
   * @returns Array of annotation names
   */
  private extractAnnotationNames(modifiers: any[]): string[] {
    const annotations: string[] = [];

    for (const modifier of modifiers) {
      const annotation = modifier.children?.annotation?.[0];
      if (!annotation) {
        continue;
      }

      const typeName = annotation.children?.typeName?.[0];
      const identifier = typeName?.children?.Identifier?.[0];

      if (identifier?.image) {
        annotations.push(`@${identifier.image}`);
      }
    }

    return annotations;
  }

  /**
   * Extract string literal from element value
   *
   * @param elementValue Element value CST node
   * @returns String value without quotes
   */
  private extractStringLiteral(elementValue: any): string | undefined {
    try {
      // Navigate through CST to find string literal
      const expression = elementValue.children?.expression?.[0];
      const lambdaExpression = expression?.children?.lambdaExpression?.[0];
      const ternaryExpression = lambdaExpression?.children?.ternaryExpression?.[0];
      const binaryExpression = ternaryExpression?.children?.binaryExpression?.[0];
      const unaryExpression = binaryExpression?.children?.unaryExpression?.[0];
      const primary = unaryExpression?.children?.primary?.[0];
      const primaryPrefix = primary?.children?.primaryPrefix?.[0];
      const literal = primaryPrefix?.children?.literal?.[0];
      const stringLiteral = literal?.children?.StringLiteral?.[0];

      return stringLiteral?.image;
    } catch (error) {
      return undefined;
    }
  }
}
