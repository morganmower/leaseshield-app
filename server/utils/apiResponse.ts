import { Response } from 'express';

/**
 * Standard API response types
 */

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

/**
 * Send a successful response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): void {
  res.status(statusCode).json({
    success: true,
    data,
    ...(message && { message }),
  } as SuccessResponse<T>);
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  error: string,
  statusCode: number = 500,
  details?: any
): void {
  res.status(statusCode).json({
    success: false,
    error,
    ...(details && { details }),
  } as ErrorResponse);
}

/**
 * Send a validation error response
 */
export function sendValidationError(
  res: Response,
  errors: Array<{ field: string; message: string }>
): void {
  sendError(res, 'Validation failed', 400, { errors });
}

/**
 * Send a not found response
 */
export function sendNotFound(
  res: Response,
  resource: string = 'Resource'
): void {
  sendError(res, `${resource} not found`, 404);
}

/**
 * Send an unauthorized response
 */
export function sendUnauthorized(
  res: Response,
  message: string = 'Unauthorized'
): void {
  sendError(res, message, 401);
}

/**
 * Send a forbidden response
 */
export function sendForbidden(
  res: Response,
  message: string = 'Forbidden'
): void {
  sendError(res, message, 403);
}

/**
 * Send a rate limit exceeded response
 */
export function sendRateLimitExceeded(
  res: Response,
  message: string = 'Too many requests. Please try again later.'
): void {
  sendError(res, message, 429);
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Send a paginated response
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  page: number,
  pageSize: number,
  totalItems: number
): void {
  const totalPages = Math.ceil(totalItems / pageSize);
  
  res.status(200).json({
    success: true,
    data,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  } as PaginatedResponse<T>);
}

/**
 * Calculate pagination offset
 */
export function getPaginationOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(
  page: any,
  pageSize: any
): { page: number; pageSize: number } | { error: string } {
  const parsedPage = parseInt(page, 10);
  const parsedPageSize = parseInt(pageSize, 10);

  if (isNaN(parsedPage) || parsedPage < 1) {
    return { error: 'Invalid page number' };
  }

  if (isNaN(parsedPageSize) || parsedPageSize < 1 || parsedPageSize > 100) {
    return { error: 'Invalid page size (must be between 1 and 100)' };
  }

  return { page: parsedPage, pageSize: parsedPageSize };
}

