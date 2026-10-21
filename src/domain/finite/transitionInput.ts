/** Split labels, expand bracketed symbol lists, and keep hyphenated ranges intact. */
export function transitionLabels(input: string): string[] {
   const entries =
      input.includes(',') && input !== ','
         ? input.split(',').map((entry) => entry.trim())
         : [input];
   if (entries.length > 1 && entries.some((entry) => !entry))
      throw new Error('Escribe un símbolo entre las comas.');
   const labels = new Set<string>();
   for (const entry of entries) {
      const value = entry.trim();
      const range = /^\[(.)-(.)\]$/u.exec(value);
      if (range) {
         labels.add(value);
         continue;
      }
      const bracketed = /^\[([^\[\]]*)\]$/u.exec(value);
      if (bracketed) {
         const symbols = Array.from(bracketed[1]);
         if (!symbols.length || symbols.includes('-'))
            throw new Error(`Revisa el rango «${entry}».`);
         symbols.forEach((symbol) => labels.add(symbol));
         continue;
      }
      if (value.length > 1 && (value.includes('[') || value.includes(']')))
         throw new Error(`Revisa el rango «${entry}».`);
      labels.add(entry);
   }
   return [...labels];
}
