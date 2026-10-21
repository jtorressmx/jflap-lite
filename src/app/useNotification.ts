import { useCallback, useEffect, useState } from 'react';

/**
 * Manages a dismissible notification with a six-second lifetime.
 * Takes no input.
 * @returns The current message and notification actions.
 */
export function useNotification() {
   const [message, setMessage] = useState('');
   const notify = useCallback((text: string) => setMessage(text), []);
   useEffect(() => {
      if (!message) return;
      const timer = setTimeout(() => setMessage(''), 6000);
      return () => clearTimeout(timer);
   }, [message]);
   return { message, notify, dismiss: () => setMessage('') };
}
