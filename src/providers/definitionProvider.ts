/**
 * Definition Provider for Spring Bean navigation
 * Provides "Go to Definition" functionality for @Autowired/@Resource fields
 */

import * as vscode from 'vscode';
import { BeanIndexer } from '../indexer/beanIndexer';
import { BeanResolver } from '../resolver/beanResolver';
import { BeanInjectionPoint } from '../models/BeanInjectionPoint';
import { InjectionType } from '../models/types';
import { BeanLocation } from '../models/BeanLocation';

/**
 * Definition provider for Spring Bean injection points
 */
export class SpringBeanDefinitionProvider implements vscode.DefinitionProvider {
  private indexer: BeanIndexer;
  private resolver: BeanResolver;

  constructor(indexer: BeanIndexer) {
    this.indexer = indexer;
    this.resolver = new BeanResolver();
  }

  /**
   * Provide definition for a symbol at given position
   * @param document Text document
   * @param position Cursor position
   * @param token Cancellation token
   * @returns Definition location(s) or undefined
   */
  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Definition | vscode.LocationLink[] | undefined> {
    try {
      // Extract injection point from current position
      const injection = await this.extractInjectionPoint(document, position);
      if (!injection) {
        return undefined;
      }

      // Get bean index
      const index = this.indexer.getIndex();

      // Resolve bean candidates
      const candidates = this.resolver.resolve(injection, index);

      if (candidates.length === 0) {
        // No beans found
        this.showNoBeanFoundError(injection);
        return undefined;
      }

      if (candidates.length === 1) {
        // Single candidate - direct navigation
        const location = BeanLocation.toVSCodeLocation(candidates[0].beanDefinition.location);
        return location;
      }

      // Multiple candidates - show Quick Pick
      const selected = await this.showCandidateQuickPick(candidates);
      if (selected) {
        const location = BeanLocation.toVSCodeLocation(selected.beanDefinition.location);
        return location;
      }

      return undefined;
    } catch (error) {
      console.error('[DefinitionProvider] Error providing definition:', error);
      return undefined;
    }
  }

  /**
   * Extract injection point from document position
   * @param document Text document
   * @param position Cursor position
   * @returns Injection point or undefined
   */
  private async extractInjectionPoint(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<BeanInjectionPoint | undefined> {
    try {
      const line = document.lineAt(position.line);
      const text = line.text;

      // Try constructor parameter first
      const constructorInfo = this.extractConstructorParameterInfo(document, position);
      if (constructorInfo) {
        return constructorInfo;
      }

      // Check if cursor is on a field with injection annotation
      const fieldInfo = this.extractFieldInfo(text, position.character);
      if (!fieldInfo) {
        return undefined;
      }

      // Check for injection annotation in previous lines
      const injectionAnnotation = this.findInjectionAnnotation(document, position.line);
      if (!injectionAnnotation) {
        return undefined;
      }

      // Create injection point
      const injection: BeanInjectionPoint = {
        injectionType: InjectionType.FIELD,
        beanType: fieldInfo.type,
        location: BeanLocation.fromVSCodePosition(document.uri, position),
        isRequired: true,
        fieldName: fieldInfo.name,
        qualifier: injectionAnnotation.qualifier,
        beanName: injectionAnnotation.beanName
      };

      return injection;
    } catch (error) {
      console.error('[DefinitionProvider] Error extracting injection point:', error);
      return undefined;
    }
  }

  /**
   * Extract constructor parameter information from document position
   * @param document Text document
   * @param position Cursor position
   * @returns Constructor injection point or undefined
   */
  private extractConstructorParameterInfo(
    document: vscode.TextDocument,
    position: vscode.Position
  ): BeanInjectionPoint | undefined {
    try {
      const line = document.lineAt(position.line);
      const text = line.text;

      // Check if we're in a constructor parameter context
      // Pattern: ClassName(Type paramName, ...) or multi-line constructor
      if (!text.includes('(') && !text.includes(',') && !text.includes(')')) {
        return undefined;
      }

      // Find constructor declaration by searching upward
      const constructorInfo = this.findConstructorDeclaration(document, position.line);
      if (!constructorInfo) {
        return undefined;
      }

      // Parse all parameters from the constructor
      const parameters = this.parseConstructorParameters(document, constructorInfo.startLine, constructorInfo.endLine);
      if (parameters.length === 0) {
        return undefined;
      }

      // Find which parameter the cursor is on
      const currentParam = this.findParameterAtPosition(parameters, position);
      if (!currentParam) {
        return undefined;
      }

      // Check for @Qualifier annotation on this parameter
      const qualifier = this.findParameterQualifier(document, currentParam.line);

      // Create constructor injection point
      const injection: BeanInjectionPoint = {
        injectionType: InjectionType.CONSTRUCTOR,
        beanType: currentParam.type,
        location: BeanLocation.fromVSCodePosition(document.uri, position),
        isRequired: true,
        parameterName: currentParam.name,
        parameterIndex: currentParam.index,
        qualifier
      };

      return injection;
    } catch (error) {
      console.error('[DefinitionProvider] Error extracting constructor parameter:', error);
      return undefined;
    }
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
  ): Array<{ type: string; name: string; index: number; line: number; charStart: number; charEnd: number }> {
    const parameters: Array<{ type: string; name: string; index: number; line: number; charStart: number; charEnd: number }> = [];

    // Collect all text from startLine to endLine
    let fullText = '';
    for (let i = startLine; i <= endLine; i++) {
      fullText += document.lineAt(i).text + '\n';
    }

    // Extract content between first '(' and last ')'
    const paramStart = fullText.indexOf('(');
    const paramEnd = fullText.lastIndexOf(')');
    if (paramStart === -1 || paramEnd === -1) {
      return parameters;
    }

    const paramText = fullText.substring(paramStart + 1, paramEnd);

    // Pattern to match parameters: Type paramName
    // Supports fully qualified names like com.example.Service
    const paramPattern = /([\w.]+)\s+(\w+)\s*[,)]/g;
    let match;
    let index = 0;

    while ((match = paramPattern.exec(paramText)) !== null) {
      const type = match[1];
      const name = match[2];

      // Find the line and character position for this parameter
      const namePosition = match.index + match[1].length + 1; // After type and space
      let currentPos = 0;
      let foundLine = startLine;
      let charStart = 0;

      for (let i = startLine; i <= endLine; i++) {
        const lineText = document.lineAt(i).text;
        const lineLength = lineText.length + 1; // +1 for newline

        if (currentPos + lineLength > paramStart + 1 + namePosition) {
          foundLine = i;
          charStart = namePosition - (currentPos - paramStart - 1);
          break;
        }

        currentPos += lineLength;
      }

      parameters.push({
        type,
        name,
        index,
        line: foundLine,
        charStart,
        charEnd: charStart + name.length
      });

      index++;
    }

    return parameters;
  }

  /**
   * Find which parameter the cursor is currently on
   * @param parameters Parsed parameters
   * @param position Cursor position
   * @returns Parameter info or undefined
   */
  private findParameterAtPosition(
    parameters: Array<{ type: string; name: string; index: number; line: number; charStart: number; charEnd: number }>,
    position: vscode.Position
  ): { type: string; name: string; index: number; line: number } | undefined {
    for (const param of parameters) {
      if (param.line === position.line) {
        // Check if cursor is on the parameter name
        if (position.character >= param.charStart && position.character <= param.charEnd) {
          return param;
        }
      }
    }

    return undefined;
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
   * Extract field information from line text
   * @param text Line text
   * @param cursorChar Cursor character position
   * @returns Field info or undefined
   */
  private extractFieldInfo(text: string, cursorChar: number): { name: string; type: string } | undefined {
    // Pattern: private/public Type fieldName;
    // Example: private UserService userService;
    const fieldPattern = /(private|public|protected)\s+([\w.]+)\s+(\w+)\s*;?/;
    const match = text.match(fieldPattern);

    if (!match) {
      return undefined;
    }

    const type = match[2];
    const name = match[3];

    // Check if cursor is on the field name
    const nameIndex = text.indexOf(name, text.indexOf(type));
    if (cursorChar >= nameIndex && cursorChar <= nameIndex + name.length) {
      return { name, type };
    }

    return undefined;
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

      // Stop if we hit another field or class declaration
      if (line.includes('class ') || line.match(/(private|public|protected)\s+\w+\s+\w+/)) {
        break;
      }
    }

    return undefined;
  }

  /**
   * Show Quick Pick for multiple bean candidates
   * @param candidates Bean candidates
   * @returns Selected candidate or undefined
   */
  private async showCandidateQuickPick(candidates: any[]): Promise<any | undefined> {
    const items = candidates.map(candidate => ({
      label: candidate.displayLabel,
      description: candidate.displayDescription,
      detail: candidate.displayDetail,
      candidate
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Multiple beans found. Select one to navigate:',
      matchOnDescription: true,
      matchOnDetail: true
    });

    return selected?.candidate;
  }

  /**
   * Show error message when no bean is found
   * @param injection Injection point
   */
  private showNoBeanFoundError(injection: BeanInjectionPoint): void {
    const message = `No Spring Bean found for type: ${injection.beanType}. ` +
      `Please check your Spring configuration and ensure the bean is defined with @Component, @Service, @Repository, @Controller, or @Bean.`;

    vscode.window.showErrorMessage(message);
  }
}
