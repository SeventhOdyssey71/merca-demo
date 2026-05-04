import { describe, expect, it } from 'vitest';
import { decodeMoveAbort } from '../src/merca/errors.js';

const SAMPLE_4005 = `ExecutionError: ExecutionError { inner: ExecutionErrorInner { kind: MoveAbort(MoveLocation { module: ModuleId { address: 4826a4d88d8ec8d40417a20ec7f07007f486404e06a09834a7e1e0c1756e9a6f, name: Identifier("index") }, function: 38, instruction: 9, function_name: Some("get") }, 4005), source: Some(VMError { ... }), command: Some(1) } }`;

const SAMPLE_4005_BARE = `MoveAbort(MoveLocation { module: ModuleId { address: 4826a4d88d8ec8d40417a20ec7f07007f486404e06a09834a7e1e0c1756e9a6f, name: Identifier("index") }, function: 38, instruction: 9, function_name: Some("get") }, 4005) in command 1`;

const SAMPLE_3109 = `MoveAbort(MoveLocation { module: ModuleId { address: …, name: Identifier("market") }, function: 12, instruction: 5, function_name: Some("buy_full") }, 3109) in command 0`;

describe('decodeMoveAbort', () => {
  it('returns null for non-abort strings', () => {
    expect(decodeMoveAbort(null)).toBeNull();
    expect(decodeMoveAbort('')).toBeNull();
    expect(decodeMoveAbort('something else went wrong')).toBeNull();
  });

  it('decodes ENotFound (index/4005)', () => {
    const d = decodeMoveAbort(SAMPLE_4005);
    expect(d).not.toBeNull();
    expect(d!.module).toBe('index');
    expect(d!.code).toBe(4005);
    expect(d!.name).toBe('ENotFound');
    expect(d!.function).toBe('get');
    expect(d!.hint).toMatch(/cadastral level/i);
  });

  it('decodes the bare gas-budget error form', () => {
    const d = decodeMoveAbort(SAMPLE_4005_BARE);
    expect(d).not.toBeNull();
    expect(d!.code).toBe(4005);
    expect(d!.module).toBe('index');
  });

  it('decodes EInsufficientPayment (market/3109)', () => {
    const d = decodeMoveAbort(SAMPLE_3109);
    expect(d).not.toBeNull();
    expect(d!.module).toBe('market');
    expect(d!.code).toBe(3109);
    expect(d!.name).toBe('EInsufficientPayment');
  });

  it('falls back to E<code> for unknown codes', () => {
    const raw = `MoveAbort(MoveLocation { module: ModuleId { address: …, name: Identifier("index") }, function: 1, instruction: 0, function_name: Some("zzz") }, 9999) in command 0`;
    const d = decodeMoveAbort(raw);
    expect(d!.name).toBe('E9999');
  });

  it('handles hex-rendered abort codes (0xFA5 = 4005)', () => {
    const raw = `MoveAbort(MoveLocation { module: ModuleId { address: 4826…, name: Identifier("index") }, function: 38, instruction: 9, function_name: Some("get") }, 0xFA5) in command 1`;
    const d = decodeMoveAbort(raw);
    expect(d).not.toBeNull();
    expect(d!.code).toBe(4005);
    expect(d!.name).toBe('ENotFound');
  });

  it('falls back to sub_status when the trailing code is missing', () => {
    const raw = `VMError { major_status: ABORTED, sub_status: Some(0xFA5), message: Some("boom"), location: Module(ModuleId { address: 4826…, name: Identifier("index") }) }`;
    const d = decodeMoveAbort(raw);
    expect(d).not.toBeNull();
    expect(d!.code).toBe(4005);
    expect(d!.name).toBe('ENotFound');
  });
});
