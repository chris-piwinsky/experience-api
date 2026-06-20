import { readFileSync } from "fs";
import { join } from "path";

import { parse } from "yaml";

import type { CheckoutJourney, CheckoutStepId, ValidationIssue } from "../types/checkout";

type RuleOperator = "eq" | "in" | "regex" | "exists" | "gte";
type RuleAction = "block" | "warn" | "set_value";
type RuleStage = "step-update" | "validate" | "submit";

interface DynamicCondition {
  contextPath: string;
  operator: string;
  value: unknown;
}

interface DynamicRule {
  ruleId: string;
  enabled?: boolean;
  priority?: number;
  effective?: {
    from?: string | null;
    to?: string | null;
  };
  appliesTo?: {
    steps?: string[];
    channels?: string[];
    customerSegments?: string[];
  };
  conditions?: {
    match?: "all" | "any";
    rules?: DynamicCondition[];
  };
  action?: {
    type: string;
    code?: string;
    message?: string;
    targetPath?: string;
    value?: unknown;
    details?: {
      fieldPath?: string;
    };
  };
}

interface RulesConfig {
  policyVersion?: string;
  featureFlags?: {
    enableDynamicRules?: boolean;
    enableWarnings?: boolean;
    enableStepDependencies?: boolean;
  };
  ruleEvaluation?: {
    stopOnFirstBlock?: boolean;
    unknownOperatorBehavior?: "fail" | "ignore";
  };
  fieldRules?: Record<
    string,
    {
      required?: string[];
      formats?: Record<
        string,
        {
          type?: "enum" | "regex";
          allowed?: unknown[];
          pattern?: string;
          message?: string;
        }
      >;
    }
  >;
  eligibilityRules?: Array<{
    ruleId: string;
    enabled?: boolean;
    priority?: number;
    when?: {
      stepId?: string;
      field?: string;
      equals?: unknown;
      notEquals?: unknown;
      shippingStateIn?: string[];
    };
    outcome?: {
      code?: string;
      message?: string;
    };
  }>;
  stepDependencies?: Array<{
    ruleId: string;
    enabled?: boolean;
    priority?: number;
    when?: {
      currentStepId?: string;
      requiresCompletedSteps?: string[];
    };
    outcome?: {
      code?: string;
      message?: string;
    };
  }>;
  dynamicRules?: DynamicRule[];
}

interface RulesEvaluationResult {
  nextPayload: Record<string, unknown>;
  issues: ValidationIssue[];
}

const SUPPORTED_OPERATORS: RuleOperator[] = ["eq", "in", "regex", "exists", "gte"];
const SUPPORTED_ACTIONS: RuleAction[] = ["block", "warn", "set_value"];
const ALLOWED_SET_VALUE_TARGETS = new Set(["delivery.fee"]);

const BASE_STEP_PREREQUISITES: Partial<Record<CheckoutStepId, CheckoutStepId[]>> = {
  "shipping-address": ["cart"],
  "delivery-method": ["shipping-address"],
  "payment-method": ["delivery-method"],
  "billing-address": ["payment-method"],
  "promo-code": ["cart"],
  "review-submit": ["cart", "shipping-address", "delivery-method", "payment-method"],
};

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function getByPath(source: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = source;

  for (const part of parts) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function toRegExp(pattern: string): RegExp {
  if (pattern.startsWith("(?i)")) {
    return new RegExp(pattern.slice(4), "i");
  }

  return new RegExp(pattern);
}

export class RulesService {
  private readonly configError?: string;
  private readonly config: RulesConfig;

  constructor(configPath = join(process.cwd(), "config", "rules.yaml")) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      this.config = (parse(raw) ?? {}) as RulesConfig;
      this.validateConfig(this.config);
    } catch (error) {
      this.config = {};
      this.configError = error instanceof Error ? error.message : "Unknown rules config error";
    }
  }

  evaluateForStepUpdate(
    journey: CheckoutJourney,
    stepId: CheckoutStepId,
    payload: Record<string, unknown>,
  ): RulesEvaluationResult {
    return this.evaluate(journey, "step-update", stepId, payload);
  }

  evaluateForValidate(journey: CheckoutJourney): RulesEvaluationResult {
    return this.evaluate(journey, "validate", undefined, {});
  }

  evaluateForSubmit(journey: CheckoutJourney): RulesEvaluationResult {
    return this.evaluate(journey, "submit", undefined, {});
  }

  private evaluate(
    journey: CheckoutJourney,
    stage: RuleStage,
    currentStepId: CheckoutStepId | undefined,
    payload: Record<string, unknown>,
  ): RulesEvaluationResult {
    if (this.configError) {
      return {
        nextPayload: payload,
        issues: [
          {
            code: "RULES_CONFIG_ERROR",
            message: `Rules configuration is unavailable: ${this.configError}`,
            ruleId: "RULES-CONFIG-LOAD",
            severity: "error",
          },
        ],
      };
    }

    const stopOnFirstBlock = this.config.ruleEvaluation?.stopOnFirstBlock ?? true;
    const enableWarnings = this.config.featureFlags?.enableWarnings ?? true;
    const issues: ValidationIssue[] = [];
    const nextPayload = { ...payload };
    const activeJourney = this.buildProjectedJourney(journey, currentStepId, nextPayload);
    const context = this.buildContext(activeJourney, currentStepId);

    const pushIssue = (issue: ValidationIssue): boolean => {
      if (issue.severity === "warning" && !enableWarnings) {
        return false;
      }

      issues.push(issue);
      return issue.severity !== "warning" && stopOnFirstBlock;
    };

    for (const issue of this.evaluateStepDependencies(activeJourney, stage, currentStepId)) {
      if (pushIssue(issue)) {
        return { nextPayload, issues };
      }
    }

    for (const issue of this.evaluateFieldRules(activeJourney, stage, currentStepId)) {
      if (pushIssue(issue)) {
        return { nextPayload, issues };
      }
    }

    for (const issue of this.evaluateEligibilityRules(activeJourney, stage, currentStepId)) {
      if (pushIssue(issue)) {
        return { nextPayload, issues };
      }
    }

    const dynamicOutcome = this.evaluateDynamicRules(context, stage, currentStepId, nextPayload);
    for (const issue of dynamicOutcome.issues) {
      if (pushIssue(issue)) {
        return { nextPayload, issues };
      }
    }

    return { nextPayload, issues };
  }

  private evaluateStepDependencies(
    journey: CheckoutJourney,
    stage: RuleStage,
    currentStepId: CheckoutStepId | undefined,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const builtInDependencies = Object.entries(BASE_STEP_PREREQUISITES)
      .map(([step, prerequisites]) => ({ stepId: step as CheckoutStepId, prerequisites: prerequisites ?? [] }))
      .sort((a, b) => a.stepId.localeCompare(b.stepId));

    for (const dependency of builtInDependencies) {
      if (stage === "step-update" && dependency.stepId !== currentStepId) {
        continue;
      }

      const shouldValidate =
        stage === "step-update" || journey.steps[dependency.stepId].completed || dependency.stepId === "review-submit";
      if (!shouldValidate) {
        continue;
      }

      for (const requiredStep of dependency.prerequisites) {
        if (!journey.steps[requiredStep].completed) {
          issues.push({
            code: "STEP_CONFLICT",
            message: `${requiredStep} must be completed before ${dependency.stepId}`,
            stepId: dependency.stepId,
            fieldPath: `steps.${dependency.stepId}`,
            ruleId: `BASE-DEPENDENCY-${dependency.stepId.toUpperCase()}`,
            severity: "error",
          });
          break;
        }
      }
    }

    if (!this.config.featureFlags?.enableStepDependencies) {
      return issues;
    }

    const configDependencies = toArray<NonNullable<RulesConfig["stepDependencies"]>[number]>(
      this.config.stepDependencies,
    )
      .filter((rule) => rule.enabled !== false)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.ruleId.localeCompare(b.ruleId));

    for (const rule of configDependencies) {
      const targetStep = rule.when?.currentStepId as CheckoutStepId | undefined;
      if (!targetStep) {
        continue;
      }
      if (stage === "step-update" && targetStep !== currentStepId) {
        continue;
      }

      const shouldValidate = stage === "step-update" || journey.steps[targetStep]?.completed;
      if (!shouldValidate) {
        continue;
      }

      const missing = toArray<string>(rule.when?.requiresCompletedSteps).find(
        (step) => !journey.steps[step as CheckoutStepId]?.completed,
      );

      if (missing) {
        issues.push({
          code: rule.outcome?.code ?? "STEP_CONFLICT",
          message: rule.outcome?.message ?? `${missing} must be completed before ${targetStep}`,
          stepId: targetStep,
          fieldPath: `steps.${targetStep}`,
          ruleId: rule.ruleId,
          severity: "error",
        });
      }
    }

    return issues;
  }

  private evaluateFieldRules(
    journey: CheckoutJourney,
    stage: RuleStage,
    currentStepId: CheckoutStepId | undefined,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const stepIds = Object.keys(this.config.fieldRules ?? {}).sort();

    for (const stepId of stepIds) {
      if (stage === "step-update" && stepId !== currentStepId) {
        continue;
      }

      const step = journey.steps[stepId as CheckoutStepId];
      if (!step || !step.completed) {
        continue;
      }

      const payload = asRecord(step.payload);
      const stepRules = this.config.fieldRules?.[stepId];
      const requiredFields = toArray<string>(stepRules?.required);

      for (const field of requiredFields) {
        const value = payload[field];
        if (value === undefined || value === null || value === "") {
          issues.push({
            code: "VALIDATION_ERROR",
            message: `${field} is required`,
            stepId,
            fieldPath: `${stepId}.${field}`,
            ruleId: `FIELD-REQUIRED-${stepId}-${field}`,
            severity: "error",
          });
        }
      }

      const formats = stepRules?.formats ?? {};
      for (const [field, formatRule] of Object.entries(formats)) {
        const value = payload[field];
        if (value === undefined || value === null) {
          continue;
        }

        if (formatRule.type === "enum") {
          const allowed = toArray<unknown>(formatRule.allowed);
          if (!allowed.includes(value)) {
            issues.push({
              code: "VALIDATION_ERROR",
              message: formatRule.message ?? `${field} must be one of ${allowed.join(", ")}`,
              stepId,
              fieldPath: `${stepId}.${field}`,
              ruleId: `FIELD-FORMAT-${stepId}-${field}`,
              severity: "error",
            });
          }
        }

        if (formatRule.type === "regex" && typeof value === "string") {
          const pattern = formatRule.pattern ?? "";
          const regex = toRegExp(pattern);
          if (!regex.test(value)) {
            issues.push({
              code: "VALIDATION_ERROR",
              message: formatRule.message ?? `${field} has an invalid format`,
              stepId,
              fieldPath: `${stepId}.${field}`,
              ruleId: `FIELD-FORMAT-${stepId}-${field}`,
              severity: "error",
            });
          }
        }
      }
    }

    return issues;
  }

  private evaluateEligibilityRules(
    journey: CheckoutJourney,
    stage: RuleStage,
    currentStepId: CheckoutStepId | undefined,
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const shippingState = asRecord(journey.steps["shipping-address"].payload).state;

    const rules = toArray<NonNullable<RulesConfig["eligibilityRules"]>[number]>(this.config.eligibilityRules)
      .filter((rule) => rule.enabled !== false)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.ruleId.localeCompare(b.ruleId));

    for (const rule of rules) {
      const targetStep = rule.when?.stepId;
      if (!targetStep) {
        continue;
      }

      if (stage === "step-update" && targetStep !== currentStepId) {
        continue;
      }

      if (stage !== "step-update" && !journey.steps[targetStep as CheckoutStepId]?.completed) {
        continue;
      }

      const targetPayload = asRecord(journey.steps[targetStep as CheckoutStepId]?.payload);
      const field = rule.when?.field ?? "";
      const fieldValue = targetPayload[field];

      if (rule.when?.equals !== undefined && fieldValue !== rule.when.equals) {
        continue;
      }
      if (rule.when?.notEquals !== undefined && fieldValue === rule.when.notEquals) {
        continue;
      }

      const validShippingState = toArray<string>(rule.when?.shippingStateIn);
      if (validShippingState.length > 0 && !validShippingState.includes(String(shippingState ?? ""))) {
        continue;
      }

      issues.push({
        code: rule.outcome?.code ?? "CUSTOMER_NOT_ELIGIBLE",
        message: rule.outcome?.message ?? "Customer is not eligible for selected option",
        stepId: targetStep,
        fieldPath: `${targetStep}.${field}`,
        ruleId: rule.ruleId,
        severity: "error",
      });
    }

    return issues;
  }

  private evaluateDynamicRules(
    context: Record<string, unknown>,
    stage: RuleStage,
    currentStepId: CheckoutStepId | undefined,
    nextPayload: Record<string, unknown>,
  ): RulesEvaluationResult {
    const issues: ValidationIssue[] = [];
    if (!this.config.featureFlags?.enableDynamicRules) {
      return { nextPayload, issues };
    }

    const now = new Date();
    const rules = toArray<DynamicRule>(this.config.dynamicRules)
      .filter((rule) => rule.enabled !== false)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.ruleId.localeCompare(b.ruleId));

    for (const rule of rules) {
      const stepScope = toArray<string>(rule.appliesTo?.steps);
      if (stepScope.length > 0) {
        if (stage === "step-update" && currentStepId && !stepScope.includes(currentStepId)) {
          continue;
        }
        if (stage === "validate" && !stepScope.some((step) => this.stepExistsInContext(context, step))) {
          continue;
        }
        if (stage === "submit" && !stepScope.includes("submit") && !stepScope.some((step) => this.stepExistsInContext(context, step))) {
          continue;
        }
      }

      const effectiveFrom = rule.effective?.from ? new Date(rule.effective.from) : null;
      const effectiveTo = rule.effective?.to ? new Date(rule.effective.to) : null;
      if (effectiveFrom && now < effectiveFrom) {
        continue;
      }
      if (effectiveTo && now > effectiveTo) {
        continue;
      }

      if (stage === "step-update" && currentStepId && !this.canEvaluateDynamicRuleOnStepUpdate(rule, context, currentStepId)) {
        continue;
      }

      const matched = this.matchDynamicRule(rule, context);
      if (!matched) {
        continue;
      }

      const actionType = String(rule.action?.type ?? "") as RuleAction;
      if (!SUPPORTED_ACTIONS.includes(actionType)) {
        issues.push({
          code: "RULES_CONFIG_ERROR",
          message: `Unsupported action type in ${rule.ruleId}: ${String(rule.action?.type ?? "")}`,
          ruleId: rule.ruleId,
          severity: "error",
        });
        continue;
      }

      if (actionType === "set_value") {
        const targetPath = String(rule.action?.targetPath ?? "");
        if (!ALLOWED_SET_VALUE_TARGETS.has(targetPath)) {
          continue;
        }

        if (targetPath === "delivery.fee") {
          nextPayload.fee = rule.action?.value;
        }

        continue;
      }

      const issue: ValidationIssue = {
        code: rule.action?.code ?? "VALIDATION_ERROR",
        message: rule.action?.message ?? "Rule condition was matched",
        ruleId: rule.ruleId,
        fieldPath: rule.action?.details?.fieldPath,
        severity: actionType === "warn" ? "warning" : "error",
      };

      issues.push(issue);
    }

    return { nextPayload, issues };
  }

  private matchDynamicRule(rule: DynamicRule, context: Record<string, unknown>): boolean {
    const conditionRules = toArray<DynamicCondition>(rule.conditions?.rules);
    if (conditionRules.length === 0) {
      return false;
    }

    const match = rule.conditions?.match ?? "all";
    const unknownOperatorBehavior = this.config.ruleEvaluation?.unknownOperatorBehavior ?? "fail";

    const evaluate = (condition: DynamicCondition): boolean => {
      const operator = String(condition.operator) as RuleOperator;
      if (!SUPPORTED_OPERATORS.includes(operator)) {
        if (unknownOperatorBehavior === "ignore") {
          return false;
        }
        return false;
      }

      const actual = getByPath(context, condition.contextPath);
      if (operator === "eq") {
        return actual === condition.value;
      }
      if (operator === "in") {
        return toArray<unknown>(condition.value).includes(actual);
      }
      if (operator === "regex") {
        if (typeof actual !== "string" || typeof condition.value !== "string") {
          return false;
        }
        return toRegExp(condition.value).test(actual);
      }
      if (operator === "exists") {
        const exists = actual !== undefined && actual !== null && actual !== "";
        return exists === Boolean(condition.value);
      }
      if (operator === "gte") {
        const actualNumber = Number(actual);
        const expectedNumber = Number(condition.value);
        return Number.isFinite(actualNumber) && Number.isFinite(expectedNumber) && actualNumber >= expectedNumber;
      }

      return false;
    };

    if (match === "any") {
      return conditionRules.some((condition) => evaluate(condition));
    }

    return conditionRules.every((condition) => evaluate(condition));
  }

  private buildProjectedJourney(
    journey: CheckoutJourney,
    currentStepId: CheckoutStepId | undefined,
    payload: Record<string, unknown>,
  ): CheckoutJourney {
    if (!currentStepId) {
      return journey;
    }

    return {
      ...journey,
      steps: {
        ...journey.steps,
        [currentStepId]: {
          ...journey.steps[currentStepId],
          completed: true,
          payload,
          updatedAt: new Date().toISOString(),
        },
      },
    };
  }

  private buildContext(
    journey: CheckoutJourney,
    currentStepId: CheckoutStepId | undefined,
  ): Record<string, unknown> {
    return {
      currentStepId,
      cart: asRecord(journey.steps.cart.payload),
      shipping: asRecord(journey.steps["shipping-address"].payload),
      delivery: asRecord(journey.steps["delivery-method"].payload),
      payment: asRecord(journey.steps["payment-method"].payload),
      billing: asRecord(journey.steps["billing-address"].payload),
      customer: {
        id: journey.customerId,
        segment: "standard",
      },
      request: {
        channel: "web",
      },
    };
  }

  private canEvaluateDynamicRuleOnStepUpdate(
    rule: DynamicRule,
    context: Record<string, unknown>,
    currentStepId: CheckoutStepId,
  ): boolean {
    const currentContextRoot = this.contextRootForStep(currentStepId);
    for (const condition of toArray<DynamicCondition>(rule.conditions?.rules)) {
      const root = condition.contextPath.split(".")[0] ?? "";
      if (root === currentContextRoot) {
        continue;
      }

      const value = getByPath(context, condition.contextPath);
      if (value === undefined || value === null || value === "") {
        return false;
      }
    }

    return true;
  }

  private contextRootForStep(stepId: CheckoutStepId): string {
    const roots: Record<CheckoutStepId, string> = {
      cart: "cart",
      "shipping-address": "shipping",
      "delivery-method": "delivery",
      "payment-method": "payment",
      "billing-address": "billing",
      "promo-code": "promo",
      "review-submit": "review",
    };

    return roots[stepId];
  }

  private stepExistsInContext(context: Record<string, unknown>, step: string): boolean {
    if (step === "submit") {
      return true;
    }

    const stepToContextPath: Record<string, string> = {
      cart: "cart",
      "shipping-address": "shipping",
      "delivery-method": "delivery",
      "payment-method": "payment",
      "billing-address": "billing",
    };

    const path = stepToContextPath[step];
    if (!path) {
      return false;
    }

    const value = getByPath(context, path);
    return typeof value === "object" && value !== null;
  }

  private validateConfig(config: RulesConfig): void {
    if (config.dynamicRules) {
      for (const rule of config.dynamicRules) {
        for (const condition of toArray<DynamicCondition>(rule.conditions?.rules)) {
          if (!SUPPORTED_OPERATORS.includes(String(condition.operator) as RuleOperator)) {
            throw new Error(`Unsupported operator in ${rule.ruleId}: ${String(condition.operator)}`);
          }
        }

        const actionType = String(rule.action?.type ?? "") as RuleAction;
        if (actionType && !SUPPORTED_ACTIONS.includes(actionType)) {
          throw new Error(`Unsupported action in ${rule.ruleId}: ${actionType}`);
        }
      }
    }
  }
}

export function createRulesService(): RulesService {
  return new RulesService();
}