/**
 * Structured Logging Service with Winston
 * Provides consistent logging with levels, context, metadata, and correlation IDs
 */

import winston from 'winston';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  service?: string;
  module?: string;
  userId?: string;
  requestId?: string;
  correlationId?: string;
  sessionId?: string;
  agentId?: string;
  workflowId?: string;
  pipelineId?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private context: LogContext = {};
  private minLevel: LogLevel;
  private winstonLogger: winston.Logger;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  };

  constructor() {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    this.minLevel =
      envLevel || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

    this.winstonLogger = winston.createLogger({
      level: this.minLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        process.env.NODE_ENV === 'production'
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(
                ({ timestamp, level, message, ...meta }) => {
                  const metaStr = Object.keys(meta).length
                    ? JSON.stringify(meta, null, 2)
                    : '';
                  return `${timestamp} [${level}]: ${message} ${metaStr}`;
                }
              )
            )
      ),
      transports: [
        new winston.transports.Console(),
        // File-based logging disabled in production for containerized environments
        // Container orchestrators (Fly.io, Kubernetes, etc.) capture stdout/stderr
        // and provide centralized log aggregation services
      ],
    });
  }

  /**
   * Set global context for all logs
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Create child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger();
    childLogger.context = { ...this.context, ...context };
    childLogger.minLevel = this.minLevel;
    return childLogger;
  }

  /**
   * Debug level log
   */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  /**
   * Info level log
   */
  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  /**
   * Warning level log
   */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  /**
   * Error level log
   */
  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const errorData = error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : undefined;

    this.log('error', message, metadata, errorData);
  }

  /**
   * Fatal level log
   */
  fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
    const errorData = error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      : undefined;

    this.log('fatal', message, metadata, errorData);
  }

  /**
   * Core logging method using Winston
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    error?: LogEntry['error']
  ): void {
    // Check if level is enabled
    if (this.levels[level] < this.levels[this.minLevel]) {
      return;
    }

    const winstonLevel = level === 'fatal' ? 'error' : level;

    // Merge context and metadata
    const logData = {
      ...this.context,
      ...metadata,
      ...(error && { error }),
    };

    this.winstonLogger.log(winstonLevel, message, logData);
  }

  /**
   * Log performance metrics
   */
  performance(
    operation: string,
    durationMs: number,
    metadata?: Record<string, any>
  ): void {
    this.info(`Performance: ${operation}`, {
      duration: durationMs,
      unit: 'ms',
      ...metadata,
    });
  }

  /**
   * Log API request/response
   */
  http(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number
  ): void {
    const level =
      statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `${method} ${path}`, {
      statusCode,
      duration: durationMs,
      method,
      path,
    });
  }

  /**
   * Log database query
   */
  query(
    query: string,
    durationMs: number,
    metadata?: Record<string, any>
  ): void {
    this.debug(`Database query completed`, {
      query: query.substring(0, 100), // Truncate long queries
      duration: durationMs,
      ...metadata,
    });
  }

  /**
   * Log agent activity
   */
  agent(agentId: string, action: string, metadata?: Record<string, any>): void {
    this.info(`Agent ${action}`, {
      agentId,
      action,
      ...metadata,
    });
  }

  /**
   * Log workflow events
   */
  workflow(
    workflowId: string,
    event: string,
    metadata?: Record<string, any>
  ): void {
    this.info(`Workflow ${event}`, {
      workflowId,
      event,
      ...metadata,
    });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export factory function for creating child loggers
export function createLogger(context: LogContext): Logger {
  return logger.child(context);
}
