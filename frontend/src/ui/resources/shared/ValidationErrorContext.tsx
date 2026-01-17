import React, { createContext, useContext, useMemo, useCallback } from 'react';

/**
 * Represents a single validation error from Kubernetes API
 */
export interface ValidationError {
  field: string;
  message: string;
  reason?: string;
}

/**
 * Represents the full error response from Kubernetes API
 */
export interface KubernetesError {
  message: string;
  reason?: string;
  code?: number;
  causes: ValidationError[];
}

/**
 * Parse a Kubernetes API error response into a structured format
 */
export function parseKubernetesError(error: unknown): KubernetesError | null {
  if (!error) return null;
  
  // Handle Error objects with response data
  const errorData = (error as { response?: { data?: unknown } }).response?.data || error;
  
  // Handle direct error objects
  if (typeof errorData === 'object' && errorData !== null) {
    const data = errorData as Record<string, unknown>;
    
    // Check if it's a Kubernetes Status object
    if (data.kind === 'Status' && data.status === 'Failure') {
      const causes: ValidationError[] = [];
      
      // Extract causes from details
      const details = data.details as { causes?: Array<{ field?: string; message?: string; reason?: string }> } | undefined;
      if (details?.causes && Array.isArray(details.causes)) {
        for (const cause of details.causes) {
          if (cause.field) {
            causes.push({
              field: cause.field,
              message: cause.message || 'Validation error',
              reason: cause.reason,
            });
          }
        }
      }
      
      return {
        message: String(data.message || 'Unknown error'),
        reason: data.reason as string | undefined,
        code: data.code as number | undefined,
        causes,
      };
    }
    
    // Handle generic error with message
    if (data.message) {
      return {
        message: String(data.message),
        reason: data.reason as string | undefined,
        code: data.code as number | undefined,
        causes: [],
      };
    }
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: error,
      causes: [],
    };
  }
  
  // Handle Error objects
  if (error instanceof Error) {
    return {
      message: error.message,
      causes: [],
    };
  }
  
  return null;
}

/**
 * Context value for validation errors
 */
interface ValidationErrorContextValue {
  /** The current validation errors */
  errors: ValidationError[];
  /** The main error message */
  errorMessage: string | null;
  /** The error reason/code */
  errorReason: string | null;
  /** Check if a field has an error */
  hasFieldError: (fieldPath: string) => boolean;
  /** Get error message for a field */
  getFieldError: (fieldPath: string) => string | null;
  /** Get all errors that match a field path prefix */
  getFieldErrors: (fieldPathPrefix: string) => ValidationError[];
  /** Clear all errors */
  clearErrors: () => void;
}

const ValidationErrorContext = createContext<ValidationErrorContextValue>({
  errors: [],
  errorMessage: null,
  errorReason: null,
  hasFieldError: () => false,
  getFieldError: () => null,
  getFieldErrors: () => [],
  clearErrors: () => {},
});

interface ValidationErrorProviderProps {
  error: KubernetesError | null;
  onClearErrors: () => void;
  children: React.ReactNode;
}

/**
 * Provider component for validation errors
 */
export const ValidationErrorProvider: React.FC<ValidationErrorProviderProps> = ({
  error,
  onClearErrors,
  children,
}) => {
  const errors = error?.causes || [];
  const errorMessage = error?.message || null;
  const errorReason = error?.reason || null;

  /**
   * Check if a field path has an error.
   * Supports exact match and prefix match (for nested fields).
   * 
   * Examples:
   * - hasFieldError("spec.replicas") matches "spec.replicas"
   * - hasFieldError("spec.template.spec.containers[0]") matches 
   *   "spec.template.spec.containers[0].volumeMounts[1].name"
   */
  const hasFieldError = useCallback((fieldPath: string): boolean => {
    return errors.some(e => {
      // Exact match
      if (e.field === fieldPath) return true;
      // Field starts with the path (for parent containers)
      if (e.field.startsWith(fieldPath + '.') || e.field.startsWith(fieldPath + '[')) return true;
      // Path starts with the field (checking parents of error field)
      if (fieldPath.startsWith(e.field + '.') || fieldPath.startsWith(e.field + '[')) return true;
      return false;
    });
  }, [errors]);

  /**
   * Get the error message for a specific field path.
   * Returns the first matching error message.
   */
  const getFieldError = useCallback((fieldPath: string): string | null => {
    const match = errors.find(e => e.field === fieldPath);
    return match?.message || null;
  }, [errors]);

  /**
   * Get all errors that match a field path prefix.
   * Useful for getting all errors within a container or section.
   */
  const getFieldErrors = useCallback((fieldPathPrefix: string): ValidationError[] => {
    return errors.filter(e => 
      e.field === fieldPathPrefix || 
      e.field.startsWith(fieldPathPrefix + '.') ||
      e.field.startsWith(fieldPathPrefix + '[')
    );
  }, [errors]);

  const value = useMemo<ValidationErrorContextValue>(() => ({
    errors,
    errorMessage,
    errorReason,
    hasFieldError,
    getFieldError,
    getFieldErrors,
    clearErrors: onClearErrors,
  }), [errors, errorMessage, errorReason, hasFieldError, getFieldError, getFieldErrors, onClearErrors]);

  return (
    <ValidationErrorContext.Provider value={value}>
      {children}
    </ValidationErrorContext.Provider>
  );
};

/**
 * Hook to access validation errors
 */
export function useValidationErrors() {
  return useContext(ValidationErrorContext);
}

/**
 * Hook to check if a specific field has an error
 * @param fieldPath - The field path to check (e.g., "spec.template.spec.containers[0].image")
 */
export function useFieldError(fieldPath: string) {
  const { hasFieldError, getFieldError, getFieldErrors } = useValidationErrors();
  
  return useMemo(() => ({
    hasError: hasFieldError(fieldPath),
    errorMessage: getFieldError(fieldPath),
    childErrors: getFieldErrors(fieldPath),
  }), [hasFieldError, getFieldError, getFieldErrors, fieldPath]);
}

/**
 * Helper to build a field path for array items
 */
export function fieldPath(base: string, ...parts: (string | number)[]): string {
  let path = base;
  for (const part of parts) {
    if (typeof part === 'number') {
      path += `[${part}]`;
    } else {
      path += `.${part}`;
    }
  }
  return path;
}
