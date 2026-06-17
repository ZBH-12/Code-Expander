"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CPlusPlusExpander = void 0;
class CPlusPlusExpander {
    constructor(libs, provider) {
        this.provider = provider;
        this.libs = libs.map(lib => this.provider.resolvePath('', lib));
        this.included = new Set();
        this.customlibRegex = /^\s*#include\s*[<"]([^">]+)[">]/;
    }
    isIgnored(line) {
        return line.trim() === '#pragma once';
    }
    findLib(libname, curdir) {
        if (curdir) {
            const pathWithCurdir = this.provider.resolvePath(curdir, libname);
            if (this.provider.isFile(pathWithCurdir)) {
                return pathWithCurdir;
            }
        }
        for (const lib of this.libs) {
            const pathWithLib = this.provider.resolvePath(lib, libname);
            if (this.provider.isFile(pathWithLib)) {
                return pathWithLib;
            }
        }
        return null;
    }
    expandLib(libpath) {
        const resolvedPath = this.provider.resolvePath('', libpath);
        if (this.included.has(resolvedPath)) {
            return [];
        }
        this.included.add(resolvedPath);
        const source = this.provider.readFile(resolvedPath);
        const result = [];
        const curdir = this.provider.getParentDir(resolvedPath);
        const lines = source.split(/\r?\n/);
        for (const line of lines) {
            if (this.isIgnored(line)) {
                continue;
            }
            const match = line.match(this.customlibRegex);
            if (match) {
                const header = match[1];
                const foundPath = this.findLib(header, curdir);
                if (foundPath !== null) {
                    result.push(...this.expandLib(foundPath));
                }
                else {
                    result.push(line);
                }
            }
            else {
                result.push(line);
            }
        }
        return result;
    }
    expandCode(filename) {
        const resolvedEntryPath = this.provider.resolvePath('', filename);
        const source = this.provider.readFile(resolvedEntryPath);
        const result = [];
        const entryDir = this.provider.getParentDir(resolvedEntryPath);
        const lines = source.split(/\r?\n/);
        let linenum = 0;
        for (const line of lines) {
            linenum++;
            const match = line.match(this.customlibRegex);
            if (match) {
                const header = match[1];
                const libPath = this.findLib(header, entryDir);
                if (libPath !== null) {
                    result.push('');
                    result.push(...this.expandLib(libPath));
                    result.push(`#line ${linenum + 1} "${filename}"`);
                    result.push('');
                }
                else {
                    result.push(line);
                }
            }
            else {
                result.push(line);
            }
        }
        return result.join('\n');
    }
}
exports.CPlusPlusExpander = CPlusPlusExpander;
//# sourceMappingURL=expander.js.map