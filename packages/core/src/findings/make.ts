import type {
  Confidence,
  Evidence,
  Finding,
  FindingCategory,
  Location,
  Origin,
  Severity,
} from "../ir/types.js";
import { shortHash } from "../util/hash.js";

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export interface FindingInput {
  prefix: string;
  key: string;
  title: string;
  category: FindingCategory;
  ruleId: string;
  severity: Severity;
  confidence: Confidence;
  origin?: Origin;
  explanation: string;
  evidence: Evidence[];
  locations: Location[];
  remediation: string;
  limitations: string[];
  tags?: string[];
}

export function makeFinding(i: FindingInput): Finding {
  return {
    id: `RL-${i.prefix}-${shortHash(`${i.ruleId}|${i.key}`, 8)}`,
    title: i.title,
    category: i.category,
    ruleId: i.ruleId,
    severity: i.severity,
    confidence: i.confidence,
    origin: i.origin ?? "observed",
    classification: null,
    explanation: i.explanation,
    evidence: i.evidence,
    locations: i.locations,
    remediation: i.remediation,
    limitations: i.limitations,
    tags: i.tags ?? [],
  };
}

export function sortFindings(list: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();
  for (const f of list) if (!seen.has(f.id)) seen.set(f.id, f);
  return [...seen.values()].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.id.localeCompare(b.id),
  );
}
