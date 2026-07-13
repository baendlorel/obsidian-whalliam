import { Plugin } from 'obsidian';

// Must run before any SDK imports to patch Electron/Node.js realm incompatibility
export default class WhalliamPlugin extends Plugin {
  async onload() {}

  onunload(): void {}
}
