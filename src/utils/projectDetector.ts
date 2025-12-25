/**
 * Project detector - detects Spring Boot projects
 */

import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Project detector for Spring Boot projects
 */
export class ProjectDetector {
  /**
   * Check if workspace folder contains a Spring Boot project
   * @param folder Workspace folder
   * @returns True if Spring Boot project detected
   */
  async isSpringProject(folder: vscode.WorkspaceFolder): Promise<boolean> {
    // Check for Maven pom.xml with Spring Boot dependency
    if (await this.hasMavenSpring(folder)) {
      return true;
    }

    // Check for Gradle build file with Spring Boot
    if (await this.hasGradleSpring(folder)) {
      return true;
    }

    // Check for Spring annotations in Java files
    if (await this.hasSpringAnnotations(folder)) {
      return true;
    }

    return false;
  }

  /**
   * Check for Maven Spring Boot project
   * @param folder Workspace folder
   * @returns True if Maven Spring Boot project
   */
  private async hasMavenSpring(folder: vscode.WorkspaceFolder): Promise<boolean> {
    const pomPath = path.join(folder.uri.fsPath, 'pom.xml');
    try {
      const pomUri = vscode.Uri.file(pomPath);
      const document = await vscode.workspace.openTextDocument(pomUri);
      const content = document.getText();
      return content.includes('spring-boot') || content.includes('org.springframework');
    } catch (error) {
      return false;
    }
  }

  /**
   * Check for Gradle Spring Boot project
   * @param folder Workspace folder
   * @returns True if Gradle Spring Boot project
   */
  private async hasGradleSpring(folder: vscode.WorkspaceFolder): Promise<boolean> {
    const gradlePath = path.join(folder.uri.fsPath, 'build.gradle');
    try {
      const gradleUri = vscode.Uri.file(gradlePath);
      const document = await vscode.workspace.openTextDocument(gradleUri);
      const content = document.getText();
      return content.includes('spring-boot') || content.includes('org.springframework');
    } catch (error) {
      return false;
    }
  }

  /**
   * Check for Spring annotations in Java files
   * @param folder Workspace folder
   * @returns True if Spring annotations found
   */
  private async hasSpringAnnotations(folder: vscode.WorkspaceFolder): Promise<boolean> {
    try {
      const pattern = new vscode.RelativePattern(folder, '**/*.java');
      const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 10);

      for (const file of files) {
        const document = await vscode.workspace.openTextDocument(file);
        const content = document.getText();
        if (this.hasSpringAnnotationsInContent(content)) {
          return true;
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return false;
  }

  /**
   * Check if content has Spring annotations
   * @param content Java file content
   * @returns True if Spring annotations found
   */
  private hasSpringAnnotationsInContent(content: string): boolean {
    const springAnnotations = [
      '@SpringBootApplication',
      '@Component',
      '@Service',
      '@Repository',
      '@Controller',
      '@RestController',
      '@Configuration',
      '@Bean',
      '@Autowired'
    ];

    for (const annotation of springAnnotations) {
      if (content.includes(annotation)) {
        return true;
      }
    }

    return false;
  }
}
