import { MarksIcon } from "@/components/ui/marks-icon";
import { CircleAlert, LockKeyhole, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { getText } from "@/i18n/get-text";

export function CollectionStatus({ status, empty, onRetry }: {
  status: "loading" | "ready" | "error" | "signedOut";
  empty: boolean;
  onRetry: () => void;
}) {
  if (status === "loading") return <LoadingState label={getText("collections.loading")} rows={empty ? 3 : 1} />;
  if (status === "ready" && !empty) return null;
  const state = status === "ready" ? "empty" : status;
  const Icon = state === "error" ? CircleAlert : state === "signedOut" ? LockKeyhole : MarksIcon;
  return (
    <div className="collection-status" data-state={state} role={state === "error" ? "alert" : "status"}>
      <EmptyState
        icon={<Icon size={26} />}
        title={getText(`collections.${state}Title`)}
        description={getText(`collections.${state}`)}
        action={state === "error" ? (
          <Button variant="secondary" onClick={onRetry}>
            <RefreshCw aria-hidden="true" size={16} />{getText("collections.retry")}
          </Button>
        ) : undefined}
      />
    </div>
  );
}
