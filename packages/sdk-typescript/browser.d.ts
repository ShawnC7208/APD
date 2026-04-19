export type NodeType = "action" | "decision" | "approval" | "terminal";
export type Outcome = "success" | "failure" | "canceled";
export type ObservedVsInferred = "observed" | "inferred" | "authored";
export type SourceType = "observed" | "authored" | "converted" | "generated";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type RecoveryStrategy = "retry" | "ask-user" | "skip" | "abort" | "fallback";

export interface ContextHint {
  type: string;
  value: string;
}

export interface Evidence {
  type: string;
  reference: string;
}

export interface Recovery {
  strategy: RecoveryStrategy;
  instructions: string;
}

export interface Risk {
  level: RiskLevel;
  irreversible: boolean;
  confirmation_required: boolean;
  reason: string;
}

export interface Entity {
  id: string;
  type: string;
  name: string;
  description: string;
  source_hint?: string;
  observed_value?: string;
}

export interface Transition {
  from: string;
  to: string;
  condition?: string;
  default: boolean;
  observed_vs_inferred: ObservedVsInferred;
}

export interface BaseNode {
  id: string;
  type: NodeType;
  name: string;
  uses?: string[];
  produces?: string[];
  context_hints?: ContextHint[];
  pre_state_checks?: string[];
  completion_checks?: string[];
  recovery?: Recovery;
  risk?: Risk;
  evidence?: Evidence[];
  observed_vs_inferred: ObservedVsInferred;
  extensions?: Record<string, unknown>;
}

export interface ActionNode extends BaseNode {
  type: "action";
  instruction: string;
}

export interface DecisionNode extends BaseNode {
  type: "decision";
  question: string;
  evaluation_hint?: string;
}

export interface ApprovalNode extends BaseNode {
  type: "approval";
  approval_required: true;
  reason: string;
}

export interface TerminalNode extends BaseNode {
  type: "terminal";
  outcome: Outcome;
}

export type APDNode = ActionNode | DecisionNode | ApprovalNode | TerminalNode;

export interface Confidence {
  overall: number;
  per_node: Array<{ node_id: string; confidence: number }>;
}

export interface Provenance {
  producer: string;
  source_type: SourceType;
  source_session_id?: string;
  created_at: string;
  capture_scope?: {
    applications: string[];
    key_files: string[];
  };
  confidence: Confidence;
  observed_vs_inferred_summary: string;
}

export interface APDDocument {
  kind: "agent-procedure";
  spec_version: "0.1.0";
  procedure_id: string;
  revision: string;
  title: string;
  summary: string;
  entry_conditions: string[];
  inputs_schema: Record<string, unknown>;
  outputs_schema: Record<string, unknown>;
  entities: Entity[];
  procedure: {
    start_node: string;
    nodes: APDNode[];
    transitions: Transition[];
  };
  provenance: Provenance;
  extensions: Record<string, unknown>;
}

export interface SOPExportOptions {
  includeMetadataComments?: boolean;
  includeExamples?: boolean;
  includeTroubleshooting?: boolean;
}

export declare function parseApd(input: string | APDDocument): APDDocument;
export declare function toSopMarkdown(input: string | APDDocument, options?: SOPExportOptions): string;
