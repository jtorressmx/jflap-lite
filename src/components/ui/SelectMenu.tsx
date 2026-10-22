import type { CSSProperties, KeyboardEvent } from 'react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { FiCheck, FiChevronDown } from '@/components/icons';

export type SelectMenuOption<Value extends string> = {
   label: string;
   value: Value;
};

type SelectMenuProps<Value extends string> = {
   label: string;
   value: Value;
   options: readonly SelectMenuOption<Value>[];
   onChange: (value: Value) => void;
};

/**
 * Shows a keyboard-accessible custom selector.
 * @param props - Component options.
 * @param props.label - Accessible name for the selector.
 * @param props.value - Currently selected option value.
 * @param props.options - Available choices.
 * @param props.options[].label - Visible choice text.
 * @param props.options[].value - Value emitted when the choice is selected.
 * @param props.onChange - Receives the value selected by the user.
 * @returns The custom selector and its option list.
 */
export function SelectMenu<Value extends string>({
   label,
   value,
   options,
   onChange,
}: SelectMenuProps<Value>) {
   const id = useId();
   const rootRef = useRef<HTMLDivElement>(null);
   const triggerRef = useRef<HTMLButtonElement>(null);
   const listboxRef = useRef<HTMLDivElement>(null);
   const [open, setOpen] = useState(false);
   const [activeIndex, setActiveIndex] = useState(0);
   const [popoverStyle, setPopoverStyle] = useState<CSSProperties>();
   const selectedIndex = options.findIndex((option) => option.value === value);
   const selectedOption = options[selectedIndex];

   /**
    * Opens the list with the current choice highlighted and takes no inputs.
    * @returns No value.
    */
   function openMenu(): void {
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      setOpen(true);
   }

   /**
    * Closes the list and optionally returns focus to its trigger.
    * @param restoreFocus - Whether to focus the selector button after closing.
    * @returns No value.
    */
   function closeMenu(restoreFocus = false): void {
      setOpen(false);
      if (restoreFocus) triggerRef.current?.focus();
   }

   /**
    * Updates the fixed option-list position beside its trigger and takes no inputs.
    * @returns No value.
    */
   function updatePosition(): void {
      const trigger = triggerRef.current;
      const listbox = listboxRef.current;
      if (!trigger || !listbox) return;
      const bounds = trigger.getBoundingClientRect();
      const rootStyle = getComputedStyle(document.documentElement);
      const gutter = parseFloat(rootStyle.getPropertyValue('--space-2'));
      const gap = parseFloat(rootStyle.getPropertyValue('--space-1'));
      const width = Math.min(bounds.width, window.innerWidth - gutter * 2);
      const left = Math.max(gutter, Math.min(bounds.left, window.innerWidth - width - gutter));
      const below = bounds.bottom + gap;
      const top =
         below + listbox.offsetHeight <= window.innerHeight - gutter
            ? below
            : Math.max(gutter, bounds.top - listbox.offsetHeight - gap);
      setPopoverStyle({ left, top, width });
   }

   /**
    * Handles opening the selector from its keyboard trigger.
    * @param event - Keyboard event from the selector button.
    * @returns No value.
    */
   function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      openMenu();
   }

   /**
    * Handles list navigation and selection from the keyboard.
    * @param event - Keyboard event from the option list.
    * @returns No value.
    */
   function handleListboxKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
      if (!options.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
         event.preventDefault();
         setActiveIndex(
            (index) =>
               (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
         );
         return;
      }
      if (event.key === 'Home' || event.key === 'End') {
         event.preventDefault();
         setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
         return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
         event.preventDefault();
         const option = options[activeIndex];
         if (option) selectOption(option.value);
         return;
      }
      if (event.key === 'Tab') {
         closeMenu(true);
         return;
      }
      if (event.key === 'Escape') {
         event.preventDefault();
         closeMenu(true);
      }
   }

   /** Applies a selection and returns focus to the selector trigger.
    * @param nextValue - Value chosen from the option list.
    * @returns No value.
    */
   function selectOption(nextValue: Value): void {
      onChange(nextValue);
      closeMenu(true);
   }

   useEffect(() => {
      if (!open) return;
      listboxRef.current?.focus();
   }, [open]);

   useLayoutEffect(() => {
      if (!open) return;
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
         window.removeEventListener('resize', updatePosition);
         window.removeEventListener('scroll', updatePosition, true);
      };
   }, [open]);

   return (
      <div className="select-menu" ref={rootRef}>
         <button
            ref={triggerRef}
            type="button"
            className="select-menu-trigger"
            aria-label={label}
            aria-describedby={`${id}-value`}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? `${id}-listbox` : undefined}
            onClick={() => (open ? closeMenu() : openMenu())}
            onKeyDown={handleTriggerKeyDown}
         >
            <span id={`${id}-value`}>{selectedOption?.label ?? value}</span>
            <FiChevronDown aria-hidden="true" />
         </button>
         {open &&
            createPortal(
               <div
                  id={`${id}-listbox`}
                  ref={listboxRef}
                  className="select-menu-popover"
                  role="listbox"
                  aria-label={label}
                  aria-activedescendant={options.length ? `${id}-option-${activeIndex}` : undefined}
                  tabIndex={-1}
                  data-popover-keep-open="true"
                  style={popoverStyle}
                  onKeyDown={handleListboxKeyDown}
                  onBlur={(event) => {
                     const nextTarget = event.relatedTarget;
                     if (!(nextTarget instanceof Node) || !rootRef.current?.contains(nextTarget)) {
                        closeMenu();
                     }
                  }}
               >
                  {options.map((option, index) => (
                     <div
                        key={option.value}
                        id={`${id}-option-${index}`}
                        className="select-menu-option"
                        role="option"
                        aria-selected={option.value === value}
                        data-active={index === activeIndex || undefined}
                        onPointerMove={() => setActiveIndex(index)}
                        onClick={() => selectOption(option.value)}
                     >
                        <span>{option.label}</span>
                        {option.value === value && <FiCheck aria-hidden="true" />}
                     </div>
                  ))}
               </div>,
               document.body
            )}
      </div>
   );
}
