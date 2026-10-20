export type BatchInputItem = {
  id: string;
  input: string;
  empty: boolean;
};

export type BatchTextFile = {
  name: string;
  content: string;
};

/**
 * Creates a test input item.
 * @param empty - Whether this item represents an explicitly empty string.
 * @returns The input item with a unique identifier.
 */
export function createBatchInputItem(empty = false): BatchInputItem {
  return { id: crypto.randomUUID(), input: '', empty };
}

/**
 * Collects strings from manual test inputs.
 * @param items - Editable manual input items.
 * @returns The nonblank input strings and explicitly empty strings.
 */
export function manualBatchInputs(items: BatchInputItem[]): string[] {
  return items.flatMap((item) => {
    if (item.empty) return [''];
    return item.input.trim() ? [item.input] : [];
  });
}
