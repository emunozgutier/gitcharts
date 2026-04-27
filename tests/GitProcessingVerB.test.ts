import test from 'node:test';
import assert from 'node:assert/strict';
import { GitBlame } from '../src/components/gitComponents/GitProcessingVerB';

test('GitBlame basic line tracking', () => {
  const time0 = 'line1\nline2\nline3';
  const time1 = 'line1\nline3\nline4';
  
  const result = GitBlame(time0, time1);
  assert.deepEqual(result, [
    { lineContent: 'line1', sourceTime: 0, lineNumberTime1: 1 },
    { lineContent: 'line3', sourceTime: 0, lineNumberTime1: 2 },
    { lineContent: 'line4', sourceTime: 1, lineNumberTime1: 3 }
  ]);
});

test('GitBlame ignores empty lines', () => {
  const time0 = 'line1\n\nline2';
  const time1 = '\nline1\n\nline3\n ';
  
  const result = GitBlame(time0, time1);
  assert.deepEqual(result, [
    { lineContent: 'line1', sourceTime: 0, lineNumberTime1: 2 },
    { lineContent: 'line3', sourceTime: 1, lineNumberTime1: 4 }
  ]);
});

test('GitBlame handles duplicate lines correctly', () => {
  // If there's 1 copy in time 0, only the first occurrence in time 1 comes from time 0
  const time0 = 'duplicate line\nother line';
  const time1 = 'duplicate line\nduplicate line\nduplicate line';
  
  const result = GitBlame(time0, time1);
  assert.deepEqual(result, [
    { lineContent: 'duplicate line', sourceTime: 0, lineNumberTime1: 1 },
    { lineContent: 'duplicate line', sourceTime: 1, lineNumberTime1: 2 },
    { lineContent: 'duplicate line', sourceTime: 1, lineNumberTime1: 3 }
  ]);
});

test('GitBlame handles multiple available copies from time 0', () => {
  const time0 = 'dup\ndup\ndup';
  const time1 = 'dup\ndup';
  
  const result = GitBlame(time0, time1);
  assert.deepEqual(result, [
    { lineContent: 'dup', sourceTime: 0, lineNumberTime1: 1 },
    { lineContent: 'dup', sourceTime: 0, lineNumberTime1: 2 }
  ]);
});
