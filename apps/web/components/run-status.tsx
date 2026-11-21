import { cn } from "@/lib/utils";

export type Run = {
  id: number;
  mode: "scrape+ingest" | "ingest" | "curator";
  status: "running" | "succeeded" | "failed";
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
  corpusVersion: number | null;
  listed: number;
  added: number;
  updated: number;
  unchanged: number;
  withdrawn: number;
  failed: number;
  flagged: number;
  error: string | null;
  requests: number | null;
};

export function RunStatus({ status }: { status: Run["status"] }) {
  return (
    <span className={cn("chip", status === "succeeded" ? "tag-pass" : status === "failed" ? "tag-fail" : "tag-unk")}>
      {status === "running" ? "Running" : status === "succeeded" ? "Succeeded" : "Failed"}
    </span>
  );
}
