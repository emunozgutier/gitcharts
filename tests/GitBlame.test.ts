import test from 'node:test';
import assert from 'node:assert/strict';
import { GitBlame, GitBlameChain, BlameLine } from '../src/components/gitComponents/GitBlame';

// Helper to ignore order and lineNumber
function assertBlameEqual(actual: BlameLine[], expected: Omit<BlameLine, 'lineNumber'>[]) {
  const normalize = (arr: any[]) => 
    arr.map(item => ({ lineContent: item.lineContent, sourceTime: item.sourceTime }))
       .sort((a, b) => a.lineContent.localeCompare(b.lineContent) || a.sourceTime - b.sourceTime);
       
  assert.deepEqual(normalize(actual), normalize(expected));
}

test('GitBlame basic line tracking', () => {
  const time0 = 'line1\nline2\nline3';
  const time1 = 'line1\nline3\nline4';
  
  const result = GitBlame(time0, time1);
  assertBlameEqual(result, [
    { lineContent: 'line1', sourceTime: 0 },
    { lineContent: 'line3', sourceTime: 0 },
    { lineContent: 'line4', sourceTime: 1 }
  ]);
});

test('GitBlame ignores empty lines', () => {
  const time0 = 'line1\n\nline2';
  const time1 = '\nline1\n\nline3\n ';
  
  const result = GitBlame(time0, time1);
  assertBlameEqual(result, [
    { lineContent: 'line1', sourceTime: 0 },
    { lineContent: 'line3', sourceTime: 1 }
  ]);
});

test('GitBlame handles duplicate lines correctly', () => {
  const time0 = 'duplicate line\nother line';
  const time1 = 'duplicate line\nduplicate line\nduplicate line';
  
  const result = GitBlame(time0, time1);
  assertBlameEqual(result, [
    { lineContent: 'duplicate line', sourceTime: 0 },
    { lineContent: 'duplicate line', sourceTime: 1 },
    { lineContent: 'duplicate line', sourceTime: 1 }
  ]);
});

test('GitBlame handles multiple available copies from time 0', () => {
  const time0 = 'dup\ndup\ndup';
  const time1 = 'dup\ndup';
  
  const result = GitBlame(time0, time1);
  assertBlameEqual(result, [
    { lineContent: 'dup', sourceTime: 0 },
    { lineContent: 'dup', sourceTime: 0 }
  ]);
});

test('GitBlameChain sequential line tracking', () => {
  const time0 = 'line1\nline2\nline3';
  const time1 = 'line1\nline3\nline4';
  const time2 = 'line1\nline4\nline5';
  const time3 = 'line1\nline5\nline6';
  
  const blame1 = GitBlame(time0, time1);
  const blame2 = GitBlameChain(blame1, time2);
  const blame3 = GitBlameChain(blame2, time3);
  
  assertBlameEqual(blame3, [
    { lineContent: 'line1', sourceTime: 0 },
    { lineContent: 'line5', sourceTime: 2 },
    { lineContent: 'line6', sourceTime: 3 }
  ]);
});

test('GitBlameChain with duplicate lines across times', () => {
  const time0 = 'dup';
  const time1 = 'dup\ndup';
  const time2 = 'dup\ndup\ndup';
  
  const blame1 = GitBlame(time0, time1);
  const blame2 = GitBlameChain(blame1, time2);
  
  assertBlameEqual(blame2, [
    { lineContent: 'dup', sourceTime: 0 },
    { lineContent: 'dup', sourceTime: 1 },
    { lineContent: 'dup', sourceTime: 2 }
  ]);
});

test('GitBlame performance test with 3 large files (~100k lines)', () => {
  const NUM_LINES = 100000;
  const deleteRate = 0.1;
  const moveRate = 0.1;
  const addRate = 0.1;

  function generateNextVersion(previousContent: string, delR: number, movR: number, addR: number): string {
    let lines = previousContent.split('\n').filter(l => l.trim() !== '');

    // 1. Delete
    const numToDelete = Math.floor(lines.length * delR);
    let indices = Array.from({length: lines.length}, (_, i) => i);
    for(let i = 0; i < numToDelete; i++) {
        let randIdx = i + Math.floor(Math.random() * (lines.length - i));
        let temp = indices[i];
        indices[i] = indices[randIdx];
        indices[randIdx] = temp;
    }
    let toDelete = new Set(indices.slice(0, numToDelete));
    let afterDelete = lines.filter((_, i) => !toDelete.has(i));

    // 2. Move
    const numToMove = Math.floor(afterDelete.length * movR);
    indices = Array.from({length: afterDelete.length}, (_, i) => i);
    for(let i = 0; i < numToMove; i++) {
        let randIdx = i + Math.floor(Math.random() * (afterDelete.length - i));
        let temp = indices[i];
        indices[i] = indices[randIdx];
        indices[randIdx] = temp;
    }
    let toMove = new Set(indices.slice(0, numToMove));
    let movingLines = afterDelete.filter((_, i) => toMove.has(i));
    let afterExtract = afterDelete.filter((_, i) => !toMove.has(i));

    let insertions: string[][] = Array.from({length: afterExtract.length + 1}, () => []);
    for (let line of movingLines) {
        let insertIdx = Math.floor(Math.random() * (afterExtract.length + 1));
        insertions[insertIdx].push(line);
    }
    let afterMove: string[] = [];
    for (let i = 0; i <= afterExtract.length; i++) {
        afterMove.push(...insertions[i]);
        if (i < afterExtract.length) {
            afterMove.push(afterExtract[i]);
        }
    }

    // 3. Add
    const numToAdd = Math.floor(afterMove.length * addR);
    let addInsertions: string[][] = Array.from({length: afterMove.length + 1}, () => []);
    for(let i = 0; i < numToAdd; i++) {
        let insertIdx = Math.floor(Math.random() * (afterMove.length + 1));
        addInsertions[insertIdx].push(`newLine-${Math.random().toString(36).substring(2)}`);
    }
    let finalArray: string[] = [];
    for (let i = 0; i <= afterMove.length; i++) {
        finalArray.push(...addInsertions[i]);
        if (i < afterMove.length) {
            finalArray.push(afterMove[i]);
        }
    }

    return finalArray.join('\n');
  }

  const lines0 = Array.from({ length: NUM_LINES }, (_, i) => `line-${i}-${Math.random().toString(36).substring(2)}`);
  const fileAtime0 = lines0.join('\n');

  console.time('Generate fileAtime1');
  const fileAtime1 = generateNextVersion(fileAtime0, deleteRate, moveRate, addRate);
  console.timeEnd('Generate fileAtime1');

  console.time('Generate fileAtime2');
  const fileAtime2 = generateNextVersion(fileAtime1, deleteRate, moveRate, addRate);
  console.timeEnd('Generate fileAtime2');

  console.time('Process file 0 -> 1');
  const blame1 = GitBlame(fileAtime0, fileAtime1);
  console.timeEnd('Process file 0 -> 1');

  console.time('Process file 1 -> 2');
  const blame2 = GitBlameChain(blame1, fileAtime2);
  console.timeEnd('Process file 1 -> 2');
  
  assert.ok(blame2.length > 0);
  console.log(`Lines in final result: ${blame2.length}`);
});
