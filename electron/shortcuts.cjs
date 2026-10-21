/** Native file/simulation shortcuts; editing shortcuts stay in the focused renderer control. */
function shortcutCommand(input) {
   if (input.type !== 'keyDown' || input.isComposing) return null;
   const key = input.key.toLowerCase();
   const ctrl = input.control || input.meta;
   if (ctrl) {
      if (key === 's') return input.shift ? 'save-as' : input.alt ? 'save-all' : 'save';
      if (input.alt || input.shift) return null;
      return (
         {
            n: 'new',
            o: 'open',
            p: 'print',
            w: 'close',
            r: 'start',
            m: 'batch',
            t: 'output',
            ',': 'preferences',
         }[key] || null
      );
   }
   if (input.alt || input.shift) return null;
   return { f1: 'help', f5: 'fast', f6: 'step', f10: 'step' }[key] || null;
}
module.exports = { shortcutCommand };
