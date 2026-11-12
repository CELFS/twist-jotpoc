import { Underline } from "lucide-react";
import { BeeIcon } from "./bee-icon";

export function MarksIcon({ size = 18 }: { size?: number }) {
  return <svg aria-hidden="true" width={size + 6} height={size} viewBox="0 0 32 24">
    <Underline x={0} y={1} width={17} height={21} />
    <BeeIcon x={13} y={3} size={19} />
  </svg>;
}
