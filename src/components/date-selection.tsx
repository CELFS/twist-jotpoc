import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { DateWheelPicker } from "@/components/ui/date-wheel-picker";
import { getText } from "@/i18n/get-text";

export function DateSelection({ value, onChange, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(value);
  return <>
    <Button variant="ghost" disabled={disabled} aria-label={getText("client.date")}
      onClick={() => { setSelected(value); setOpen(true); }}>
      <CalendarDays size={16} /><time dateTime={value}>{value}</time>
    </Button>
    {open && <Drawer ariaLabel={getText("client.date")} onClose={() => setOpen(false)}
      contentClassName="custom-scrollbar" className="client-date-drawer"
      header={<h2>{getText("client.date")}</h2>}
      footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{getText("client.cancel")}</Button>
        <Button onClick={() => { onChange(selected); setOpen(false); }}>{getText("common.confirm")}</Button></>}>
      <DateWheelPicker value={selected} onValueChange={setSelected} />
    </Drawer>}
  </>;
}
