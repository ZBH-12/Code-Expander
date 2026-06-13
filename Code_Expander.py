import argparse
import re
from pathlib import Path
import pyperclip

class Expander:
    def __init__(self, libs: list[Path]):
        self.libs = [lib.resolve() for lib in libs]
        self.included = set()
        self.customlib = re.compile(r'^\s*#include\s*[<"]([^">]+)[">]')

    def ignored(self, line: str) -> bool:
        line = line.strip()
        if line == "#pragma once":
            return True
        return False

    def find_lib(self, libname: Path, curdir: Path | None = None) -> Path:
        if curdir is not None:
            path = (curdir / libname).resolve()
            if path.is_file():
                return path

        for lib in self.libs:
            path = (lib / libname).resolve()
            if path.is_file():
                return path

        return None

    def expand_lib(self, libpath: Path) -> list[str]:
        libpath = libpath.resolve()
        if libpath in self.included:
            return []
        self.included.add(libpath)

        with open(libpath, "r", encoding="utf-8") as f:
            source = f.read()
        result = []
        path_str = str(libpath).replace('\\', '/')
        curdir = libpath.parent

        linenum = 0
        for line in source.splitlines():
            linenum += 1
            if self.ignored(line):
                continue

            mtch = self.customlib.match(line)
            if mtch:
                header = Path(mtch.group(1))
                path = self.find_lib(header, curdir)
                if path is not None:
                    result.extend(self.expand_lib(path))
                else:
                    result.append(line)

            else:
                result.append(line)
        return result

    def expand_code(self, filename: str) -> str:
        originname = filename
        filename = str(Path(filename).resolve())
        with open(filename, "r", encoding="utf-8") as file:
            src = file.read()
        result = []

        linenum = 0
        for line in src.splitlines():
            linenum += 1
            mtch = self.customlib.match(line)

            if mtch:
                header = Path(mtch.group(1))
                lib = self.find_lib(header, Path(filename).parent)
                if lib is not None:
                    result.append('')
                    result.extend(self.expand_lib(lib))
                    result.append(f'#line {linenum + 1} "{originname}"')
                    result.append('')
                else:
                    result.append(line)

            else:
                result.append(line)
        return '\n'.join(result)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Code Expander'
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        '-c',
        '--console',
        action='store_true',
        help='Print to Console'
    )
    group.add_argument(
        '-C',
        '--clipboard',
        action='store_true',
        help='Paste to Clipboard'
    )
    group.add_argument(
        '-o',
        '--output',
        help='Print to File'
    )
    parser.add_argument(
        '--version',
        action='version',
        version='Code Expander v0.1.0'
    )
    parser.add_argument(
        '--lib',
        action='append',
        help='Path to Custom Library'
    )
    parser.add_argument(
        'source',
        help='Source File'
    )

    args = parser.parse_args()
    libs = []
    if args.lib:
        libs.extend(Path(path) for path in args.lib)
    libs.append(Path.cwd())

    expander = Expander(libs)
    src = Path(args.source)
    if not src.is_file():
        parser.error(f'Source File not Found: {src}')
    try:
        output = expander.expand_code(src)
    except FileNotFoundError as err:
        parser.error(str(err))

    if args.console:
        print(output)
    elif args.clipboard:
        pyperclip.copy(output)
    elif args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(output)
    else:
        with open('expanded.cpp', 'w', encoding='utf-8') as f:
            f.write(output)