"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const expander_1 = require("./expander");
// Implement the IFileProvider using the native Node/VS Code APIs
class VSCodeFileProvider {
    isFile(filePath) {
        try {
            return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
        }
        catch {
            return false;
        }
    }
    readFile(filePath) {
        return fs.readFileSync(filePath, 'utf-8');
    }
    resolvePath(base, ...parts) {
        if (base) {
            return path.resolve(base, ...parts);
        }
        return path.resolve(...parts);
    }
    getParentDir(filePath) {
        return path.dirname(filePath);
    }
}
function activate(context) {
    const provider = new VSCodeFileProvider();
    // Command 1: Inline C++ code to a newly created file
    let expandFileCmd = vscode.commands.registerCommand('cpp-header-expander.expandFile', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showErrorMessage('No active text editor open. Select a C++ file first.');
            return;
        }
        const doc = activeEditor.document;
        const currentFilePath = doc.fileName;
        // Get user configured libraries and standard search settings
        const config = vscode.workspace.getConfiguration('cppHeaderExpander');
        const libraryPaths = config.get('librarySearchPaths') || [];
        const defaultOutput = config.get('defaultOutputFilename') || 'expanded_output.cpp';
        // Build lists of libraries. In VS Code, we resolve paths relative to the current workspace root if needed
        const wsFolders = vscode.workspace.workspaceFolders;
        const resolvedLibs = [];
        for (const libPath of libraryPaths) {
            if (path.isAbsolute(libPath)) {
                resolvedLibs.push(libPath);
            }
            else if (wsFolders && wsFolders.length > 0) {
                resolvedLibs.push(path.resolve(wsFolders[0].uri.fsPath, libPath));
            }
            else {
                // Fallback to active document folder context
                resolvedLibs.push(path.resolve(path.dirname(currentFilePath), libPath));
            }
        }
        // Always fallback search to the current active file's parent folder and workspace folder
        resolvedLibs.push(path.dirname(currentFilePath));
        if (wsFolders && wsFolders.length > 0) {
            resolvedLibs.push(wsFolders[0].uri.fsPath);
        }
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Expanding C++ Headers...",
            cancellable: false
        }, async () => {
            try {
                const expander = new expander_1.CPlusPlusExpander(resolvedLibs, provider);
                const result = expander.expandCode(currentFilePath);
                // Open expanded file in memory
                const document = await vscode.workspace.openTextDocument({
                    content: result,
                    language: 'cpp'
                });
                await vscode.window.showTextDocument(document);
                vscode.window.showInformationMessage('Successfully expanded C++ headers! Save the newly generated file.');
            }
            catch (error) {
                vscode.window.showErrorMessage('Failed to expand headers: ' + error.message);
            }
        });
    });
    // Command 2: Inline C++ code directly into the system clipboard
    let expandToClipboardCmd = vscode.commands.registerCommand('cpp-header-expander.expandToClipboard', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showErrorMessage('No active text editor open.');
            return;
        }
        const doc = activeEditor.document;
        const currentFilePath = doc.fileName;
        const config = vscode.workspace.getConfiguration('cppHeaderExpander');
        const libraryPaths = config.get('librarySearchPaths') || [];
        const wsFolders = vscode.workspace.workspaceFolders;
        const resolvedLibs = [];
        for (const libPath of libraryPaths) {
            if (path.isAbsolute(libPath)) {
                resolvedLibs.push(libPath);
            }
            else if (wsFolders && wsFolders.length > 0) {
                resolvedLibs.push(path.resolve(wsFolders[0].uri.fsPath, libPath));
            }
            else {
                resolvedLibs.push(path.resolve(path.dirname(currentFilePath), libPath));
            }
        }
        resolvedLibs.push(path.dirname(currentFilePath));
        try {
            const expander = new expander_1.CPlusPlusExpander(resolvedLibs, provider);
            const result = expander.expandCode(currentFilePath);
            // Copy directly to the integrated VS Code clipboard API
            await vscode.env.clipboard.writeText(result);
            vscode.window.showInformationMessage('Expanded C++ code successfully copied to the clipboard!');
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to expand headers: ' + error.message);
        }
    });
    context.subscriptions.push(expandFileCmd, expandToClipboardCmd);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map