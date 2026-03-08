import * as vscode from 'vscode';

let targetVirtualColumn = -1;
const paddedLines = new Set<string>();
let isExtensionEdit = false;

function getLineKey(document: vscode.TextDocument, line: number): string {
    return `${document.uri.toString()}:${line}`;
}

export function activate(context: vscode.ExtensionContext) {
    const toggleDisposable = vscode.commands.registerCommand('virtualspace.toggle', () => {
        const config = vscode.workspace.getConfiguration('virtualspace');
        const enabled = config.get<boolean>('enabled');
        config.update('enabled', !enabled, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Virtual Space ${!enabled ? 'Enabled' : 'Disabled'}`);
    });
    context.subscriptions.push(toggleDisposable);

    const isEnabled = () => vscode.workspace.getConfiguration('virtualspace').get<boolean>('enabled', true);

    context.subscriptions.push(vscode.commands.registerTextEditorCommand('virtualspace.moveRight', async (editor) => {
        if (!isEnabled()) {
            await vscode.commands.executeCommand('cursorRight');
            return;
        }

        isExtensionEdit = true;
        await editor.edit(editBuilder => {
            for (const sel of editor.selections) {
                const pos = sel.active;
                const line = editor.document.lineAt(pos.line);
                if (pos.character >= line.text.length) {
                    editBuilder.insert(pos, ' ');
                    paddedLines.add(getLineKey(editor.document, pos.line));
                }
            }
        }, { undoStopBefore: false, undoStopAfter: false });
        isExtensionEdit = false;

        await vscode.commands.executeCommand('cursorRight');
        updateTargetColumn(editor);
    }));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand('virtualspace.moveLeft', async (editor) => {
        if (!isEnabled()) {
            await vscode.commands.executeCommand('cursorLeft');
            return;
        }
        await vscode.commands.executeCommand('cursorLeft');
        updateTargetColumn(editor);
    }));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand('virtualspace.moveUp', async (editor) => {
        if (!isEnabled()) {
            await vscode.commands.executeCommand('cursorUp');
            return;
        }

        const targetCol = Math.max(targetVirtualColumn, Math.max(...editor.selections.map(s => s.active.character)));

        isExtensionEdit = true;
        await editor.edit(editBuilder => {
            for (const sel of editor.selections) {
                const pos = sel.active;
                if (pos.line > 0) {
                    const targetLine = pos.line - 1;
                    const line = editor.document.lineAt(targetLine);
                    if (line.text.length < targetCol) {
                        const spacesNeeded = targetCol - line.text.length;
                        editBuilder.insert(new vscode.Position(targetLine, line.text.length), ' '.repeat(spacesNeeded));
                        paddedLines.add(getLineKey(editor.document, targetLine));
                    }
                }
            }
        }, { undoStopBefore: false, undoStopAfter: false });
        isExtensionEdit = false;

        await vscode.commands.executeCommand('cursorUp');
        targetVirtualColumn = targetCol;
    }));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand('virtualspace.moveDown', async (editor) => {
        if (!isEnabled()) {
            await vscode.commands.executeCommand('cursorDown');
            return;
        }

        const targetCol = Math.max(targetVirtualColumn, Math.max(...editor.selections.map(s => s.active.character)));

        isExtensionEdit = true;
        await editor.edit(editBuilder => {
            for (const sel of editor.selections) {
                const pos = sel.active;
                if (pos.line < editor.document.lineCount - 1) {
                    const targetLine = pos.line + 1;
                    const line = editor.document.lineAt(targetLine);
                    if (line.text.length < targetCol) {
                        const spacesNeeded = targetCol - line.text.length;
                        editBuilder.insert(new vscode.Position(targetLine, line.text.length), ' '.repeat(spacesNeeded));
                        paddedLines.add(getLineKey(editor.document, targetLine));
                    }
                }
            }
        }, { undoStopBefore: false, undoStopAfter: false });
        isExtensionEdit = false;

        await vscode.commands.executeCommand('cursorDown');
        targetVirtualColumn = targetCol;
    }));

    // Listen for manual user edits to unmark lines as "padded" 
    // so we don't accidentally trim real spaces they type.
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        if (isExtensionEdit) return;
        for (const change of e.contentChanges) {
            paddedLines.delete(getLineKey(e.document, change.range.start.line));
        }
    }));

    let previousEditor: vscode.TextEditor | undefined;
    let previousSelections: readonly vscode.Selection[] = [];

    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e => {
        const editor = e.textEditor;

        if (isEnabled() && previousEditor === editor) {
            const currentLines = new Set(e.selections.map(s => s.active.line));
            const rangesToDelete: vscode.Range[] = [];

            for (const sel of previousSelections) {
                const lineNum = sel.active.line;
                const lineKey = getLineKey(editor.document, lineNum);

                if (!currentLines.has(lineNum) && paddedLines.has(lineKey) && lineNum < editor.document.lineCount) {
                    const line = editor.document.lineAt(lineNum);
                    const match = line.text.match(/[ \t]+$/);
                    if (match) {
                        rangesToDelete.push(new vscode.Range(lineNum, line.text.length - match[0].length, lineNum, line.text.length));
                    }
                    paddedLines.delete(lineKey);
                }
            }

            if (rangesToDelete.length > 0) {
                setTimeout(() => {
                    isExtensionEdit = true;
                    editor.edit(editBuilder => {
                        for (const r of rangesToDelete) {
                            if (r.start.line < editor.document.lineCount) {
                                editBuilder.delete(r);
                            }
                        }
                    }, { undoStopBefore: false, undoStopAfter: false }).then(() => {
                        isExtensionEdit = false;
                    }, err => {
                        isExtensionEdit = false;
                        console.error('Failed to clean up virtual space', err);
                    });
                }, 0);
            }
        }

        previousEditor = editor;
        previousSelections = e.selections;

        if (e.kind !== undefined) {
            if (editor === vscode.window.activeTextEditor) {
                updateTargetColumn(editor);
            }
        }
    }));

    context.subscriptions.push(vscode.workspace.onWillSaveTextDocument(e => {
        if (!isEnabled()) return;

        const editor = vscode.window.activeTextEditor;
        const currentLines = editor && editor.document === e.document ? new Set(editor.selections.map(s => s.active.line)) : new Set<number>();

        const edits: vscode.TextEdit[] = [];
        for (let i = 0; i < e.document.lineCount; i++) {
            const lineKey = getLineKey(e.document, i);
            if (!paddedLines.has(lineKey) || currentLines.has(i)) continue;

            const line = e.document.lineAt(i);
            const match = line.text.match(/[ \t]+$/);
            if (match) {
                edits.push(vscode.TextEdit.delete(new vscode.Range(i, line.text.length - match[0].length, i, line.text.length)));
                paddedLines.delete(lineKey);
            }
        }

        if (edits.length > 0) {
            e.waitUntil(Promise.resolve(edits));
        }
    }));
}

function updateTargetColumn(editor: vscode.TextEditor) {
    targetVirtualColumn = Math.max(...editor.selections.map(s => s.active.character));
}

export function deactivate() { }
