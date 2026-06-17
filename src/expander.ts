export interface IFileProvider {
  isFile(filePath: string): boolean;
  readFile(filePath: string): string;
  resolvePath(base: string, ...parts: string[]): string;
  getParentDir(filePath: string): string;
}

export class CPlusPlusExpander {
  private libs: string[];
  private included: Set<string>;
  private provider: IFileProvider;
  private customlibRegex: RegExp;

  constructor(libs: string[], provider: IFileProvider) {
    this.provider = provider;
    this.libs = libs.map(lib => this.provider.resolvePath('', lib));
    this.included = new Set<string>();
    this.customlibRegex = /^\s*#include\s*[<"]([^">]+)[">]/;
  }

  private isIgnored(line: string): boolean {
    return line.trim() === '#pragma once';
  }

  private findLib(libname: string, curdir?: string): string | null {
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

  private expandLib(libpath: string): string[] {
    const resolvedPath = this.provider.resolvePath('', libpath);
    if (this.included.has(resolvedPath)) {
      return [];
    }
    this.included.add(resolvedPath);

    const source = this.provider.readFile(resolvedPath);
    const result: string[] = [];
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
        } else {
          result.push(line);
        }
      } else {
        result.push(line);
      }
    }
    return result;
  }

  public expandCode(filename: string): string {
    const resolvedEntryPath = this.provider.resolvePath('', filename);
    const source = this.provider.readFile(resolvedEntryPath);
    const result: string[] = [];
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
        } else {
          result.push(line);
        }
      } else {
        result.push(line);
      }
    }

    return result.join('\n');
  }
}