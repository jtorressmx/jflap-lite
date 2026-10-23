export {};

declare global {
   type DesktopCommand =
      | 'new'
      | 'open'
      | 'save'
      | 'save-as'
      | 'save-all'
      | 'close'
      | 'print'
      | 'step'
      | 'start'
      | 'fast'
      | 'batch'
      | 'output'
      | 'preferences'
      | 'help';
   type DesktopFileKind = 'jff' | 'xml' | 'txt' | 'svg' | 'png';
   type DesktopFile = { path: string; name: string; content: string };
   type DesktopRecentFile = { path: string; name: string; openedAt?: string };
   type DesktopSaveResult = { path?: string; canceled: boolean };
   interface DesktopBridge {
      readonly isDesktop: boolean;
      readonly platform: string;
      getRecentFiles(): Promise<DesktopRecentFile[]>;
      removeRecentFile(path: string): Promise<DesktopRecentFile[]>;
      openRecentFile(path: string): Promise<DesktopFile | null>;
      openFiles(options?: {
         kind?: 'machine' | 'text';
         multiple?: boolean;
      }): Promise<DesktopFile[]>;
      /**
       * Reads dropped JFLAP files through the active runtime.
       * @param files - Files dragged into the application.
       * @returns File paths, names, and contents for supported machines.
       */
      readDroppedFiles(files: File[]): Promise<DesktopFile[]>;
      saveFile(request: {
         content: string;
         name: string;
         path?: string;
         kind?: DesktopFileKind;
      }): Promise<DesktopSaveResult>;
      /**
       * Reauthorizes a saved workspace path when it belongs to a recent machine file.
       * @param path - Candidate file path to restore.
       * @returns Whether the application can safely overwrite the file.
       */
      authorizeSavePath(path: string): Promise<boolean>;
      exportFile(request: {
         data: number[];
         name: string;
         kind: DesktopFileKind;
      }): Promise<DesktopSaveResult>;
      print(svg: string, name: string): Promise<{ success: boolean; error?: string }>;
      getInitialFiles(): Promise<DesktopFile[]>;
      onOpenFiles(callback: (files: DesktopFile[]) => void): () => void;
      onCommand(callback: (command: DesktopCommand) => void): () => void;
      setDocumentState(state: {
         name: string;
         dirty: boolean;
         dirtyCount?: number;
         autoSaveOnBlur?: boolean;
      }): Promise<void>;
      completeClose(result: { saved: boolean }): Promise<boolean>;
      readWorkspace(): Promise<string | null>;
      writeWorkspace(content: string): Promise<void>;
   }
   interface Window {
      desktop: DesktopBridge;
   }
}
