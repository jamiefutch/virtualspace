import * as vscode from 'vscode';

let targetVirtualColumn = -1;

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

        let needsEdit = false;
        await editor.edit(editBuilder => {
            for (const sel of editor.selections) {
                const pos = sel.active;
                const line = editor.document.lineAt(pos.line);
                if (pos.character >= line.text.length) {
                    editBuilder.insert(pos, ' ');
                    needsEdit = true;
                }
            }
        }, { undoStopBefore: false, undoStopAfter: false });

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

        await editor.edit(editBuilder => {
            for (const sel of editor.selections) {
                const pos = sel.active;
                if (pos.line > 0) {
                    const targetLine = pos.line - 1;
                    const line = editor.document.lineAt(targetLine);
                    if (line.text.length < targetCol) {
                        const spacesNeeded = targetCol - line.text.length;
                        editBuilder.insert(new vscode.Position(targetLine, line.text.length), ' '.repeat(spacesNeeded));
                    }
                }
            }
        }, { undoStopBefore: false, undoStopAfter: false });

        await vscode.commands.executeCommand('cursorUp');
        // Keep the target column explicitly stable
        targetVirtualColumn = targetCol;
    }));

    context.subscriptions.push(vscode.commands.registerTextEditorCommand('virtualspace.moveDown', async (editor) => {
        if (!isEnabled()) {
            await vscode.commands.executeCommand('cursorDown');
            return;
        }

        const targetCol = Math.max(targetVirtualColumn, Math.max(...editor.selections.map(s => s.active.character)));

        await editor.edit(editBuilder => {
            for (const sel of editor.selections) {
                const pos = sel.active;
                if (pos.line < editor.document.lineCount - 1) {
                    const targetLine = pos.line + 1;
                    const line = editor.document.lineAt(targetLine);
                    if (line.text.length < targetCol) {
                        const spacesNeeded = targetCol - line.text.length;
                        editBuilder.insert(new vscode.Position(targetLine, line.text.length), ' '.repeat(spacesNeeded));
                    }
                }
            }
        }, { undoStopBefore: false, undoStopAfter: false });

        await vscode.commands.executeCommand('cursorDown');
        // Keep the target column explicitly stable
        targetVirtualColumn = targetCol;
    }));

    vscode.window.onDidChangeTextEditorSelection(e => {
        // If user clicked or typed, update column. e.kind === 1 usually means Keyboard, 2 is Mouse
        // We update it so that regular actions change the target virtual column
        if (e.kind !== undefined) {
            if (e.textEditor === vscode.window.activeTextEditor) {
                updateTargetColumn(e.textEditor);
            }
        }
    });
}

function updateTargetColumn(editor: vscode.TextEditor) {
    targetVirtualColumn = Math.max(...editor.selections.map(s => s.active.character));
}

export function deactivate() { }
