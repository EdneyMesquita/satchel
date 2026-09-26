import type { SatchelRequest } from "../types";

interface StatusBarProps {
  fileName: string | null;
  environmentName: string;
  collectionsCount: number;
  requestsCount: number;
  selectedRequest?: SatchelRequest;
}

export function StatusBar({ fileName, environmentName, collectionsCount, requestsCount, selectedRequest }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <div className="status-bar-group">
        <span>{fileName ?? "Unsaved workspace"}</span>
        <span>{environmentName}</span>
      </div>
      <div className="status-bar-group">
        {selectedRequest && (
          <span>
            {selectedRequest.method} {selectedRequest.name}
          </span>
        )}
        <span>
          {collectionsCount} collection{collectionsCount === 1 ? "" : "s"} · {requestsCount} request{requestsCount === 1 ? "" : "s"}
        </span>
      </div>
    </footer>
  );
}
