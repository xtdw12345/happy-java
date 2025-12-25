/**
 * Java parser - wraps java-parser library for parsing Java source files
 */

import * as vscode from 'vscode';
import { BeanDefinition } from '../models/BeanDefinition';
import { BeanInjectionPoint } from '../models/BeanInjectionPoint';

/**
 * Parse error information
 */
export interface ParseError {
  message: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
}

/**
 * Parse result containing bean definitions and injection points
 */
export interface ParseResult {
  /** Bean definitions found in the file */
  definitions: BeanDefinition[];
  /** Injection points found in the file */
  injectionPoints: BeanInjectionPoint[];
  /** Parse errors encountered */
  parseErrors: ParseError[];
}

/**
 * Quick scan result for fast file checking
 */
export interface QuickScanResult {
  /** Whether file contains Spring annotations */
  hasSpringAnnotations: boolean;
  /** Whether file has bean definitions */
  hasDefinitions: boolean;
  /** Whether file has injection points */
  hasInjections: boolean;
}

/**
 * Java parser interface
 */
export interface IJavaParser {
  /**
   * Parse a Java file
   * @param uri File URI
   * @returns Parse result with beans and injection points
   */
  parseFile(uri: vscode.Uri): Promise<ParseResult>;

  /**
   * Quick scan to check if file has Spring annotations
   * @param uri File URI
   * @returns Quick scan result
   */
  quickScan(uri: vscode.Uri): Promise<QuickScanResult>;
}

/**
 * Java parser implementation using java-parser library
 */
export class JavaParser implements IJavaParser {
  /**
   * Parse a Java file
   * @param uri File URI
   * @returns Parse result
   */
  async parseFile(uri: vscode.Uri): Promise<ParseResult> {
    const result: ParseResult = {
      definitions: [],
      injectionPoints: [],
      parseErrors: []
    };

    try {
      // Read file content
      const content = await this.readFile(uri);
      if (!content) {
        result.parseErrors.push({
          message: 'File is empty or cannot be read',
          line: 0,
          column: 0,
          severity: 'error'
        });
        return result;
      }

      // Parse Java code
      const cst = await this.parseJava(content);
      if (!cst) {
        result.parseErrors.push({
          message: 'Failed to parse Java file',
          line: 0,
          column: 0,
          severity: 'error'
        });
        return result;
      }

      // Store CST for use by annotation scanner and metadata extractor
      // They will be called separately to extract beans and injections
      // This method returns the raw parse result

    } catch (error) {
      result.parseErrors.push({
        message: `Parse error: ${error}`,
        line: 0,
        column: 0,
        severity: 'error'
      });
    }

    return result;
  }

  /**
   * Quick scan a file for Spring annotations
   * @param uri File URI
   * @returns Quick scan result
   */
  async quickScan(uri: vscode.Uri): Promise<QuickScanResult> {
    const result: QuickScanResult = {
      hasSpringAnnotations: false,
      hasDefinitions: false,
      hasInjections: false
    };

    try {
      const content = await this.readFile(uri);
      if (!content) {
        return result;
      }

      // Quick regex-based scan (faster than full parse)
      const springAnnotationPattern = /@(Component|Service|Repository|Controller|RestController|Configuration|Bean|Autowired|Resource|Inject|Qualifier)/;
      result.hasSpringAnnotations = springAnnotationPattern.test(content);

      // Check for bean definitions
      const beanDefPattern = /@(Component|Service|Repository|Controller|RestController|Configuration|Bean)\s/;
      result.hasDefinitions = beanDefPattern.test(content);

      // Check for injection points
      const injectionPattern = /@(Autowired|Resource|Inject)\s/;
      result.hasInjections = injectionPattern.test(content);

    } catch (error) {
      // Silently fail for quick scan
    }

    return result;
  }

  /**
   * Parse Java content using java-parser
   * @param content Java source code
   * @returns CST or undefined on error
   */
  async parseJava(content: string): Promise<any | undefined> {
    try {
      const { parse } = await import('java-parser');
      const cst = parse(content);
      return cst;
    } catch (error) {
      console.error('[JavaParser] Parse error:', error);
      return undefined;
    }
  }

  /**
   * Read file content
   * @param uri File URI
   * @returns File content or empty string
   */
  private async readFile(uri: vscode.Uri): Promise<string> {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      return document.getText();
    } catch (error) {
      console.error(`[JavaParser] Failed to read file ${uri.fsPath}:`, error);
      return '';
    }
  }

  /**
   * Get CST from file for external processing
   * This is used by AnnotationScanner and BeanMetadataExtractor
   * @param uri File URI
   * @returns CST or undefined
   */
  async getCST(uri: vscode.Uri): Promise<any | undefined> {
    try {
      const content = await this.readFile(uri);
      if (!content) {
        return undefined;
      }
      return await this.parseJava(content);
    } catch (error) {
      console.error(`[JavaParser] Failed to get CST for ${uri.fsPath}:`, error);
      return undefined;
    }
  }
}
