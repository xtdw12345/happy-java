/**
 * CodeLens Provider for Spring Bean navigation
 * Shows "go to bean definition" above injection points
 */

import * as vscode from 'vscode';
import { BeanIndexer } from '../indexer/beanIndexer';
import { BeanResolver } from '../resolver/beanResolver';
import { InterfaceResolver } from '../indexing/InterfaceResolver';
import { BeanInjectionPoint } from '../models/BeanInjectionPoint';
import { InjectionType, DisambiguationContext } from '../models/types';
import { BeanLocation } from '../models/BeanLocation';

/**
 * CodeLens provider for Spring Bean injection points
 */
export class SpringBeanCodeLensProvider implements vscode.CodeLensProvider {
  private indexer: BeanIndexer;
  private resolver: BeanResolver;
  private interfaceResolver: InterfaceResolver;

  constructor(indexer: BeanIndexer) {
    this.indexer = indexer;
    this.resolver = new BeanResolver();
    this.interfaceResolver = new InterfaceResolver();
  }

  /**
   * Provide CodeLens for a document
   * @param document Text document
   * @param token Cancellation token
   * @returns Array of CodeLens
   */
  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];

    try {
      // Scan document for injection points
      const injectionPoints = await this.findInjectionPoints(document);

      for (const injection of injectionPoints) {

        // Get bean index and interface registry
        const index = this.indexer.getIndex();
        const interfaceRegistry = this.indexer.getInterfaceRegistry();

        // Check if injection type is an interface
        const isInterface = interfaceRegistry.hasInterface(injection.beanType);

        let codeLens: vscode.CodeLens | undefined;

        if (isInterface) {
          // Use interface resolution
          codeLens = this.resolveInterfaceInjection(injection, interfaceRegistry);
        } else {
          // Use normal bean resolution
          const candidates = this.resolver.resolve(injection, index);

          if (candidates.length > 0) {
            const range = new vscode.Range(
              injection.location.line,
              0,
              injection.location.line,
              0
            );

            const command: vscode.Command = {
              title: candidates.length === 1
                ? '→ go to bean definition'
                : `→ go to bean definition (${candidates.length} candidates)`,
              command: 'spring-bean-navigation.navigateToBean',
              arguments: [injection]
            };

            codeLens = new vscode.CodeLens(range, command);
          }
        }

        if (codeLens) {
          codeLenses.push(codeLens);
        }
      }

      console.log(`[CodeLensProvider] Returning ${codeLenses.length} CodeLenses`);
    } catch (error) {
      console.error('[CodeLensProvider] Error providing code lenses:', error);
    }

    return codeLenses;
  }

  /**
   * Find all injection points in a document
   * @param document Text document
   * @returns Array of injection points
   */
  private async findInjectionPoints(
    document: vscode.TextDocument
  ): Promise<BeanInjectionPoint[]> {
    const injectionPoints: BeanInjectionPoint[] = [];

    // PHASE 1: Query BeanIndexer for pre-extracted injection points
    // This includes Lombok-generated injections (InjectionType.LOMBOK_CONSTRUCTOR)
    const beanIndex = this.indexer.getIndex();
    const indexedInjections = beanIndex.getInjectionPointsForUri(document.uri);

    if (indexedInjections.length > 0) {
      console.log(`[CodeLensProvider] Found ${indexedInjections.length} pre-extracted injection points from BeanIndexer`);
      injectionPoints.push(...indexedInjections);
    }

    // PHASE 2: Fallback to manual parsing for backward compatibility
    // This handles cases where BeanIndexer hasn't indexed the file yet
    const manualInjections = await this.extractManualInjectionPoints(document);
    if (manualInjections.length > 0) {
      console.log(`[CodeLensProvider] Found ${manualInjections.length} injection points from manual parsing`);
      // Deduplicate: only add manual injections that aren't already in indexedInjections
      for (const manual of manualInjections) {
        const isDuplicate = indexedInjections.some(indexed =>
          indexed.location.line === manual.location.line &&
          indexed.beanType === manual.beanType
        );
        if (!isDuplicate) {
          injectionPoints.push(manual);
        }
      }
    }

    return injectionPoints;
  }

  /**
   * Extract injection points manually from document (fallback method)
   * @param document Text document
   * @returns Array of injection points
   */
  private async extractManualInjectionPoints(
    document: vscode.TextDocument
  ): Promise<BeanInjectionPoint[]> {
    const injectionPoints: BeanInjectionPoint[] = [];

    // Scan each line for injection points
    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const line = document.lineAt(lineNum);
      const text = line.text;

      // Check for field injection
      const fieldInjection = this.extractFieldInjectionPoint(document, lineNum);
      if (fieldInjection) {
        injectionPoints.push(fieldInjection);
      }

      // Check for constructor parameter injection
      const constructorInjection = this.extractConstructorParameterAtLine(document, lineNum);
      if (constructorInjection) {
        injectionPoints.push(constructorInjection);
      }
    }

    return injectionPoints;
  }

  /**
   * Extract field injection point from a line
   * @param document Text document
   * @param lineNumber Line number
   * @returns Injection point or undefined
   */
  private extractFieldInjectionPoint(
    document: vscode.TextDocument,
    lineNumber: number
  ): BeanInjectionPoint | undefined {
    try {
      const line = document.lineAt(lineNumber);
      const text = line.text;

      // Pattern: private/public Type fieldName;
      const fieldPattern = /(private|public|protected)(\s+final)?\s+([\w.]+)\s+(\w+)\s*;/;
      const match = text.match(fieldPattern);

      if (!match) {
        return undefined;
      }

      const type = match[3];
      const name = match[4];

      console.log(`[CodeLensProvider] Found field at line ${lineNumber}: ${type} ${name}`);

      // Check for injection annotation in previous lines
      const injectionAnnotation = this.findInjectionAnnotation(document, lineNumber);
      if (!injectionAnnotation) {
        console.log(`[CodeLensProvider] No injection annotation found for field ${name} at line ${lineNumber}`);
        return undefined;
      }

      console.log(`[CodeLensProvider] Found injection annotation: ${injectionAnnotation.type}`);

      // Create injection point
      const injection: BeanInjectionPoint = {
        injectionType: InjectionType.FIELD,
        beanType: type,
        location: BeanLocation.fromVSCodePosition(document.uri, new vscode.Position(lineNumber, 0)),
        isRequired: true,
        fieldName: name,
        qualifier: injectionAnnotation.qualifier,
        beanName: injectionAnnotation.beanName
      };

      return injection;
    } catch (error) {
      console.error(`[CodeLensProvider] Error extracting field injection at line ${lineNumber}:`, error);
      return undefined;
    }
  }

  /**
   * Extract constructor parameter injection at a specific line
   * @param document Text document
   * @param lineNumber Line number
   * @returns Injection point or undefined
   */
  private extractConstructorParameterAtLine(
    document: vscode.TextDocument,
    lineNumber: number
  ): BeanInjectionPoint | undefined {
    try {
      const line = document.lineAt(lineNumber);
      const text = line.text.trim();

      // Skip if not a constructor parameter line
      if (!text.includes('(') && !text.match(/([\w.]+)\s+(\w+)[,)]/)) {
        return undefined;
      }

      // Check if we're in a constructor context
      const constructorInfo = this.findConstructorDeclaration(document, lineNumber);
      if (!constructorInfo) {
        return undefined;
      }

      // Parse parameters
      const parameters = this.parseConstructorParameters(document, constructorInfo.startLine, constructorInfo.endLine);

      // Find parameter at this line
      const param = parameters.find(p => p.line === lineNumber);
      if (!param) {
        return undefined;
      }

      // Check for @Qualifier annotation
      const qualifier = this.findParameterQualifier(document, lineNumber);

      // Create injection point
      const injection: BeanInjectionPoint = {
        injectionType: InjectionType.CONSTRUCTOR,
        beanType: param.type,
        location: BeanLocation.fromVSCodePosition(document.uri, new vscode.Position(lineNumber, 0)),
        isRequired: true,
        parameterName: param.name,
        parameterIndex: param.index,
        qualifier
      };

      return injection;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Find injection annotation before field declaration
   * @param document Text document
   * @param lineNumber Field line number
   * @returns Injection annotation info or undefined
   */
  private findInjectionAnnotation(
    document: vscode.TextDocument,
    lineNumber: number
  ): { type: string; qualifier?: string; beanName?: string } | undefined {
    // Check previous lines for @Autowired, @Resource, @Inject
    for (let i = lineNumber - 1; i >= Math.max(0, lineNumber - 5); i--) {
      const line = document.lineAt(i).text.trim();

      // @Autowired
      if (line.includes('@Autowired')) {
        return { type: 'Autowired' };
      }

      // @Resource(name="beanName")
      const resourceMatch = line.match(/@Resource\s*\(\s*name\s*=\s*"(\w+)"\s*\)/);
      if (resourceMatch) {
        return { type: 'Resource', beanName: resourceMatch[1] };
      }
      if (line.includes('@Resource')) {
        return { type: 'Resource' };
      }

      // @Inject
      if (line.includes('@Inject')) {
        return { type: 'Inject' };
      }

      // @Qualifier("value")
      const qualifierMatch = line.match(/@Qualifier\s*\(\s*"(\w+)"\s*\)/);
      if (qualifierMatch) {
        return { type: 'Qualifier', qualifier: qualifierMatch[1] };
      }

      if (line.includes("@NonNull")) {
        return { type: 'NonNull'};
      }

      // Stop if we hit another field or class declaration
      if (line.includes('class ') || line.match(/(private|public|protected)\s+\w+\s+\w+/)) {
        break;
      }
    }

    return undefined;
  }

  /**
   * Find constructor declaration containing the given line
   * @param document Text document
   * @param lineNumber Current line number
   * @returns Constructor info or undefined
   */
  private findConstructorDeclaration(
    document: vscode.TextDocument,
    lineNumber: number
  ): { startLine: number; endLine: number; className: string } | undefined {
    // Search upward for constructor signature
    let startLine = lineNumber;
    let foundConstructor = false;
    let className = '';

    // First, find the class name by searching upward
    for (let i = lineNumber; i >= Math.max(0, lineNumber - 50); i--) {
      const line = document.lineAt(i).text.trim();
      const classMatch = line.match(/class\s+(\w+)/);
      if (classMatch) {
        className = classMatch[1];
        break;
      }
    }

    if (!className) {
      return undefined;
    }

    // Find constructor signature (looks for "ClassName(" pattern)
    for (let i = lineNumber; i >= Math.max(0, lineNumber - 20); i--) {
      const line = document.lineAt(i).text;
      if (line.includes(className + '(')) {
        startLine = i;
        foundConstructor = true;
        break;
      }
    }

    if (!foundConstructor) {
      return undefined;
    }

    // Find end of constructor parameters (closing parenthesis)
    let endLine = startLine;
    for (let i = startLine; i <= Math.min(document.lineCount - 1, startLine + 20); i++) {
      const line = document.lineAt(i).text;
      if (line.includes(')')) {
        endLine = i;
        break;
      }
    }

    return { startLine, endLine, className };
  }

  /**
   * Parse all parameters from constructor declaration
   * @param document Text document
   * @param startLine Constructor start line
   * @param endLine Constructor end line
   * @returns Array of parameter info
   */
  private parseConstructorParameters(
    document: vscode.TextDocument,
    startLine: number,
    endLine: number
  ): Array<{ type: string; name: string; index: number; line: number }> {
    const parameters: Array<{ type: string; name: string; index: number; line: number }> = [];

    // Collect all text from startLine to endLine
    let fullText = '';
    const lineStarts: number[] = [0];

    for (let i = startLine; i <= endLine; i++) {
      const lineText = document.lineAt(i).text;
      fullText += lineText + '\n';
      if (i < endLine) {
        lineStarts.push(fullText.length);
      }
    }

    // Extract content between first '(' and last ')'
    const paramStart = fullText.indexOf('(');
    const paramEnd = fullText.lastIndexOf(')');
    if (paramStart === -1 || paramEnd === -1) {
      return parameters;
    }

    const paramText = fullText.substring(paramStart + 1, paramEnd);

    // Pattern to match parameters: Type paramName
    const paramPattern = /([\w.]+)\s+(\w+)\s*[,)]/g;
    let match;
    let index = 0;

    while ((match = paramPattern.exec(paramText)) !== null) {
      const type = match[1];
      const name = match[2];

      // Find which line this parameter is on
      const namePosition = paramStart + 1 + match.index + match[1].length + 1;
      let foundLine = startLine;

      for (let i = 0; i < lineStarts.length; i++) {
        if (namePosition >= lineStarts[i] &&
            (i === lineStarts.length - 1 || namePosition < lineStarts[i + 1])) {
          foundLine = startLine + i;
          break;
        }
      }

      parameters.push({
        type,
        name,
        index,
        line: foundLine
      });

      index++;
    }

    return parameters;
  }

  /**
   * Find @Qualifier annotation for a constructor parameter
   * @param document Text document
   * @param paramLine Parameter line number
   * @returns Qualifier value or undefined
   */
  private findParameterQualifier(
    document: vscode.TextDocument,
    paramLine: number
  ): string | undefined {
    // Check same line and previous line for @Qualifier
    for (let i = paramLine; i >= Math.max(0, paramLine - 1); i--) {
      const line = document.lineAt(i).text;
      const qualifierMatch = line.match(/@Qualifier\s*\(\s*"(\w+)"\s*\)/);
      if (qualifierMatch) {
        return qualifierMatch[1];
      }
    }

    return undefined;
  }

  /**
   * Resolve interface injection and create CodeLens
   * @param injection Injection point
   * @param interfaceRegistry Interface registry
   * @returns CodeLens or undefined
   */
  private resolveInterfaceInjection(
    injection: BeanInjectionPoint,
    interfaceRegistry: import('../indexing/InterfaceRegistry').InterfaceRegistry
  ): vscode.CodeLens | undefined {
    // Get all implementations for this interface
    const implementations = interfaceRegistry.getImplementations(injection.beanType);
    console.log(`[CodeLensProvider] Interface ${injection.beanType} has ${implementations.length} implementations`);

    if (implementations.length === 0) {
      // No implementations found
      return this.createErrorCodeLens(injection, 'No implementations found');
    }

    // Get the actual FQN for the interface (supports simple name lookup)
    const interfaceFQN = interfaceRegistry.findInterfaceFQN(injection.beanType) || injection.beanType;

    // Create disambiguation context
    const context: DisambiguationContext = {
      interfaceFQN: interfaceFQN,
      rawType: injection.beanType.split('.').pop() || injection.beanType,
      qualifier: injection.qualifier,
      candidates: implementations,
      injectionLocation: injection.location
    };

    // Resolve using InterfaceResolver
    const result = this.interfaceResolver.resolve(context);
    console.log(`[CodeLensProvider] Interface resolution result: ${result.status}`);

    return this.createCodeLensFromResult(injection, result);
  }

  /**
   * Create CodeLens from InterfaceResolutionResult
   * @param injection Injection point
   * @param result Resolution result
   * @returns CodeLens or undefined
   */
  private createCodeLensFromResult(
    injection: BeanInjectionPoint,
    result: import('../models/types').InterfaceResolutionResult
  ): vscode.CodeLens | undefined {
    const range = new vscode.Range(
      injection.location.line,
      0,
      injection.location.line,
      0
    );

    let title: string;
    let command: vscode.Command;

    switch (result.status) {
      case 'single':
        title = `→ ${result.bean.name}`;
        command = {
          title,
          command: 'spring-bean-navigation.navigateToBean',
          arguments: [injection, [result.bean]]
        };
        break;

      case 'primary':
        title = `→ ${result.bean.name} (@Primary)`;
        command = {
          title,
          command: 'spring-bean-navigation.navigateToBean',
          arguments: [injection, [result.bean]]
        };
        break;

      case 'qualified':
        title = `→ ${result.bean.name} (@Qualifier)`;
        command = {
          title,
          command: 'spring-bean-navigation.navigateToBean',
          arguments: [injection, [result.bean]]
        };
        break;

      case 'multiple':
        title = `→ ${result.candidates.length} implementations (choose one)`;
        command = {
          title,
          command: 'spring-bean-navigation.navigateToBean',
          arguments: [injection, result.candidates]
        };
        break;

      case 'none':
        return this.createErrorCodeLens(injection, 'No matching implementations');

      default:
        return undefined;
    }

    return new vscode.CodeLens(range, command);
  }

  /**
   * Create error CodeLens for unresolved interfaces
   * @param injection Injection point
   * @param message Error message
   * @returns CodeLens
   */
  private createErrorCodeLens(
    injection: BeanInjectionPoint,
    message: string
  ): vscode.CodeLens {
    const range = new vscode.Range(
      injection.location.line,
      0,
      injection.location.line,
      0
    );

    const command: vscode.Command = {
      title: `⚠ ${message}`,
      command: 'spring-bean-navigation.showMessage',
      arguments: [message]
    };

    return new vscode.CodeLens(range, command);
  }
}
