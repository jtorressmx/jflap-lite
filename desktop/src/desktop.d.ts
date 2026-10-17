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
    | 'help'
    | 'about';
  type DesktopFileKind =
    | 'jff'
    | 'xml'
    | 'txt'
    | 'svg'
    | 'png'
    | 'jpeg'
    | 'jpg'
    | 'gif'
    | 'bmp'
    | 'pdf';
  type DesktopFile = { path: string; name: string; content: string };
  type DesktopSaveResult = { path?: string; canceled: boolean };
  interface DesktopBridge {
    readonly platform: string;
    getInfo(): Promise<{
      version: string;
      platform: string;
      electronVersion: string;
    }>;
    openFiles(options?: {
      kind?: 'machine' | 'text';
      multiple?: boolean;
    }): Promise<DesktopFile[]>;
    saveFile(request: {
      content: string;
      name: string;
      path?: string;
      kind?: DesktopFileKind;
    }): Promise<DesktopSaveResult>;
    exportFile(request: {
      data: number[];
      name: string;
      kind: DesktopFileKind;
    }): Promise<DesktopSaveResult>;
    print(
      svg: string,
      name: string,
    ): Promise<{ success: boolean; error?: string }>;
    exportPdf(svg: string, name: string): Promise<DesktopSaveResult>;
    getInitialFiles(): Promise<DesktopFile[]>;
    onOpenFiles(callback: (files: DesktopFile[]) => void): () => void;
    onCommand(callback: (command: DesktopCommand) => void): () => void;
    setDocumentState(state: {
      name: string;
      dirty: boolean;
      dirtyCount?: number;
      path?: string;
    }): Promise<void>;
    completeClose(result: { saved: boolean }): Promise<boolean>;
    readWorkspace(): Promise<string | null>;
    writeWorkspace(content: string): Promise<void>;
  }
  interface Window {
    desktop?: DesktopBridge;
  }
}
