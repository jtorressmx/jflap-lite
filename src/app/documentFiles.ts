import { serializeJff } from '@/domain/jff';
import type { Machine } from '@/domain/model';

export type SavedDocument = { machine: Machine; path?: string };
/**
 * Extracts a document title from its destination path.
 * @param filePath - Native destination path.
 * @returns The filename without its machine extension.
 */
function documentNameFromPath(filePath: string): string {
   return (
      filePath
         .split(/[\\/]/)
         .pop()
         ?.replace(/\.(?:jff|xml)$/i, '') || ''
   );
}
/**
 * Saves a document, retrying with a destination picker when its path is unavailable.
 * @param desktop - File-saving capability supplied by the runtime.
 * @param machine - Immutable machine snapshot to save.
 * @param path - Existing destination, omitted to request a new one.
 * @returns The saved snapshot and path, or null when the user cancels.
 */
export async function saveDocumentFile(
   desktop: Pick<DesktopBridge, 'saveFile'>,
   machine: Machine,
   path?: string
): Promise<SavedDocument | null> {
   let snapshot = machine;
   let choosesPath = !path;
   let result: DesktopSaveResult;
   try {
      result = await desktop.saveFile({
         content: serializeJff(snapshot),
         name: snapshot.name,
         path,
         kind: 'jff',
      });
   } catch (error) {
      if (!path) throw error;
      choosesPath = true;
      result = await desktop.saveFile({
         content: serializeJff(snapshot),
         name: snapshot.name,
         kind: 'jff',
      });
   }
   if (result.canceled) return null;
   if (choosesPath && result.path) {
      const name = documentNameFromPath(result.path);
      if (name && name !== snapshot.name) {
         snapshot = { ...snapshot, name };
         result = await desktop.saveFile({
            content: serializeJff(snapshot),
            name,
            path: result.path,
            kind: 'jff',
         });
         if (result.canceled) return null;
      }
   }
   return { machine: snapshot, path: result.path };
}
