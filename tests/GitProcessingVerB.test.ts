import test from 'node:test';
import assert from 'node:assert/strict';
import { GitBlame, GitBlameChain } from '../src/components/gitComponents/GitProcessingVerB';

test('GitBlame basic line tracking', () => {
  const time0 = 'line1\nline2\nline3';
  const time1 = 'line1\nline3\nline4';
  
  const result = GitBlame(time0, time1);
  assert.deepEqual(result, [
    { lineContent: 'line1', sourceTime: 0, lineNumber: 1 },
    { lineContent: 'line3', sourceTime: 0, lineNumber: 2 },
    { lineContent: 'line4', sourceTime: 1, lineNumber: 3 }
  ]);
});

test('GitBlame ignores empty lines', () => {
  const time0 = 'line1\n\nline2';
  const time1 = '\nline1\n\nline3\n ';
  
  const result = GitBlame(time0, time1);
  assert.deepEqual(result, [
    { lineContent: 'line1', sourceTime: 0, lineNumber: 2 },
    { lineContent: 'line3', sourceTime: 1, lineNumber: 4 }
  ]);
});

test('GitBlame handles duplicate lines correctly', () => {
  // If there's 1 copy in time 0, only the first occurrence in time 1 comes from time 0
  const time0 = 'duplicate line\nother line';
  const time1 = 'duplicate line\nduplicate line\nduplicate line';
  
  const result = GitBlame(time0, time1);
  assert.deepEqual(result, [
    { lineContent: 'duplicate line', sourceTime: 0, lineNumber: 1 },
    { lineContent: 'duplicate line', sourceTime: 1, lineNumber: 2 },
    { lineContent: 'duplicate line', sourceTime: 1, lineNumber: 3 }
  ]);
});

test('GitBlame handles multiple available copies from time 0', () => {
  const time0 = 'dup\ndup\ndup';
  const time1 = 'dup\ndup';
  
  const result = GitBlame(time0, time1);
  assert.deepEqual(result, [
    { lineContent: 'dup', sourceTime: 0, lineNumber: 1 },
    { lineContent: 'dup', sourceTime: 0, lineNumber: 2 }
  ]);
});

test('GitBlameChain sequential line tracking', () => {
  const time0 = 'line1\nline2\nline3';
  const time1 = 'line1\nline3\nline4';
  const time2 = 'line1\nline4\nline5';
  const time3 = 'line1\nline5\nline6';
  
  const blame1 = GitBlame(time0, time1); // time 0 and time 1
  const blame2 = GitBlameChain(blame1, time2); // time 2
  const blame3 = GitBlameChain(blame2, time3); // time 3
  
  assert.deepEqual(blame3, [
    { lineContent: 'line1', sourceTime: 0, lineNumber: 1 },
    { lineContent: 'line5', sourceTime: 2, lineNumber: 2 },
    { lineContent: 'line6', sourceTime: 3, lineNumber: 3 }
  ]);
});

test('GitBlameChain with duplicate lines across times', () => {
  const time0 = 'dup';
  const time1 = 'dup\ndup'; // One from time0, one from time1
  const time2 = 'dup\ndup\ndup'; // Two from previous, one from time2
  
  const blame1 = GitBlame(time0, time1);
  const blame2 = GitBlameChain(blame1, time2);
  
  assert.deepEqual(blame2, [
    { lineContent: 'dup', sourceTime: 0, lineNumber: 1 },
    { lineContent: 'dup', sourceTime: 1, lineNumber: 2 },
    { lineContent: 'dup', sourceTime: 2, lineNumber: 3 }
  ]);
});
