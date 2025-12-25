/**
 * Represents the location of a Bean definition or injection point in source code
 */

import * as vscode from 'vscode';

/**
 * Bean location interface
 */
export interface BeanLocation {
  /** File URI */
  uri: vscode.Uri;
  /** Line number (0-indexed) */
  line: number;
  /** Column number (0-indexed) */
  column: number;
  /** Optional end line for range highlighting */
  endLine?: number;
  /** Optional end column for range highlighting */
  endColumn?: number;
}

/**
 * Utility functions for BeanLocation
 */
export namespace BeanLocation {
  /**
   * Convert BeanLocation to VS Code Location
   * @param location Bean location
   * @returns VS Code Location instance
   */
  export function toVSCodeLocation(location: BeanLocation): vscode.Location {
    return new vscode.Location(location.uri, toVSCodeRange(location));
  }

  /**
   * Convert BeanLocation to VS Code Range
   * @param location Bean location
   * @returns VS Code Range instance
   */
  export function toVSCodeRange(location: BeanLocation): vscode.Range {
    const startPos = new vscode.Position(location.line, location.column);
    const endPos = new vscode.Position(
      location.endLine !== undefined ? location.endLine : location.line,
      location.endColumn !== undefined ? location.endColumn : location.column
    );
    return new vscode.Range(startPos, endPos);
  }

  /**
   * Convert BeanLocation to VS Code Position
   * @param location Bean location
   * @returns VS Code Position instance
   */
  export function toVSCodePosition(location: BeanLocation): vscode.Position {
    return new vscode.Position(location.line, location.column);
  }

  /**
   * Create BeanLocation from VS Code Position and URI
   * @param uri File URI
   * @param position VS Code Position
   * @returns BeanLocation instance
   */
  export function fromVSCodePosition(uri: vscode.Uri, position: vscode.Position): BeanLocation {
    return {
      uri,
      line: position.line,
      column: position.character
    };
  }

  /**
   * Create BeanLocation from VS Code Range and URI
   * @param uri File URI
   * @param range VS Code Range
   * @returns BeanLocation instance
   */
  export function fromVSCodeRange(uri: vscode.Uri, range: vscode.Range): BeanLocation {
    return {
      uri,
      line: range.start.line,
      column: range.start.character,
      endLine: range.end.line,
      endColumn: range.end.character
    };
  }
}
