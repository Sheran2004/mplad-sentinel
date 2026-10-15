export type Filters = {
  q: string; state: string; workType: string; fy: string; severity: string; flag: string; mpKey: string;
  photo: "" | "yes" | "no"; minAmount: string; sort: "risk" | "amount" | "date"; dir: "asc" | "desc"; page: number;
};

export const DEFAULT_FILTERS: Filters = {
  q: "", state: "", workType: "", fy: "", severity: "flagged", flag: "", mpKey: "", photo: "", minAmount: "", sort: "risk", dir: "desc", page: 0,
};

export function toRequest(f: Filters, pageSize = 25) {
  return {
    q: f.q, state: f.state, workType: f.workType, fy: f.fy, severity: f.severity, flag: f.flag, mpKey: f.mpKey,
    photo: f.photo || undefined, minAmount: f.minAmount === "" ? undefined : Number(f.minAmount),
    sort: f.sort, dir: f.dir, page: f.page, pageSize,
  };
}
