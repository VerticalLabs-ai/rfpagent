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
              winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
                return `${timestamp} [${level}]: ${message} ${metaStr}`;
              })
            )
      ),
      transports: [
        new winston.transports.Console(),
        ...(process.env.NODE_ENV === 'production'
          ? [
              new winston.transports.File({ 
                filename: 'logs/error.log', 
                level: 'error',
                maxsize: 10485760, // 10MB
                maxFiles: 5
              }),
              new winston.transports.File({ 
                filename: 'logs/combined.log',
                maxsize: 10485760, // 10MB
                maxFiles: 5
              }),
            ]
          : []),
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
   * Format log for development environment
   */
  private formatDevelopmentLog(entry: LogEntry): void {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m', // Green
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      fatal: '\x1b[35m', // Magenta
    };
    const reset = '\x1b[0m';

    const levelColor = colors[entry.level];
    const levelStr = `[${entry.level.toUpperCase()}]`.padEnd(8);
    const timeStr = new Date(entry.timestamp).toLocaleTimeString();

    let logMessage = `${levelColor}${levelStr}${reset} ${timeStr} - ${entry.message}`;

    // Add context if present
    if (entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = Object.entries(entry.context)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
      logMessage += ` [${contextStr}]`;
    }

    // Add metadata if present
    if (entry.metadata) {
      logMessage += `\n  ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    // Add error if present
    if (entry.error) {
      logMessage += `\n  Error: ${entry.error.name} - ${entry.error.message}`;
      if (entry.error.stack) {
        logMessage += `\n${entry.error.stack}`;
      }
    }

    console.log(logMessage);
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
