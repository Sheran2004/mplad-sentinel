export type Chamber = "LS" | "RS" | "unknown";
export type Severity = "critical" | "high" | "watch" | "clear";

/** One completed-work row from the MPLADS public dashboard, normalized. */
export type WorkRecord = {
  workCode: string; // e.g. WS/MP418/2024-2025/133409
  mpRef: string; // e.g. MP418
  fy: string; // e.g. 2024-2025 (financial year in the work code)
  workType: string; // text after the code
  category: string; // Normal/Others | Repair and Renovation | Trust and Society
  state: string;
  ida: string; // implementing district authority
  description: string | null;
  mpName: string;
  mpKey: string;
  chamber: Chamber;
  constituency: string | null;
  hasImage: boolean;
  completionDate: string; // YYYY-MM-DD
  amount: number | null; // INR disbursed; null if the source row has none
};

export type AllocationRecord = {
  id: number;
  chamber: "LS" | "RS";
  state: string;
  mpName: string;
  mpKey: string;
  constituency: string | null;
  memberType: string | null;
  allocated: number | null;
};

export type FlagCode =
  | "AMOUNT_OUTLIER"
  | "POSSIBLE_DUPLICATE"
  | "SAME_DAY_BATCH"
  | "HIGH_VALUE_NO_PHOTO"
  | "MISSING_AMOUNT"
  | "MISSING_DESCRIPTION"
  | "DATE_INTEGRITY";

export type Flag = {
  workCode: string;
  code: FlagCode;
  title: string;
  explanation: string;
  points: number;
  evidence: Record<string, unknown>;
};

export type ScoredWork = { workCode: string; risk: number; severity: Severity; flags: Flag[] };

export type QualityReport = {
  generatedFrom: { source: string; sourceUrl: string; retrievedDate: string; notice: string };
  rows: {
    lokSabhaExport: number;
    rajyaSabhaExport: number;
    unionUnique: number;
    overlapBetweenExports: number;
    duplicateRowsRemoved: number;
    unparsedWorkCodes: number;
  };
  attribution: {
    lokSabha: number;
    rajyaSabha: number;
    unknown: number;
    rajyaExportRowsMatchingRajyaSabhaMembers: number;
    rajyaExportRowsMatchingLokSabhaMembers: number;
  };
  missing: { amount: number; description: number; image: number; constituency: number };
  dateIssues: { beforeFinancialYear: number; afterRetrieval: number };
  findings: string[];
};
