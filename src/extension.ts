// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { BeanIndexer } from './indexer/beanIndexer';
import { SpringBeanCodeLensProvider } from './providers/beanCodeLensProvider';
import { BeanResolver } from './resolver/beanResolver';
import { BeanInjectionPoint } from './models/BeanInjectionPoint';
import { BeanLocation } from './models/BeanLocation';
import { BeanDefinition } from './models/BeanDefinition';
import { BeanCandidate } from './models/BeanCandidate';
import { MatchReason } from './models/types';
import { ProjectDetector } from './utils/projectDetector';

let beanIndexer: BeanIndexer | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	console.log('[Spring Bean Navigation] Extension activating...');

	// Check if we have workspace folders
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders || workspaceFolders.length === 0) {
		console.log('[Spring Bean Navigation] No workspace folders found, skipping setup');
		return;
	}

	// Detect Spring Boot projects
	const projectDetector = new ProjectDetector();
	let hasSpringProject = false;

	for (const folder of workspaceFolders) {
		if (await projectDetector.isSpringProject(folder)) {
			hasSpringProject = true;
			console.log(`[Spring Bean Navigation] Spring Boot project detected in ${folder.name}`);
			break;
		}
	}

	if (!hasSpringProject) {
		console.log('[Spring Bean Navigation] No Spring Boot projects detected, skipping Bean indexing');
		return;
	}

	// Initialize Bean Indexer
	console.log('[Spring Bean Navigation] Initializing Bean Indexer...');
	beanIndexer = new BeanIndexer();
	await beanIndexer.initialize(context, Array.from(workspaceFolders));

	// Try to load cached index
	const cacheLoaded = await beanIndexer.loadFromPersistentStorage();
	if (!cacheLoaded) {
		// Build full index in background
		console.log('[Spring Bean Navigation] Building Bean index...');
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Spring Bean Navigation',
			cancellable: false
		}, async (progress) => {
			progress.report({ message: 'Indexing Spring Beans...' });
			const count = await beanIndexer!.buildFullIndex(true);
			console.log(`[Spring Bean Navigation] Indexed ${count} Spring Beans`);
			return;
		});
	} else {
		const stats = beanIndexer.getStats();
		console.log(`[Spring Bean Navigation] Loaded ${stats.totalBeans} beans from cache`);
	}

	// Register CodeLens Provider for Java files
	const codeLensProvider = new SpringBeanCodeLensProvider(beanIndexer);
	const codeLensDisposable = vscode.languages.registerCodeLensProvider(
		{ language: 'java', scheme: 'file' },
		codeLensProvider
	);
	context.subscriptions.push(codeLensDisposable);
	console.log('[Spring Bean Navigation] CodeLens Provider registered for Java files');

	// Register command for navigating to bean definition (triggered by CodeLens)
	const navigateToBeanCommand = vscode.commands.registerCommand(
		'spring-bean-navigation.navigateToBean',
		async (injection: BeanInjectionPoint, preResolvedBeans?: BeanDefinition[]) => {
			try {
				// Get bean index
				const index = beanIndexer!.getIndex();

				let candidates: BeanCandidate[];

				// Check if beans were pre-resolved by CodeLensProvider (for interface types)
				if (preResolvedBeans && preResolvedBeans.length > 0) {
					// Use pre-resolved beans directly (already resolved by InterfaceResolver)
					candidates = preResolvedBeans.map(bean => BeanCandidate.create(bean, MatchReason.TYPE_MATCH));
				} else {
					// Resolve bean candidates using BeanResolver
					const resolver = new BeanResolver();
					candidates = resolver.resolve(injection, index);
				}

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
				console.error('[Spring Bean Navigation] Error navigating to bean:', error);
				vscode.window.showErrorMessage('Failed to navigate to bean definition');
			}
		}
	);
	context.subscriptions.push(navigateToBeanCommand);

	// Register command for manual index rebuild
	const rebuildCommand = vscode.commands.registerCommand('spring-bean-navigation.rebuildIndex', async () => {
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

	console.log('[Spring Bean Navigation] Extension activated successfully');
}

// This method is called when your extension is deactivated
export function deactivate() {}
