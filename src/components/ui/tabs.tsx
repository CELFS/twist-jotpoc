
import type { KeyboardEvent, ReactNode } from "react";

export type TabOption<Value extends string> = {
  icon?: ReactNode;
  label: string;
  value: Value;
};

export type TabsProps<Value extends string> = {
  ariaLabel: string;
  className?: string;
  labelOnSelection?: boolean;
  id: string;
  items: readonly TabOption<Value>[];
  value: Value | null;
  onValueChange: (value: Value) => void;
};

export function Tabs<Value extends string>({
  ariaLabel,
  className = "",
  labelOnSelection = false,
  id,
  items,
  value,
  onValueChange,
}: TabsProps<Value>) {
  const classes = ["ui-tabs", className].filter(Boolean).join(" ");

  const selectFromKeyboard = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % items.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    onValueChange(items[nextIndex].value);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [nextIndex]?.focus();
  };

  return (
    <div aria-label={ariaLabel} className={classes} role="tablist">
      {items.map((item, index) => (
        <button
          aria-controls={`${id}-panel-${item.value}`}
          aria-selected={value === item.value}
          aria-label={labelOnSelection ? item.label : undefined}
          title={labelOnSelection ? item.label : undefined}
          className="ui-tab"
          data-selected={value === item.value}
          id={`${id}-tab-${item.value}`}
          key={item.value}
          role="tab"
          tabIndex={(value === null ? index === 0 : value === item.value) ? 0 : -1}
          type="button"
          onClick={() => onValueChange(item.value)}
          onKeyDown={(event) =>
            selectFromKeyboard(event, index)
          }
        >
          {item.icon}
          <span className={labelOnSelection && item.icon && value !== item.value ? "visually-hidden" : undefined}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
