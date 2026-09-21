import {
	App,
	FuzzySuggestModal,
	Notice,
	Plugin,
} from "obsidian";

/** Minimal typing for the undocumented customCss API. */
interface CustomCssApi {
	snippets: string[];
	enabledSnippets: Set<string>;
	setCssEnabledStatus(snippetName: string, enabled: boolean): void;
	readSnippets?(): void;
	requestLoadSnippets?(): void;
}

function getCustomCss(app: App): CustomCssApi | null {
	const customCss = (app as unknown as { customCss?: CustomCssApi }).customCss;
	if (!customCss || !Array.isArray(customCss.snippets)) return null;
	return customCss;
}

function toCommandId(snippetName: string): string {
	return `toggle-snippet-${snippetName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "") || "snippet"}`;
}

class SnippetPickerModal extends FuzzySuggestModal<string> {
	plugin: SnippetCommandsPlugin;

	constructor(app: App, plugin: SnippetCommandsPlugin) {
		super(app);
		this.plugin = plugin;
		this.setPlaceholder("Type a snippet name to toggle…");
	}

	getItems(): string[] {
		return this.plugin.getSnippetNames();
	}

	getItemText(item: string): string {
		return `${this.plugin.isEnabled(item) ? "✓ " : "○ "}${item}`;
	}

	onChooseItem(item: string) {
		void this.plugin.toggleSnippet(item);
	}
}

export default class SnippetCommandsPlugin extends Plugin {
	/** Command ids currently registered for individual snippets (id -> snippet name). */
	private snippetCommandIds = new Map<string, string>();

	async onload() {
		// Global commands (always available).
		this.addCommand({
			id: "toggle-snippet-picker",
			name: "Toggle snippet…",
			callback: () => {
				if (this.getSnippetNames().length === 0) {
					new Notice("No CSS snippets found in .obsidian/snippets/");
					return;
				}
				new SnippetPickerModal(this.app, this).open();
			},
		});

		this.addCommand({
			id: "enable-all-snippets",
			name: "Enable all snippets",
			callback: () => void this.setAll(true),
		});

		this.addCommand({
			id: "disable-all-snippets",
			name: "Disable all snippets",
			callback: () => void this.setAll(false),
		});

		this.addCommand({
			id: "reload-snippet-commands",
			name: "Reload snippet list",
			callback: () => {
				this.refreshSnippetsFromDisk();
				this.registerSnippetCommands();
				new Notice(`Reloaded ${this.getSnippetNames().length} snippet(s)`);
			},
		});

		// (Re)register per-snippet commands once layout is ready —
		// customCss.snippets is only populated after vault load.
		this.app.workspace.onLayoutReady(() => {
			this.refreshSnippetsFromDisk();
			this.registerSnippetCommands();
		});

		// Keep the list fresh when snippet files are added/removed/renamed.
		this.registerEvent(
			this.app.vault.on("create", (file) => {
				if (file.path.includes("snippets/")) this.reregister();
			})
		);
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (file.path.includes("snippets/")) this.reregister();
			})
		);
		this.registerEvent(
			this.app.vault.on("rename", (file, oldPath) => {
				if (file.path.includes("snippets/") || oldPath.includes("snippets/"))
					this.reregister();
			})
		);

		// Fallback poll: catches enables/disables done via Settings
		// and snippets added while Obsidian was closed. Cheap (array compare).
		let lastSeen = "";
		this.registerInterval(
			window.setInterval(() => {
				const key = this.getSnippetNames().join("\n");
				if (key !== lastSeen) {
					lastSeen = key;
					if (key !== "") this.reregister();
				}
			}, 5000)
		);
	}

	onunload() {}

	// ---------- public API used by the modal ----------

	getSnippetNames(): string[] {
		return getCustomCss(this.app)?.snippets.slice().sort() ?? [];
	}

	isEnabled(snippetName: string): boolean {
		return getCustomCss(this.app)?.enabledSnippets.has(snippetName) ?? false;
	}

	async toggleSnippet(snippetName: string): Promise<void> {
		const customCss = getCustomCss(this.app);
		if (!customCss) {
			new Notice("Snippet API not available yet, try again in a moment.");
			return;
		}
		const next = !customCss.enabledSnippets.has(snippetName);
		customCss.setCssEnabledStatus(snippetName, next);
		new Notice(`Snippet “${snippetName}” ${next ? "enabled" : "disabled"}`);
	}

	async setAll(enabled: boolean): Promise<void> {
		const customCss = getCustomCss(this.app);
		if (!customCss) {
			new Notice("Snippet API not available yet, try again in a moment.");
			return;
		}
		for (const name of customCss.snippets) {
			customCss.setCssEnabledStatus(name, enabled);
		}
		new Notice(
			enabled
				? `Enabled ${customCss.snippets.length} snippet(s)`
				: `Disabled ${customCss.snippets.length} snippet(s)`
		);
	}

	// ---------- internal ----------

	private reregister(): void {
		this.refreshSnippetsFromDisk();
		this.registerSnippetCommands();
	}

	/** Ask Obsidian to rescan the snippets folder (best-effort). */
	private refreshSnippetsFromDisk(): void {
		try {
			const customCss = getCustomCss(this.app);
			// readSnippets() is internal but stable across versions; guarded by typeof.
			if (customCss && typeof customCss.readSnippets === "function") {
				customCss.readSnippets();
			} else if (
				customCss &&
				typeof customCss.requestLoadSnippets === "function"
			) {
				customCss.requestLoadSnippets();
			}
		} catch {
			// Non-fatal: fall back to whatever snippets list is cached.
		}
	}

	/**
	 * Register one `Toggle snippet: <name>` command per detected snippet.
	 * Stale commands are removed so deleted/renamed snippets don't linger.
	 */
	private registerSnippetCommands(): void {
		const names = this.getSnippetNames();
		const wanted = new Map<string, string>();

		for (const name of names) {
			const baseId = toCommandId(name);
			// Disambiguate snippets that slugify to the same command id.
			let id = baseId;
			let n = 2;
			while (wanted.has(id) && wanted.get(id) !== name) {
				id = `${baseId}-${n++}`;
			}
			wanted.set(id, name);
			if (this.snippetCommandIds.get(id) === name) continue;

			this.addCommand({
				id,
				name: `Toggle snippet: ${name}`,
				callback: () => void this.toggleSnippet(name),
			});
			this.snippetCommandIds.set(id, name);
		}

		// Remove commands for snippets that no longer exist.
		for (const [id, name] of [...this.snippetCommandIds]) {
			if (wanted.get(id) !== name) {
				// removeCommand exists on Plugin (0.15+); guard for typings.
				(this as unknown as { removeCommand?: (id: string) => void }).removeCommand?.(
					id
				);
				this.snippetCommandIds.delete(id);
			}
		}
	}
}
