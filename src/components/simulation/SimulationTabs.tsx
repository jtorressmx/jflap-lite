const tabs = [
  { id: 'simulation', title: 'Simulación' },
  { id: 'batch', title: 'Entradas múltiples' },
  { id: 'trace', title: 'Traza' },
] as const;

export type SimulationTab = (typeof tabs)[number]['id'];

/**
 * Shows simulation tabs with keyboard navigation.
 * @param props - Component options.
 * @param props.selected - Identifier of the active tab.
 * @param props.onSelect - Receives the identifier of the tab requested for activation.
 * @param props.tabId - Receives a tab identifier and returns the DOM identifier of its button.
 * @param props.panelId - Receives a tab identifier and returns the DOM identifier of its panel.
 * @returns The simulation tab buttons.
 */
export function SimulationTabs({
  selected,
  onSelect,
  tabId,
  panelId,
}: {
  selected: SimulationTab;
  onSelect: (tab: SimulationTab) => void;
  tabId: (tab: SimulationTab) => string;
  panelId: (tab: SimulationTab) => string;
}) {
  return tabs.map((item, index) => (
    <button
      key={item.id}
      type="button"
      role="tab"
      aria-selected={selected === item.id}
      aria-controls={panelId(item.id)}
      id={tabId(item.id)}
      tabIndex={selected === item.id ? 0 : -1}
      className={selected === item.id ? 'is-active' : ''}
      onClick={() => onSelect(item.id)}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
          return;
        event.preventDefault();
        const nextIndex =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
                tabs.length;
        const next = tabs[nextIndex];
        onSelect(next.id);
        document.getElementById(tabId(next.id))?.focus();
      }}
    >
      {item.title}
    </button>
  ));
}
