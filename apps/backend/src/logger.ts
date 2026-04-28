import pino from 'pino';
import type { Config } from './config.js';

export type Logger = pino.Logger;

export function createLogger(config: Config): Logger {
  return pino({
    level: config.LOG_LEVEL,
    // JSON to stdout (architecture line 426); Docker captures it.
  });
}
