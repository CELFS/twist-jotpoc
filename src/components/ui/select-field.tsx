
import { Check, ChevronDown, X } from "lucide-react";
import {
  Children,
  Fragment,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

type SelectOption = {
  disabled: boolean;
  label: ReactNode;
  text: string;
  value: string;
};

type SelectPosition = {
  left: number;
  maxHeight: number;
  top: number;
  transform?: string;
  width: number;
};

export type SelectFieldProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "multiple" | "size"
> & {
  error?: string;
  hint?: string;
  label: string;
  labelHidden?: boolean;
  optionVisuals?: Readonly<Record<string, ReactNode>>;
  triggerVisualOnly?: boolean;
  triggerContent?: ReactNode;
  listboxClassName?: string;
  optionRemoveActions?: Readonly<Record<string, { label: string; onRemove: () => void }>>;
};

function getNodeText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      if (isValidElement<{ children?: ReactNode }>(child)) {
        return getNodeText(child.props.children);
      }

      return "";
    })
    .join("")
    .trim();
}

function getSelectOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];

  function visit(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement<ComponentPropsWithoutRef<"option">>(child)) {
        return;
      }

      if (child.type === "option") {
        const text = getNodeText(child.props.children);

        options.push({
          disabled: Boolean(child.props.disabled),
          label: child.props.children,
          text,
          value:
            child.props.value === undefined
              ? text
              : String(child.props.value),
        });
        return;
      }

      if (child.type === Fragment || child.type === "optgroup") {
        visit(child.props.children);
      }
    });
  }

  visit(children);
  return options;
}

function getInitialValue(
  value: SelectFieldProps["value"],
  defaultValue: SelectFieldProps["defaultValue"],
  options: SelectOption[],
) {
  if (value !== undefined && !Array.isArray(value)) {
    return String(value);
  }

  if (defaultValue !== undefined && !Array.isArray(defaultValue)) {
    return String(defaultValue);
  }

  return options[0]?.value ?? "";
}

function findEnabledOption(
  options: SelectOption[],
  startIndex: number,
  direction: 1 | -1,
) {
  if (options.length === 0) {
    return -1;
  }

  for (let offset = 1; offset <= options.length; offset += 1) {
    const index =
      (startIndex + direction * offset + options.length) %
      options.length;

    if (!options[index]?.disabled) {
      return index;
    }
  }

  return -1;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField(
    {
      children,
      className = "",
      defaultValue,
      disabled,
      error,
      hint,
      id,
      label,
      labelHidden = false,
      onBlur,
      onChange,
      optionVisuals,
      triggerVisualOnly = false,
      triggerContent,
      listboxClassName = "",
      optionRemoveActions,
      required,
      value,
      ...props
    },
    forwardedRef,
  ) {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const labelId = `${selectId}-label`;
    const valueId = `${selectId}-value`;
    const listboxId = `${selectId}-listbox`;
    const descriptionId = error || hint ? `${selectId}-description` : undefined;
    const options = getSelectOptions(children);
    const controlledValue =
      value !== undefined && !Array.isArray(value) ? String(value) : undefined;
    const [uncontrolledValue, setUncontrolledValue] = useState(() =>
      getInitialValue(value, defaultValue, options),
    );
    const selectedValue = controlledValue ?? uncontrolledValue;
    const selectedIndex = options.findIndex(
      (option) => option.value === selectedValue,
    );
    const selectedOption = options[selectedIndex] ?? options[0];
    const [activeIndex, setActiveIndex] = useState(selectedIndex);
    const [open, setOpen] = useState(false);
    const [portalHost, setPortalHost] = useState<Element | null>(null);
    const [position, setPosition] = useState<SelectPosition | null>(null);
    const nativeRef = useRef<HTMLSelectElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listboxRef = useRef<HTMLDivElement>(null);
    const typeaheadRef = useRef({ query: "", timestamp: 0 });
    const renderOptionContent = (option: SelectOption) => {
      const visual = optionVisuals?.[option.value];

      return visual ? (
        <span className="ui-select-option-content">
          {visual}
          <span>{option.label}</span>
        </span>
      ) : (
        option.label
      );
    };

    const setNativeRef = useCallback(
      (node: HTMLSelectElement | null) => {
        nativeRef.current = node;

        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const updatePosition = useCallback(() => {
      const trigger = triggerRef.current;

      if (!trigger) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const dialog = trigger.closest("dialog");
      const boundaryRect = dialog?.getBoundingClientRect();
      const boundary = {
        bottom: boundaryRect?.bottom ?? window.innerHeight,
        left: boundaryRect?.left ?? 0,
        right: boundaryRect?.right ?? window.innerWidth,
        top: boundaryRect?.top ?? 0,
      };
      const padding = 12;
      const gap = 8;
      const availableBelow =
        boundary.bottom - triggerRect.bottom - gap - padding;
      const availableAbove =
        triggerRect.top - boundary.top - gap - padding;
      const placeAbove =
        availableBelow < 176 && availableAbove > availableBelow;
      const availableHeight = placeAbove
        ? availableAbove
        : availableBelow;
      const maxWidth = Math.max(
        0,
        boundary.right - boundary.left - padding * 2,
      );
      const listbox = listboxRef.current;
      let contentWidth = 0;

      if (listbox) {
        const previousWidth = listbox.style.width;
        listbox.style.width = "max-content";
        contentWidth = Math.ceil(listbox.getBoundingClientRect().width);
        listbox.style.width = previousWidth;
      }

      const width = Math.min(
        Math.max(triggerRect.width, 160, contentWidth),
        maxWidth,
      );
      const left = Math.min(
        Math.max(triggerRect.left, boundary.left + padding),
        boundary.right - padding - width,
      );

      setPosition({
        left,
        maxHeight: Math.max(96, Math.min(288, availableHeight)),
        top: placeAbove
          ? triggerRect.top - gap
          : triggerRect.bottom + gap,
        transform: placeAbove ? "translateY(-100%)" : undefined,
        width,
      });
      setPortalHost(dialog ?? document.body);
    }, []);

    const closeListbox = useCallback(() => {
      setOpen(false);
      setPosition(null);
    }, []);

    const openListbox = useCallback(() => {
      if (disabled || options.length === 0) {
        return;
      }

      const nativeValue = nativeRef.current?.value;
      const currentIndex = options.findIndex(
        (option) => option.value === (nativeValue ?? selectedValue),
      );
      const nextIndex =
        currentIndex >= 0 && !options[currentIndex]?.disabled
          ? currentIndex
          : findEnabledOption(options, -1, 1);

      setActiveIndex(nextIndex);
      updatePosition();
      setOpen(true);
    }, [disabled, options, selectedValue, updatePosition]);

    const commitValue = useCallback(
      (nextValue: string) => {
        const nativeSelect = nativeRef.current;

        if (!nativeSelect) {
          return;
        }

        const valueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLSelectElement.prototype,
          "value",
        )?.set;

        valueSetter?.call(nativeSelect, nextValue);
        setUncontrolledValue(nextValue);
        nativeSelect.dispatchEvent(
          new Event("change", { bubbles: true }),
        );
        closeListbox();
        triggerRef.current?.focus();
      },
      [closeListbox],
    );

    const moveActiveOption = useCallback(
      (direction: 1 | -1) => {
        setActiveIndex((currentIndex) => {
          const startingIndex =
            currentIndex >= 0 ? currentIndex : selectedIndex;
          return findEnabledOption(
            options,
            startingIndex,
            direction,
          );
        });
      },
      [options, selectedIndex],
    );

    const handleTriggerKeyDown = (
      event: KeyboardEvent<HTMLButtonElement>,
    ) => {
      if (disabled) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();

        if (!open) {
          openListbox();
        } else {
          moveActiveOption(event.key === "ArrowDown" ? 1 : -1);
        }
        return;
      }

      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();

        if (!open) {
          openListbox();
        }

        const direction = event.key === "Home" ? 1 : -1;
        const startingIndex = event.key === "Home" ? -1 : options.length;
        setActiveIndex(
          findEnabledOption(options, startingIndex, direction),
        );
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();

        if (open && activeIndex >= 0) {
          const activeOption = options[activeIndex];

          if (activeOption && !activeOption.disabled) {
            commitValue(activeOption.value);
          }
        } else {
          openListbox();
        }
        return;
      }

      if (event.key === "Escape" && open) {
        event.preventDefault();
        closeListbox();
        return;
      }

      if (event.key === "Delete" && open) {
        const action = optionRemoveActions?.[options[activeIndex]?.value];
        if (action) {
          event.preventDefault();
          closeListbox();
          action.onRemove();
        }
        return;
      }

      if (event.key === "Tab") {
        if (open && optionRemoveActions && !event.shiftKey) {
          const removeButton = listboxRef.current?.querySelector<HTMLButtonElement>(".ui-select-option-remove:not(:disabled)");
          if (removeButton) {
            event.preventDefault();
            removeButton.focus();
            return;
          }
        }
        closeListbox();
        return;
      }

      if (
        event.key.length === 1 &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        const now = Date.now();
        const previous = typeaheadRef.current;
        const query =
          now - previous.timestamp > 600
            ? event.key
            : `${previous.query}${event.key}`;
        const normalizedQuery = query.toLocaleLowerCase();
        const matchIndex = options.findIndex(
          (option) =>
            !option.disabled &&
            option.text.toLocaleLowerCase().startsWith(normalizedQuery),
        );

        typeaheadRef.current = { query, timestamp: now };

        if (matchIndex >= 0) {
          event.preventDefault();

          if (!open) {
            openListbox();
          }

          setActiveIndex(matchIndex);
        }
      }
    };

    useLayoutEffect(() => {
      if (open) {
        updatePosition();
      }
    }, [open, children, optionVisuals, selectedValue, updatePosition]);

    useEffect(() => {
      const nativeSelect = nativeRef.current;

      if (!nativeSelect || controlledValue !== undefined) {
        return;
      }

      setUncontrolledValue(nativeSelect.value);
    }, [controlledValue, children]);

    useEffect(() => {
      if (!open) {
        return;
      }

      const handlePointerDown = (event: PointerEvent) => {
        const target = event.target as Node;

        if (
          triggerRef.current?.contains(target) ||
          listboxRef.current?.contains(target)
        ) {
          return;
        }

        closeListbox();
      };
      const handleViewportChange = () => updatePosition();

      document.addEventListener("pointerdown", handlePointerDown, true);
      window.addEventListener("resize", handleViewportChange);
      window.addEventListener("scroll", handleViewportChange, true);

      return () => {
        document.removeEventListener(
          "pointerdown",
          handlePointerDown,
          true,
        );
        window.removeEventListener("resize", handleViewportChange);
        window.removeEventListener("scroll", handleViewportChange, true);
      };
    }, [closeListbox, open, updatePosition]);

    useEffect(() => {
      if (!open || activeIndex < 0) {
        return;
      }

      listboxRef.current
        ?.querySelector<HTMLElement>(
          `[data-option-index="${activeIndex}"]`,
        )
        ?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, open]);

    return (
      <div className="ui-field">
        <span
          className={labelHidden ? "visually-hidden" : "ui-field-label"}
          id={labelId}
        >
          {label}
        </span>
        <span className="ui-select">
          <select
            {...props}
            aria-hidden="true"
            className="ui-select-native"
            defaultValue={defaultValue}
            disabled={disabled}
            id={`${selectId}-native`}
            ref={setNativeRef}
            required={required}
            tabIndex={-1}
            value={value}
            onBlur={onBlur}
            onChange={(event) => {
              setUncontrolledValue(event.target.value);
              onChange?.(event);
            }}
          >
            {children}
          </select>
          <button
            aria-activedescendant={
              open && activeIndex >= 0
                ? `${selectId}-option-${activeIndex}`
                : undefined
            }
            aria-controls={listboxId}
            aria-describedby={descriptionId}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-invalid={Boolean(error)}
            aria-labelledby={`${labelId} ${valueId}`}
            aria-required={required}
            className={[
              "ui-input",
              "ui-input--select",
              "ui-select-trigger",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={disabled}
            id={selectId}
            ref={triggerRef}
            role="combobox"
            type="button"
            onBlur={(event) => {
              const nativeSelect = nativeRef.current;

              if (!nativeSelect) {
                return;
              }

              nativeSelect.dispatchEvent(
                new FocusEvent("focusout", {
                  bubbles: true,
                  relatedTarget: event.relatedTarget,
                }),
              );
            }}
            onClick={() => {
              if (open) {
                closeListbox();
              } else {
                openListbox();
              }
            }}
            onKeyDown={handleTriggerKeyDown}
          >
            <span className="ui-select-value" id={valueId}>
              {selectedOption
                ? triggerContent ?? (triggerVisualOnly && optionVisuals?.[selectedOption.value] ? <span aria-label={selectedOption.text}>{optionVisuals[selectedOption.value]}</span> : renderOptionContent(selectedOption))
                : null}
            </span>
            <ChevronDown
              className="ui-select-icon"
              aria-hidden="true"
              size={18}
            />
          </button>
        </span>
        {error || hint ? (
          <span
            className={`ui-field-message${error ? " ui-field-message--error" : ""}`}
            id={descriptionId}
          >
            {error ?? hint}
          </span>
        ) : null}
        {open && portalHost && position
          ? createPortal(
              <div
                aria-labelledby={labelId}
                className={`ui-select-listbox custom-scrollbar ${listboxClassName}`}
                id={listboxId}
                ref={listboxRef}
                role="listbox"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeListbox();
                    triggerRef.current?.focus();
                  }
                }}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== triggerRef.current) closeListbox();
                }}
                style={
                  {
                    "--ui-select-listbox-max-height": `${position.maxHeight}px`,
                    left: position.left,
                    top: position.top,
                    transform: position.transform,
                    width: position.width,
                  } as CSSProperties
                }
              >
                {options.map((option, index) => {
                  const selected = option.value === selectedValue;
                  const active = index === activeIndex;

                  const removeAction = optionRemoveActions?.[option.value];
                  const optionButton = (
                    <button
                      aria-disabled={option.disabled}
                      aria-selected={selected}
                      className="ui-select-option"
                      data-active={active}
                      data-option-index={index}
                      disabled={option.disabled}
                      id={`${selectId}-option-${index}`}
                      key={`${option.value}-${index}`}
                      role="option"
                      tabIndex={-1}
                      type="button"
                      onClick={() => commitValue(option.value)}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => {
                        if (!option.disabled) {
                          setActiveIndex(index);
                        }
                      }}
                    >
                      <span>{renderOptionContent(option)}</span>
                      {selected ? (
                        <Check
                          className="ui-select-option-check"
                          aria-hidden="true"
                          size={18}
                        />
                      ) : null}
                    </button>
                  );
                  return removeAction ? (
                    <div className="ui-select-option-row" key={`${option.value}-${index}`} role="presentation">
                      {optionButton}
                      <button
                        type="button"
                        className="ui-select-option-remove"
                        aria-label={removeAction.label}
                        title={removeAction.label}
                        disabled={option.disabled}
                        onClick={() => {
                          closeListbox();
                          triggerRef.current?.focus();
                          removeAction.onRemove();
                        }}
                      ><X size={16} aria-hidden="true" /></button>
                    </div>
                  ) : optionButton;
                })}
              </div>,
              portalHost,
            )
          : null}
      </div>
    );
  },
);
