// SPDX-License-Identifier: GPL-3.0-only
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const roots = ['src', 'backend'];
const sourcePattern = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const legacyImportPattern = /@timeax\/digital-service-engine/;
const legacyProductionBudget = 0;
const shippedEntrypoints = ['src/index.tsx', 'src/main.tsx'];
const localExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const importPattern = /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
        entries.map((entry) => {
            const target = path.join(directory, entry.name);
            return entry.isDirectory() ? walk(target) : [target];
        }),
    );
    return files.flat();
}

async function existingSource(candidate) {
    for (const extension of localExtensions) {
        const file = `${candidate}${extension}`;
        try {
            if ((await stat(file)).isFile()) return file;
        } catch {
            // Try the next supported source extension.
        }
    }
    for (const extension of localExtensions.slice(1)) {
        const file = path.join(candidate, `index${extension}`);
        try {
            if ((await stat(file)).isFile()) return file;
        } catch {
            // Try the next supported index source extension.
        }
    }
    return undefined;
}

async function resolveLocalImport(from, specifier) {
    if (specifier.startsWith('@/')) return existingSource(path.resolve('src', specifier.slice(2)));
    if (specifier.startsWith('.')) return existingSource(path.resolve(path.dirname(from), specifier));
    return undefined;
}

async function shippedSourceFiles() {
    const queue = shippedEntrypoints.map((entry) => path.resolve(entry));
    const visited = new Set();
    while (queue.length > 0) {
        const file = queue.shift();
        if (file === undefined || visited.has(file)) continue;
        visited.add(file);
        const source = await readFile(file, 'utf8');
        importPattern.lastIndex = 0;
        for (const match of source.matchAll(importPattern)) {
            const dependency = await resolveLocalImport(file, match[1] ?? match[2]);
            if (dependency !== undefined && !visited.has(dependency)) queue.push(dependency);
        }
    }
    return visited;
}

const files = (await Promise.all(roots.map(walk))).flat().filter((file) => sourcePattern.test(file));
const violations = [];
const productionLegacyImports = [];
const shippedFiles = await shippedSourceFiles();

for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (!legacyImportPattern.test(source)) continue;
    const normalized = file.replaceAll('\\', '/');
    const isTest = /\.(?:test|spec)\.[^.]+$/.test(normalized);
    if (!isTest) productionLegacyImports.push(normalized);
    if (shippedFiles.has(path.resolve(file))) {
        violations.push(`${normalized}: shipped entrypoints must not reach the legacy engine`);
    }
    if (normalized.startsWith('src/react/')) {
        violations.push(`${normalized}: canonical React bindings must not import the legacy engine`);
    }
}

if (productionLegacyImports.length > legacyProductionBudget) {
    violations.push(
        `production legacy imports increased from the migration baseline of ${legacyProductionBudget} to ${productionLegacyImports.length}`,
    );
}

if (violations.length > 0) {
    console.error(violations.join('\n'));
    process.exitCode = 1;
} else {
    console.log(`Boundary migration check passed (${productionLegacyImports.length}/${legacyProductionBudget} legacy production files remain).`);
}
