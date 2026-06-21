export interface FlowLogContext {
  requestId?: string;
  correlationId?: string;
  route?: string;
  method?: string;
  // Route params can be string arrays in Express internals; keep union to avoid lossy logging in error paths.
  journeyId?: string | string[];
  stepId?: string | string[];
}

export function logFlowStage(
  stage: string,
  context: FlowLogContext,
  details?: Record<string, unknown>,
): void {
  // Keep a stable log envelope so demos and grep filters work across all stage events.
  const log = {
    timestamp: new Date().toISOString(),
    level: "info",
    message: "flow_stage",
    stage,
    requestId: context.requestId,
    correlationId: context.correlationId,
    method: context.method,
    route: context.route,
    journeyId: context.journeyId,
    stepId: context.stepId,
    ...(details ?? {}),
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(log));
}

export function logFlowError(
  stage: string,
  context: FlowLogContext,
  error: unknown,
  details?: Record<string, unknown>,
): void {
  // ApiError carries a code field; unknown errors still emit a useful message for diagnosis.
  const errorCode =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : undefined;
  const errorMessage = error instanceof Error ? error.message : "Unknown error";

  const log = {
    timestamp: new Date().toISOString(),
    level: "error",
    message: "flow_stage_error",
    stage,
    requestId: context.requestId,
    correlationId: context.correlationId,
    method: context.method,
    route: context.route,
    journeyId: context.journeyId,
    stepId: context.stepId,
    errorCode,
    errorMessage,
    ...(details ?? {}),
  };

  // eslint-disable-next-line no-console
  console.error(JSON.stringify(log));
}
