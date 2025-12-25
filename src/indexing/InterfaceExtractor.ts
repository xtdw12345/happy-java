/**
 * InterfaceExtractor - Extracts interface declarations and implementation relationships from Java files
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { InterfaceDefinition } from '../models/types';
import { BeanLocation } from '../models/BeanLocation';
import { extractRawType } from '../utils/typeUtils';

/**
 * Interface extractor for finding interfaces and their implementations
 */
export class InterfaceExtractor {
  /**
   * Extract interface declarations from a Java file
   *
   * @param javaFilePath Path to Java file
   * @returns Array of interface definitions found in the file
   */
  async extractInterfaces(javaFilePath: string): Promise<InterfaceDefinition[]> {
    const interfaces: InterfaceDefinition[] = [];

    try {
      const uri = vscode.Uri.file(javaFilePath);
      const content = await fs.readFile(javaFilePath, 'utf-8');

      // Parse Java file with dynamic import
      const { parse } = await import('java-parser');
      const cst = parse(content);

      // Extract package name
      const packageName = this.extractPackageName(cst);

      // Extract interfaces
      const ordinaryCompilationUnit = (cst as any).children?.ordinaryCompilationUnit?.[0];
      if (!ordinaryCompilationUnit) {
        return interfaces;
      }

      const typeDeclarations = ordinaryCompilationUnit.children?.typeDeclaration || [];

      for (const typeDecl of typeDeclarations) {
        // Check for interface declaration
        const interfaceDecl = typeDecl.children?.interfaceDeclaration?.[0];
        if (interfaceDecl) {
          const interfaceDef = this.extractInterfaceFromDeclaration(
            interfaceDecl,
            packageName,
            uri
          );
          if (interfaceDef) {
            interfaces.push(interfaceDef);
          }
          continue;
        }

        // Check for abstract class (treat as interface)
        const classDecl = typeDecl.children?.classDeclaration?.[0];
        if (classDecl && this.isAbstractClass(classDecl)) {
          const abstractClass = this.extractAbstractClass(classDecl, packageName, uri);
          if (abstractClass) {
            interfaces.push(abstractClass);
          }
        }
      }
    } catch (error) {
      console.error('[InterfaceExtractor] Error extracting interfaces:', error);
    }

    return interfaces;
  }

  /**
   * Extract implemented interfaces from class declarations in a Java file
   *
   * @param javaFilePath Path to Java file
   * @returns Map of class name → array of interface FQNs
   */
  async extractImplementedInterfaces(javaFilePath: string): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();

    try {
      const content = await fs.readFile(javaFilePath, 'utf-8');

      // Parse Java file with dynamic import
      const { parse } = await import('java-parser');
      const cst = parse(content);

      // Extract package name for building FQNs
      const packageName = this.extractPackageName(cst);

      // Extract implementations
      const ordinaryCompilationUnit = (cst as any).children?.ordinaryCompilationUnit?.[0];
      if (!ordinaryCompilationUnit) {
        return result;
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

        // Get class name
        const className = normalClassDecl.children?.typeIdentifier?.[0]?.children?.Identifier?.[0]?.image;
        if (!className) {
          continue;
        }

        // Get implemented interfaces from classImplements (not superInterfaces!)
        const classImplements = normalClassDecl.children?.classImplements?.[0];
        if (!classImplements) {
          continue;
        }

        const interfaceTypeList = classImplements.children?.interfaceTypeList?.[0];
        if (!interfaceTypeList) {
          continue;
        }

        const interfaceTypes = interfaceTypeList.children?.interfaceType || [];
        const implementedInterfaces: string[] = [];

        for (const interfaceType of interfaceTypes) {
          const classType = interfaceType.children?.classType?.[0];
          if (!classType) {
            continue;
          }

          // Extract interface name (can be simple or qualified)
          const interfaceName = this.extractTypeName(classType, packageName);
          if (interfaceName) {
            // Build FQN if it's a simple name and we have a package
            const fqn = this.buildFullyQualifiedName(interfaceName, packageName);
            implementedInterfaces.push(fqn);
          }
        }

        if (implementedInterfaces.length > 0) {
          result.set(className, implementedInterfaces);
        }
      }
    } catch (error) {
      console.error('[InterfaceExtractor] Error extracting implemented interfaces:', error);
    }

    return result;
  }

  /**
   * Extract interface definition from interface declaration node
   *
   * @param interfaceDecl Interface declaration CST node
   * @param packageName Package name
   * @param uri File URI
   * @returns InterfaceDefinition or undefined
   */
  private extractInterfaceFromDeclaration(
    interfaceDecl: any,
    packageName: string,
    uri: vscode.Uri
  ): InterfaceDefinition | undefined {
    try {
      const normalInterfaceDecl = interfaceDecl.children?.normalInterfaceDeclaration?.[0];
      if (!normalInterfaceDecl) {
        return undefined;
      }

      // Get interface name
      const typeIdentifier = normalInterfaceDecl.children?.typeIdentifier?.[0];
      const simpleName = typeIdentifier?.children?.Identifier?.[0]?.image;
      if (!simpleName) {
        return undefined;
      }

      const fullyQualifiedName = packageName ? `${packageName}.${simpleName}` : simpleName;
      const rawType = extractRawType(simpleName);

      // Get location
      const location: BeanLocation = {
        uri,
        line: typeIdentifier?.location?.startLine ? typeIdentifier.location.startLine - 1 : 0,
        column: typeIdentifier?.location?.startColumn ? typeIdentifier.location.startColumn - 1 : 0
      };

      return {
        fullyQualifiedName,
        simpleName,
        packageName,
        location,
        isAbstract: false,
        rawType
      };
    } catch (error) {
      console.error('[InterfaceExtractor] Error extracting interface declaration:', error);
      return undefined;
    }
  }

  /**
   * Extract abstract class as interface
   *
   * @param classDecl Class declaration CST node
   * @param packageName Package name
   * @param uri File URI
   * @returns InterfaceDefinition or undefined
   */
  private extractAbstractClass(
    classDecl: any,
    packageName: string,
    uri: vscode.Uri
  ): InterfaceDefinition | undefined {
    try {
      const normalClassDecl = classDecl.children?.normalClassDeclaration?.[0];
      if (!normalClassDecl) {
        return undefined;
      }

      // Get class name
      const typeIdentifier = normalClassDecl.children?.typeIdentifier?.[0];
      const simpleName = typeIdentifier?.children?.Identifier?.[0]?.image;
      if (!simpleName) {
        return undefined;
      }

      const fullyQualifiedName = packageName ? `${packageName}.${simpleName}` : simpleName;
      const rawType = extractRawType(simpleName);

      // Get location
      const location: BeanLocation = {
        uri,
        line: typeIdentifier?.location?.startLine ? typeIdentifier.location.startLine - 1 : 0,
        column: typeIdentifier?.location?.startColumn ? typeIdentifier.location.startColumn - 1 : 0
      };

      return {
        fullyQualifiedName,
        simpleName,
        packageName,
        location,
        isAbstract: true,
        rawType
      };
    } catch (error) {
      console.error('[InterfaceExtractor] Error extracting abstract class:', error);
      return undefined;
    }
  }

  /**
   * Check if a class declaration is abstract
   *
   * @param classDecl Class declaration CST node
   * @returns True if class is abstract
   */
  private isAbstractClass(classDecl: any): boolean {
    try {
      const modifiers = classDecl.children?.classModifier || [];
      for (const modifier of modifiers) {
        const abstractKeyword = modifier.children?.Abstract;
        if (abstractKeyword && abstractKeyword.length > 0) {
          return true;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract package name from CST
   *
   * @param cst Java CST
   * @returns Package name or empty string
   */
  private extractPackageName(cst: any): string {
    try {
      const ordinaryCompilationUnit = cst.children?.ordinaryCompilationUnit?.[0];
      if (!ordinaryCompilationUnit) {
        return '';
      }

      const packageDecl = ordinaryCompilationUnit.children?.packageDeclaration?.[0];
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
   * Extract type name from classType node (can be simple or qualified)
   *
   * @param classType ClassType CST node
   * @param packageName Current file's package name (for context)
   * @returns Type name (FQN if available, simple name otherwise)
   */
  private extractTypeName(classType: any, packageName: string): string | undefined {
    try {
      // Direct Identifier access (for simple interface names like "UserRepository")
      const directIdentifiers = classType.children?.Identifier || [];
      if (directIdentifiers.length > 0) {
        // Simple case: single identifier
        if (directIdentifiers.length === 1) {
          return directIdentifiers[0].image;
        }
        // Multiple identifiers means qualified name (e.g., com.example.Repository)
        return directIdentifiers.map((id: any) => id.image).join('.');
      }

      // Try classOrInterfaceType for qualified names
      const classOrInterfaceType = classType.children?.classOrInterfaceType?.[0];
      if (classOrInterfaceType) {
        const identifiers = classOrInterfaceType.children?.Identifier || [];
        if (identifiers.length > 0) {
          return identifiers.map((id: any) => id.image).join('.');
        }
      }

      return undefined;
    } catch (error) {
      console.error('[InterfaceExtractor] Error extracting type name:', error);
      return undefined;
    }
  }

  /**
   * Build fully qualified name from a type name and package context
   *
   * @param typeName Type name (simple or qualified)
   * @param packageName Package name for context
   * @returns Fully qualified name
   */
  private buildFullyQualifiedName(typeName: string, packageName: string): string {
    // If type name already contains dots, it's likely already qualified
    if (typeName.includes('.')) {
      return typeName;
    }

    // If we have a package name, build FQN
    if (packageName) {
      return `${packageName}.${typeName}`;
    }

    // Otherwise return as-is (default package)
    return typeName;
  }
}
