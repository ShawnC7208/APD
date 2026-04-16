export type ValidationKind = "error" | "warning";
export type ValidationSource = "schema" | "graph" | "provenance" | "best-practice";
export type NodeType = "action" | "decision" | "approval" | "terminal";
export type Outcome = "success" | "failure" | "canceled";
export type AEROverallOutcome = Outcome | "partial";
export type ObservedVsInferred = "observed" | "inferred" | "authored";
export type SourceType = "observed" | "authored" | "converted" | "generated";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type RecoveryStrategy = "retry" | "ask-user" | "skip" | "abort" | "fallback";
export type AERSpecVersion = "0.1.0" | "0.2.0";
export type AERNodeOutcome = "completed" | "approved" | "rejected" | "failed" | "skipped" | "paused";
export type ApprovalDecision = "approved" | "denied" | "canceled";

export interface ValidationDiagnostic {
  kind: ValidationKind;
  source: ValidationSource;
  path: string;
  message: string;
}

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

export interface AERProcedureRef {
  kind: "agent-procedure";
  procedure_id: string;
  revision: string;
  spec_version: string;
}

export interface AERExecutor {
  agent: string;
  adapter: string;
  environment?: string;
}

export interface AERToolInvocationV01 {
  tool: string;
  duration_ms?: number;
}

export interface AERCheckResult {
  check: string;
  passed: boolean;
  evaluated_at?: string;
  evidence_refs?: string[];
}

export interface AERToolInvocationV02 extends AERToolInvocationV01 {
  started_at?: string;
  completed_at?: string;
  outcome?: Outcome;
  evidence_refs?: string[];
}

export interface AERExecutionError {
  code?: string;
  message: string;
  evidence_refs?: string[];
}

export interface AERRecoveryApplied {
  strategy: RecoveryStrategy;
  instructions?: string;
  evidence_refs?: string[];
}

export interface AERTransitionTaken {
  from: string;
  to: string;
  taken_at: string;
  condition?: string;
}

export interface AERApprovalV01 {
  node_id: string;
  approved_by: string;
  approved_at: string;
  comment?: string;
}

export interface AERApprovalV02 {
  node_id: string;
  decision: ApprovalDecision;
  decided_by: string;
  decided_at: string;
  comment?: string;
  evidence_refs?: string[];
}

export interface AEREvidence {
  id: string;
  type: string;
  reference: string;
}

export interface AERIntegrity {
  chain_hash: string;
  signature?: string;
}

export interface AERNodeExecutionV01 {
  node_id: string;
  entered_at: string;
  exited_at?: string;
  outcome: AERNodeOutcome;
  attempt: number;
  input_bindings?: Record<string, unknown>;
  output_bindings?: Record<string, unknown>;
  tool_invocations?: AERToolInvocationV01[];
  evidence_refs?: string[];
}

export interface AERNodeExecutionV02 extends AERNodeExecutionV01 {
  tool_invocations?: AERToolInvocationV02[];
  pre_state_check_results?: AERCheckResult[];
  completion_check_results?: AERCheckResult[];
  error?: AERExecutionError;
  recovery_applied?: AERRecoveryApplied;
}

export interface AERDocumentV01 {
  kind: "agent-execution-record";
  spec_version: "0.1.0";
  execution_id: string;
  procedure_ref: AERProcedureRef;
  executor: AERExecutor;
  started_at: string;
  completed_at?: string;
  overall_outcome: AEROverallOutcome;
  node_executions: AERNodeExecutionV01[];
  approvals: AERApprovalV01[];
  evidence: AEREvidence[];
  integrity: AERIntegrity;
  extensions: Record<string, unknown>;
}

export interface AERDocumentV02 {
  kind: "agent-execution-record";
  spec_version: "0.2.0";
  execution_id: string;
  procedure_ref: AERProcedureRef;
  executor: AERExecutor;
  started_at: string;
  completed_at?: string;
  overall_outcome: AEROverallOutcome;
  node_executions: AERNodeExecutionV02[];
  transitions_taken: AERTransitionTaken[];
  approvals: AERApprovalV02[];
  evidence: AEREvidence[];
  final_outputs?: Record<string, unknown>;
  integrity: AERIntegrity;
  extensions: Record<string, unknown>;
}

export type AERDocument = AERDocumentV01 | AERDocumentV02;

export interface ValidationResult {
  valid: boolean;
  diagnostics: ValidationDiagnostic[];
  document: APDDocument;
}

export interface AERValidationResult {
  valid: boolean;
  diagnostics: ValidationDiagnostic[];
  document: AERDocument;
}

export interface APDSummary {
  procedureId: string;
  title: string;
  revision: string;
  specVersion: string;
  startNode: string;
  nodeCounts: Record<NodeType, number>;
  nodeTotal: number;
  transitions: number;
  confidence: number | null;
  terminalOutcomes: Outcome[];
  pathPreview: string;
}

export interface AERSummary {
  executionId: string;
  specVersion: AERSpecVersion;
  procedureId: string | null;
  procedureRevision: string | null;
  procedureSpecVersion: string | null;
  overallOutcome: AEROverallOutcome;
  startedAt: string;
  completedAt: string | null;
  nodeExecutions: number;
  approvals: number;
  evidence: number;
  transitionsTaken: number | null;
  finalOutputKeys: string[];
}

export interface AERComparisonDifference {
  kind: string;
  path: string;
  message: string;
  severity: ValidationKind;
  expected?: unknown;
  actual?: unknown;
}

export interface AERComparisonResult {
  conforms: boolean;
  summary: {
    differenceCount: number;
    executedNodeCount: number;
    transitionsTaken: number;
    approvalCount: number;
  };
  differences: AERComparisonDifference[];
}

export interface SOPExportOptions {
  includeMetadataComments?: boolean;
  includeExamples?: boolean;
  includeTroubleshooting?: boolean;
}

export interface APDCreateOptions {
  procedureId: string;
  title: string;
  summary: string;
  revision?: string;
  entryConditions?: string[];
  inputsSchema?: Record<string, unknown>;
  outputsSchema?: Record<string, unknown>;
  entities?: Entity[];
  provenance?: Partial<Provenance> & Record<string, unknown>;
  extensions?: Record<string, unknown>;
  startNode?: string;
}

export interface CreateApdScaffoldOptions {
  procedureId?: string;
  procedure_id?: string;
  title?: string;
  summary?: string;
  revision?: string;
  sourceType?: SourceType;
  source_type?: SourceType;
  sourceSessionId?: string;
  source_session_id?: string;
  captureScope?: {
    applications: string[];
    keyFiles?: string[];
    key_files?: string[];
  };
  capture_scope?: {
    applications: string[];
    keyFiles?: string[];
    key_files?: string[];
  };
  producer?: string;
  observedVsInferredSummary?: string;
  observed_vs_inferred_summary?: string;
}

export interface RiskInput {
  level: RiskLevel;
  irreversible: boolean;
  confirmationRequired?: boolean;
  confirmation_required?: boolean;
  reason: string;
}

export interface BaseNodeInput {
  id: string;
  name: string;
  uses?: string[];
  produces?: string[];
  contextHints?: ContextHint[];
  context_hints?: ContextHint[];
  preStateChecks?: string[];
  pre_state_checks?: string[];
  completionChecks?: string[];
  completion_checks?: string[];
  recovery?: Recovery;
  risk?: RiskInput;
  evidence?: Evidence[];
  observedVsInferred?: ObservedVsInferred;
  observed_vs_inferred?: ObservedVsInferred;
  extensions?: Record<string, unknown>;
}

export interface ActionNodeInput extends BaseNodeInput {
  instruction: string;
}

export interface DecisionNodeInput extends BaseNodeInput {
  question: string;
  evaluationHint?: string;
  evaluation_hint?: string;
}

export interface ApprovalNodeInput extends BaseNodeInput {
  reason: string;
}

export interface TerminalNodeInput extends BaseNodeInput {
  outcome: Outcome;
}

export interface ConnectOptions {
  condition?: string;
  default?: boolean;
  observedVsInferred?: ObservedVsInferred;
  observed_vs_inferred?: ObservedVsInferred;
}

export interface AERRecorderStartOptions {
  executionId: string;
  procedureRef?: AERProcedureRef;
  procedure_ref?: AERProcedureRef;
  procedure?: APDDocument;
  apd?: APDDocument;
  executor: AERExecutor;
  startedAt?: string;
  started_at?: string;
  finalOutputs?: Record<string, unknown>;
  final_outputs?: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

export interface AERNodeTarget {
  nodeId: string;
  attempt?: number;
}

export interface AEREnterNodeOptions extends AERNodeTarget {
  node_id?: string;
  enteredAt?: string;
  entered_at?: string;
  outcome?: AERNodeOutcome;
  inputBindings?: Record<string, unknown>;
  input_bindings?: Record<string, unknown>;
  outputBindings?: Record<string, unknown>;
  output_bindings?: Record<string, unknown>;
  toolInvocations?: AERToolInvocationV02[];
  tool_invocations?: AERToolInvocationV02[];
  evidenceRefs?: string[];
  evidence_refs?: string[];
  preStateCheckResults?: AERCheckResult[];
  pre_state_check_results?: AERCheckResult[];
  completionCheckResults?: AERCheckResult[];
  completion_check_results?: AERCheckResult[];
}

export interface AERCheckResultOptions extends AERNodeTarget {
  node_id?: string;
  phase: "pre_state" | "completion";
  check: string;
  passed: boolean;
  evaluatedAt?: string;
  evaluated_at?: string;
  evidenceRefs?: string[];
  evidence_refs?: string[];
}

export interface AERToolInvocationOptions extends AERNodeTarget {
  node_id?: string;
  tool: string;
  startedAt?: string;
  started_at?: string;
  completedAt?: string;
  completed_at?: string;
  durationMs?: number;
  duration_ms?: number;
  outcome?: Outcome;
  evidenceRefs?: string[];
  evidence_refs?: string[];
}

export interface AERApprovalDecisionOptions {
  nodeId: string;
  node_id?: string;
  decision?: ApprovalDecision;
  decidedBy: string;
  decided_by?: string;
  decidedAt?: string;
  decided_at?: string;
  comment?: string;
  evidenceRefs?: string[];
  evidence_refs?: string[];
}

export interface AERTransitionTakenOptions {
  from: string;
  to: string;
  takenAt?: string;
  taken_at?: string;
  condition?: string;
}

export interface AERExitNodeOptions extends AERNodeTarget {
  node_id?: string;
  exitedAt?: string;
  exited_at?: string;
  outcome?: AERNodeOutcome;
  inputBindings?: Record<string, unknown>;
  input_bindings?: Record<string, unknown>;
  outputBindings?: Record<string, unknown>;
  output_bindings?: Record<string, unknown>;
  evidenceRefs?: string[];
  evidence_refs?: string[];
  error?: AERExecutionError;
  recoveryApplied?: AERRecoveryApplied;
  recovery_applied?: AERRecoveryApplied;
}

export interface AERFinalizeOptions {
  overallOutcome?: AEROverallOutcome;
  overall_outcome?: AEROverallOutcome;
  completedAt?: string;
  completed_at?: string;
  finalOutputs?: Record<string, unknown>;
  final_outputs?: Record<string, unknown>;
  integrity?: AERIntegrity;
  extensions?: Record<string, unknown>;
}

export declare class APD {
  static create(options: APDCreateOptions): APD;
  static from(input: string | Buffer | APDDocument): APD;
  setStartNode(nodeId: string): this;
  addAction(input: ActionNodeInput): this;
  addDecision(input: DecisionNodeInput): this;
  addApproval(input: ApprovalNodeInput): this;
  addTerminal(input: TerminalNodeInput): this;
  connect(from: string, to: string, options?: ConnectOptions): this;
  getNode(nodeId: string): APDNode;
  getDefaultTransition(nodeId: string): Transition | null;
  validate(options?: { strict?: boolean }): ValidationResult;
  toJSON(): APDDocument;
  toString(): string;
}

export declare class AERRecorder {
  constructor(options?: AERRecorderStartOptions | null);
  startExecution(options: AERRecorderStartOptions): this;
  addEvidence(evidence: AEREvidence): this;
  enterNode(options: AEREnterNodeOptions): { nodeId: string; attempt: number };
  recordCheckResult(options: AERCheckResultOptions): this;
  recordToolInvocation(options: AERToolInvocationOptions): this;
  recordApprovalDecision(options: AERApprovalDecisionOptions): this;
  recordTransition(options: AERTransitionTakenOptions): this;
  exitNode(options: AERExitNodeOptions): this;
  finalize(options?: AERFinalizeOptions): AERDocumentV02;
  toJSON(): AERDocumentV02;
  toString(): string;
}

export declare function loadSchema(): Record<string, unknown>;
export declare function loadApdSchema(): Record<string, unknown>;
export declare function loadAerSchema(version?: AERSpecVersion): Record<string, unknown>;
export declare function createApdScaffold(options?: CreateApdScaffoldOptions): APDDocument;
export declare function parseApd(input: string | Buffer | APDDocument): APDDocument;
export declare function parseAer(input: string | Buffer | AERDocument): AERDocument;
export declare function validateApd(input: string | Buffer | APDDocument, options?: { strict?: boolean }): ValidationResult;
export declare function validateAer(input: string | Buffer | AERDocument, options?: { strict?: boolean }): AERValidationResult;
export declare function summarizeApd(input: string | Buffer | APDDocument): APDSummary;
export declare function summarizeAer(input: string | Buffer | AERDocument): AERSummary;
export declare function compareAerToApd(
  apdInput: string | Buffer | APDDocument,
  aerInput: string | Buffer | AERDocument
): AERComparisonResult;
export declare function toSopMarkdown(input: string | Buffer | APDDocument, options?: SOPExportOptions): string;
export declare function toMermaid(input: string | Buffer | APDDocument): string;
export declare function toSvg(input: string | Buffer | APDDocument): string;
export declare function graphDiagnostics(document: APDDocument): ValidationDiagnostic[];
export declare function provenanceDiagnostics(document: APDDocument): ValidationDiagnostic[];
export declare function bestPracticeDiagnostics(document: APDDocument): ValidationDiagnostic[];
