# Snippet Master

Toggle Obsidian CSS snippets from the command palette — no more digging through Settings → Appearance.

## Commands

| Command | What it does |
|---|---|
| `Toggle snippet…` | Fuzzy picker over all snippets (`✓` = enabled). Select one to toggle it. |
| `Toggle snippet: <name>` | Dedicated command per snippet — assign a hotkey to the ones you flip often. |
| `Enable all snippets` | Turn every snippet on. |
| `Disable all snippets` | Turn every snippet off. |
| `Reload snippet list` | Rescan `.obsidian/snippets/` after adding or removing files. |

The per-snippet commands stay in sync automatically when snippet files are created, deleted, or renamed.

## Installation

**Via BRAT (recommended for now):**

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) community plugin.
2. In BRAT settings, choose **Add Beta plugin** and paste this repo's URL.
3. Enable **Snippet Master** under Settings → Community plugins.

**Manual:**

1. Download `manifest.json` and `main.js` from the latest release (or build from source).
2. Copy them into `<vault>/.obsidian/plugins/snippet-toggles/`.
3. Enable **Snippet Master** under Settings → Community plugins.

## Usage

1. Open the command palette (`Cmd/Ctrl + P`).
2. Run `Snippet Master: Toggle snippet…` and pick a snippet — or run `Toggle snippet: <name>` directly.
3. Optional: go to Settings → Hotkeys and bind your most-used `Toggle snippet: <name>` commands to hotkeys.

## Development

```sh
npm install
npm run dev    # watch build
npm run build  # typecheck + production build
```

## License

MIT
