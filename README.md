#  VS Code Virtual Space
Visual Studio Code Virtual Space

## Build a VSIX package

To compile and package this extension as a `.vsix` file:

1. Install dependencies:

```bash
npm install
```

2. Compile TypeScript:

```bash
npm run compile
```

3. Package the extension:

```bash
npx @vscode/vsce package
```

This creates a file like `virtual-space-0.0.1.vsix` in the project root.

## Installation

You can install the packaged extension directly into VS Code from the generated `.vsix` file:

1. Open the Command Palette in VS Code (`Cmd+Shift+P` on Mac, `Ctrl+Shift+P` on Windows/Linux).
2. Type and select **"Extensions: Install from VSIX..."**
3. Navigate to this project folder and select the `virtual-space-0.0.1.vsix` file.
4. Reload the VS Code window if prompted.

Alternatively, you can install it via the command line:
```bash
code --install-extension virtual-space-0.0.1.vsix       
``` 
or

```bash                                                
antigravity --install-extension virtual-space-0.0.1.vsix
```                                                     
                                                        
## Limitations                                          

Because VS Code does not natively support true "virtual space" in its editor rendering engine, this extension emulates the behavior by physically inserting space characters (`' '`) into the document to pad lines out to the target column. 

**This means:**
- Moving the cursor past the end of a line actually modifies the document by adding spaces.
- These automatically added spaces will be saved to the file if you do not delete them.
- They will appear in source control diffs (e.g., Git) as trailing whitespace.
