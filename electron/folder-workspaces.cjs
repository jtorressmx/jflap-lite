const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const policy = require('./policy.cjs');

/** @typedef {{id: string, name: string, path: string}} FolderWorkspace */
/** @typedef {{items: FolderWorkspace[], activeId: string | null}} FolderWorkspaceState */

/**
 * Validates a saved folder registration.
 * @param {unknown} value - Candidate registration.
 * @returns {value is FolderWorkspace} Whether the record contains a usable folder path.
 */
function isFolderWorkspace(value) {
   return (
      value !== null &&
      typeof value === 'object' &&
      'id' in value &&
      typeof value.id === 'string' &&
      'name' in value &&
      typeof value.name === 'string' &&
      'path' in value &&
      typeof value.path === 'string' &&
      path.isAbsolute(value.path)
   );
}

/**
 * Loads and validates the saved folder registry.
 * @param {string} file - Registry file.
 * @returns {Promise<FolderWorkspaceState>} Validated registry.
 */
async function readRegistry(file) {
   let content;
   try {
      content = await fs.readFile(file, 'utf8');
   } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
         return { items: [], activeId: null };
      throw error;
   }
   const value = /** @type {unknown} */ (JSON.parse(content));
   if (!value || typeof value !== 'object' || !('items' in value) || !Array.isArray(value.items))
      throw new Error('Invalid workspace registry.');
   const candidates = /** @type {unknown[]} */ (value.items);
   const items = candidates.filter(isFolderWorkspace);
   const activeId =
      'activeId' in value &&
      typeof value.activeId === 'string' &&
      items.some((item) => item.id === value.activeId)
         ? value.activeId
         : null;
   return { items, activeId };
}

/**
 * Creates the authorized folder registry and file operations.
 * @param {object} options - Native dependencies.
 * @param {string} options.storagePath - Registry destination.
 * @param {() => Promise<string | null>} options.chooseDirectory - Opens the native folder picker.
 * @param {(paths: string[]) => Promise<Array<{path: string, name: string, content: string}>>} options.openFiles - Reads authorized files.
 * @returns Registry and folder operations.
 */
function createFolderWorkspaces({ storagePath, chooseDirectory, openFiles }) {
   /**
    * Persists a complete registry atomically.
    * @param {FolderWorkspaceState} state - Next registry.
    * @returns {Promise<FolderWorkspaceState>} Saved registry.
    */
   async function persist(state) {
      const temporary = `${storagePath}.${randomUUID()}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(state), 'utf8');
      await fs.rename(temporary, storagePath);
      return state;
   }
   /**
    * Resolves a registered folder and verifies it remains available.
    * @param {string} id - Workspace identifier.
    * @returns {Promise<string>} Canonical folder path.
    */
   async function directory(id) {
      const state = await readRegistry(storagePath);
      const workspace = state.items.find((item) => item.id === id);
      if (!workspace) throw new Error('Unknown workspace.');
      const real = await fs.realpath(workspace.path);
      if (!(await fs.stat(real)).isDirectory()) throw new Error('Unavailable folder.');
      return real;
   }
   return {
      /** Reads the registry without inputs. @returns {Promise<FolderWorkspaceState>} Saved spaces. */
      getState: () => readRegistry(storagePath),
      /**
       * Creates a named workspace from a user-selected folder.
       * @param {unknown} name - Requested name.
       * @returns {Promise<FolderWorkspaceState | null>} Updated registry or picker cancellation.
       */
      async create(name) {
         const label = policy.text(name, 400).trim();
         if (!label) throw new Error('A workspace name is required.');
         const selected = await chooseDirectory();
         if (!selected) return null;
         const folder = await fs.realpath(selected);
         const state = await readRegistry(storagePath);
         const existing = state.items.find(
            (item) => policy.canonicalKey(item.path) === policy.canonicalKey(folder)
         );
         const item = { id: existing?.id ?? randomUUID(), name: label, path: folder };
         return persist({
            items: [...state.items.filter((entry) => entry.id !== item.id), item],
            activeId: item.id,
         });
      },
      /**
       * Selects a stored workspace or disables folder mode.
       * @param {unknown} id - Workspace identifier or null.
       * @returns {Promise<FolderWorkspaceState>} Updated registry.
       */
      async select(id) {
         const state = await readRegistry(storagePath);
         if (id !== null && (typeof id !== 'string' || !state.items.some((item) => item.id === id)))
            throw new Error('Unknown workspace.');
         return persist({ ...state, activeId: id });
      },
      /**
       * Removes a registration while leaving its folder untouched.
       * @param {string} id - Workspace identifier.
       * @returns {Promise<FolderWorkspaceState>} Updated registry.
       */
      async remove(id) {
         const state = await readRegistry(storagePath);
         return persist({
            items: state.items.filter((item) => item.id !== id),
            activeId: state.activeId === id ? null : state.activeId,
         });
      },
      /**
       * Lists direct JFF children without guessing their machine kind.
       * @param {string} id - Workspace identifier.
       * @returns {Promise<Array<{path: string, name: string}>>} Available files.
       */
      async listFiles(id) {
         const folder = await directory(id);
         const entries = await fs.readdir(folder, { withFileTypes: true });
         return entries
            .filter((entry) => entry.isFile() && /\.jff$/i.test(entry.name))
            .map((entry) => ({ path: path.join(folder, entry.name), name: entry.name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
      },
      /**
       * Opens a JFF file contained directly in a registered folder.
       * @param {string} id - Workspace identifier.
       * @param {unknown} candidate - Requested file path.
       * @returns {Promise<Array<{path: string, name: string, content: string}>>} File contents.
       */
      async openFile(id, candidate) {
         if (typeof candidate !== 'string' || !/\.jff$/i.test(candidate))
            throw new Error('Invalid file.');
         const folder = await directory(id);
         const real = await fs.realpath(candidate);
         if (policy.canonicalKey(path.dirname(real)) !== policy.canonicalKey(folder))
            throw new Error('File outside workspace.');
         return openFiles([real]);
      },
      /** Resolves the active folder without inputs. @returns {Promise<string | undefined>} Default save folder. */
      async defaultDirectory() {
         const state = await readRegistry(storagePath);
         return state.activeId ? directory(state.activeId) : undefined;
      },
   };
}

module.exports = { createFolderWorkspaces };
