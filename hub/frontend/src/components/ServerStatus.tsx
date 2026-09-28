import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@components/ui";

/** Online / offline / unknown pill for a registered server. */
export function ServerStatusBadge({ status }: { status: string }) {
  if (status === "online") {
    return (
      <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3" />}>
        Online
      </Badge>
    );
  }
  if (status === "offline") {
    return (
      <Badge tone="danger" icon={<XCircle className="h-3 w-3" />}>
        Offline
      </Badge>
    );
  }
  return (
    <Badge icon={<AlertCircle className="h-3 w-3" />} title="The Hub has not been able to reach this server yet.">
      Unknown
    </Badge>
  );
}
