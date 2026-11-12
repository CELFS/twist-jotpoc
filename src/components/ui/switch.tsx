
export type SwitchProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
};

export function Switch({
  checked,
  disabled = false,
  label,
  onCheckedChange,
}: SwitchProps) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className="ui-switch"
      data-checked={checked}
      disabled={disabled}
      role="switch"
      type="button"
      onClick={() => onCheckedChange(!checked)}
    >
      <span aria-hidden="true">
        <i className="ui-switch-robin-eye" />
        <i className="ui-switch-robin-wing" />
      </span>
    </button>
  );
}
