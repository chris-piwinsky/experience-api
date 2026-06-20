export interface ApiErrorDetail {
  field?: string;
  reason?: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: ApiErrorDetail[];

  constructor(code: string, message: string, status: number, details?: ApiErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
