/**
 * testSql.ts — Node test helper for workbookSql tests.
 *
 * Calls configureSql() with a factory that loads the WASM binary from the
 * local sql.js package using readFileSync, which works in Node/vitest without
 * a browser asset server.
 *
 * Import this module (side-effect import) at the top of every test file that
 * exercises workbookSql functions so that configureSql is called once before
 * any test runs.
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import initSqlJs from 'sql.js';
import { configureSql } from './workbookSql';

const require = createRequire(import.meta.url);
const wasmPath: string = require.resolve('sql.js/dist/sql-wasm.wasm') as string;
const wasmBinary = new Uint8Array(readFileSync(wasmPath)).buffer as ArrayBuffer;

configureSql(() => initSqlJs({ wasmBinary }));
