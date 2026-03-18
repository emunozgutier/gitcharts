const _ = require('lodash');

function getLinesThatSurvivedOriginal(fileBefore, fileAfter) {
    const survivingLines = [];
    const notFoundLines = [];
    const pool = [...fileBefore.filelines];

    for (const line of fileAfter.filelines) {
        const idx = pool.findIndex(pl => pl.content === line.content);
        if (idx !== -1) {
            survivingLines.push(pool[idx]);
            pool.splice(idx, 1);
        } else {
            notFoundLines.push(line);
        }
    }

    return [
        survivingLines.length,
        {
            filename: fileAfter.filename,
            filelines: notFoundLines
        }
    ];
}

function getLinesThatSurvivedOptimized(fileBefore, fileAfter) {
    const poolGroups = _.groupBy(fileBefore.filelines, 'content');
    const notFoundLines = [];
    let survivingCount = 0;

    for (const line of fileAfter.filelines) {
        const group = poolGroups[line.content];
        if (group && group.length > 0) {
            survivingCount++;
            group.shift();
        } else {
            notFoundLines.push(line);
        }
    }

    return [
        survivingCount,
        {
            filename: fileAfter.filename,
            filelines: notFoundLines
        }
    ];
}

const testCases = [
    {
        name: "Identical files",
        before: { filename: "a", filelines: [{ content: "line1", period: "P1" }, { content: "line2", period: "P1" }] },
        after: { filename: "a", filelines: [{ content: "line1", period: "P2" }, { content: "line2", period: "P2" }] }
    },
    {
        name: "New line added",
        before: { filename: "a", filelines: [{ content: "line1", period: "P1" }] },
        after: { filename: "a", filelines: [{ content: "line1", period: "P2" }, { content: "line2", period: "P2" }] }
    },
    {
        name: "Line deleted",
        before: { filename: "a", filelines: [{ content: "line1", period: "P1" }, { content: "line2", period: "P1" }] },
        after: { filename: "a", filelines: [{ content: "line1", period: "P2" }] }
    },
    {
        name: "Duplicate lines",
        before: { filename: "a", filelines: [{ content: "dup", period: "P1" }, { content: "dup", period: "P1" }, { content: "other", period: "P1" }] },
        after: { filename: "a", filelines: [{ content: "dup", period: "P2" }, { content: "new", period: "P2" }] }
    },
    {
        name: "Multiple duplicates matching",
        before: { filename: "a", filelines: [{ content: "dup", period: "P1" }, { content: "dup", period: "P1" }] },
        after: { filename: "a", filelines: [{ content: "dup", period: "P2" }, { content: "dup", period: "P2" }, { content: "dup", period: "P2" }] }
    },
    {
        name: "Empty files",
        before: { filename: "a", filelines: [] },
        after: { filename: "a", filelines: [] }
    }
];

testCases.forEach(tc => {
    const res1 = getLinesThatSurvivedOriginal(tc.before, tc.after);
    const res2 = getLinesThatSurvivedOptimized(tc.before, tc.after);

    const match = JSON.stringify(res1) === JSON.stringify(res2);
    console.log(`Test: ${tc.name} - ${match ? "PASSED" : "FAILED"}`);
    if (!match) {
        console.log("Original:", JSON.stringify(res1, null, 2));
        console.log("Optimized:", JSON.stringify(res2, null, 2));
    }
});
