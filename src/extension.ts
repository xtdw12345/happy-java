// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { BeanIndexer } from './spring-bean-navigation/indexer/beanIndexer';
import { SpringBeanDefinitionProvider } from './spring-bean-navigation/providers/definitionProvider';
import { SpringBeanCodeLensProvider } from './spring-bean-navigation/providers/beanCodeLensProvider';
import { BeanResolver } from './spring-bean-navigation/resolver/beanResolver';
import { BeanInjectionPoint } from './spring-bean-navigation/models/BeanInjectionPoint';
import { BeanLocation } from './spring-bean-navigation/models/BeanLocation';
import { ProjectDetector } from './spring-bean-navigation/utils/projectDetector';

let beanIndexer: BeanIndexer | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	console.log('[Happy Java] Extension activating...');

	// Check if we have workspace folders
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		console.log('[Happy Java] No workspace folders found, skipping Spring Bean navigation setup');
		return;
	}

	// Detect Spring Boot projects
	const projectDetector = new ProjectDetector();
	let hasSpringProject = false;

	for (const folder of workspaceFolders) {
		if (await projectDetector.isSpringProject(folder)) {
			hasSpringProject = true;
			console.log(`[Happy Java] Spring Boot project detected in ${folder.name}`);
			break;
		}
	}

	if (!hasSpringProject) {
		console.log('[Happy Java] No Spring Boot projects detected, skipping Bean indexing');
		return;
	}

	// Initialize Bean Indexer
	console.log('[Happy Java] Initializing Bean Indexer...');
	beanIndexer = new BeanIndexer();
	await beanIndexer.initialize(context, Array.from(workspaceFolders));

	// Try to load cached index
	const cacheLoaded = await beanIndexer.loadFromPersistentStorage();
	if (!cacheLoaded) {
		// Build full index in background
		console.log('[Happy Java] Building Bean index...');
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Happy Java',
			cancellable: false
		}, async (progress) => {
			progress.report({ message: 'Indexing Spring Beans...' });
			const count = await beanIndexer!.buildFullIndex(true);
			console.log(`[Happy Java] Indexed ${count} Spring Beans`);
			return;
		});
	} else {
		const stats = beanIndexer.getStats();
		console.log(`[Happy Java] Loaded ${stats.totalBeans} beans from cache`);
	}

	// Register Definition Provider for Java files
	const definitionProvider = new SpringBeanDefinitionProvider(beanIndexer);
	const providerDisposable = vscode.languages.registerDefinitionProvider(
		{ language: 'java', scheme: 'file' },
		definitionProvider
	);
	context.subscriptions.push(providerDisposable);
	console.log('[Happy Java] Definition Provider registered for Java files');

	// Register CodeLens Provider for Java files
	const codeLensProvider = new SpringBeanCodeLensProvider(beanIndexer);
	const codeLensDisposable = vscode.languages.registerCodeLensProvider(
		{ language: 'java', scheme: 'file' },
		codeLensProvider
	);
	context.subscriptions.push(codeLensDisposable);
	console.log('[Happy Java] CodeLens Provider registered for Java files');

	// Register command for navigating to bean definition (triggered by CodeLens)
	const navigateToBeanCommand = vscode.commands.registerCommand(
		'happy-java.navigateToBean',
		async (injection: BeanInjectionPoint) => {
			try {
				// Get bean index
				const index = beanIndexer!.getIndex();

				// Resolve bean candidates
				const resolver = new BeanResolver();
				const candidates = resolver.resolve(injection, index);

				if (candidates.length === 0) {
					vscode.window.showWarningMessage(
						`No Spring Bean found for type: ${injection.beanType}`
					);
					return;
				}

				let selectedCandidate = candidates[0];

				if (candidates.length > 1) {
					// Show Quick Pick for multiple candidates
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

					if (!selected) {
						return;
					}

					selectedCandidate = selected.candidate;
				}

				// Navigate to bean definition
				const location = BeanLocation.toVSCodeLocation(selectedCandidate.beanDefinition.location);
				if (location) {
					await vscode.window.showTextDocument(location.uri, {
						selection: location.range
					});
				}
			} catch (error) {
				console.error('[Happy Java] Error navigating to bean:', error);
				vscode.window.showErrorMessage('Failed to navigate to bean definition');
			}
		}
	);
	context.subscriptions.push(navigateToBeanCommand);

	// Register command for manual index rebuild
	const rebuildCommand = vscode.commands.registerCommand('happy-java.rebuildIndex', async () => {
		if (beanIndexer) {
			vscode.window.showInformationMessage('Rebuilding Spring Bean index...');
			const count = await beanIndexer.buildFullIndex(true);
			vscode.window.showInformationMessage(`Indexed ${count} Spring Beans`);
		}
	});
	context.subscriptions.push(rebuildCommand);

	// Save index on deactivation
	context.subscriptions.push({
		dispose: async () => {
			if (beanIndexer) {
				await beanIndexer.saveToPersistentStorage();
				beanIndexer.dispose();
			}
		}
	});

	// Keep original hello command
	const disposable = vscode.commands.registerCommand('happy-java.happyJava', () => {
		vscode.window.showInformationMessage('Hello World from happy-java!');
	});
	context.subscriptions.push(disposable);

	console.log('[Happy Java] Extension activated successfully');
}

// This method is called when your extension is deactivated
export function deactivate() {}
