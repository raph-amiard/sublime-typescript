///<reference path='../../lib/typescript/src/compiler/io.ts'/>
///<reference path='../../lib/typescript/src/compiler/typescript.ts'/>
///<reference path='../../lib/typescript/src/services/typescriptServices.ts' />
///<reference path='../../lib/typescript/src/harness/diff.ts'/>

declare var it;
declare var describe;
declare var run;
declare var IO: IIO;
declare var __dirname; // Node-specific

var global = <any>Function("return this").call(null);

function switchToForwardSlashes(path: string) {
    return path.replace(/\\/g, "/");
}

function filePath(fullPath: string) {
    fullPath = switchToForwardSlashes(fullPath);
    var components = fullPath.split("/");
    var path: string[] = components.slice(0, components.length - 1);
    return path.join("/") + "/";
}

module CService {

    export var userSpecifiedroot = "";
    export function readFile(path: string) {
        return IO.readFile(userSpecifiedroot +  path);
    }

    export module Compiler {
        // Aggregate various writes into a single array of lines. Useful for passing to the
        // TypeScript compiler to fill with source code or errors.
        export class WriterAggregator implements ITextWriter {
            public lines: string[] = [];
            public currentLine = "";

            public Write(str) {
                this.currentLine += str;
            }

            public WriteLine(str) {
                this.lines.push(this.currentLine + str);
                this.currentLine = "";
            }

            public Close() {
                this.lines.push(this.currentLine);
                this.currentLine = "";
            }

            public reset() {
                this.lines = [];
                this.currentLine = "";
            }
        }

        var libFolder: string = global['WScript'] ? TypeScript.filePath(global['WScript'].ScriptFullName) : (__dirname + '/');
        export var libText = IO ? IO.readFile(libFolder + "lib.d.ts") : '';

        var stdout = new WriterAggregator();
        var stderr = new WriterAggregator();
        var currentUnit = 0;
        var maxUnit = 0;

        export var compiler: TypeScript.TypeScriptCompiler;
        recreate();

        // Types
        export class Type {
            constructor (public type, public code, public identifier) { }

            public normalizeToArray(arg: any) {
                if ((Array.isArray && Array.isArray(arg)) || arg instanceof Array)
                    return arg;

                return [arg];
            }

            public compilesOk(testCode): bool {
                var errors = null;
                compileString(testCode, 'test.ts', function (compilerResult) {
                    errors = compilerResult.errors;
                })

                return errors.length === 0;
            }

            public isSubtypeOf(other: Type) {
                var testCode = 'class __test1__ {\n';
                testCode += '    public test() {\n';
                testCode += '        ' + other.code + ';\n';
                testCode += '        return ' + other.identifier + ';\n';
                testCode += '    }\n';
                testCode += '}\n';
                testCode += 'class __test2__ extends __test1__ {\n';
                testCode += '    public test() {\n';
                testCode += '        ' + this.code + ';\n';
                testCode += '        return ' + other.identifier + ';\n';
                testCode += '    }\n';
                testCode += '}\n';

                return this.compilesOk(testCode);
            }

            // TODO: Find an implementation of isIdenticalTo that works.
            public isIdenticalTo(other: Type) {
                var testCode = 'module __test1__ {\n';
                testCode += '    ' + this.code + ';\n';
                testCode += '    export var __val__ = ' + this.identifier + ';\n';
                testCode += '}\n';
                testCode += 'var __test1__val__ = __test1__.__val__;\n';

                testCode += 'module __test2__ {\n';
                testCode += '    ' + other.code + ';\n';
                testCode += '    export var __val__ = ' + other.identifier + ';\n';
                testCode += '}\n';
                testCode += 'var __test2__val__ = __test2__.__val__;\n';

                testCode += 'function __test__function__() { if(true) { return __test1__val__ }; return __test2__val__; }';

                return this.compilesOk(testCode);
            }

            public assertSubtypeOf(others: any) {
                others = this.normalizeToArray(others);

                for (var i = 0; i < others.length; i++) {
                    if (!this.isSubtypeOf(others[i])) {
                        throw new Error("Expected " + this.type + " to be a subtype of " + others[i].type);
                    }
                }
            }

            public assertNotSubtypeOf(others: any) {
                others = this.normalizeToArray(others);

                for (var i = 0; i < others.length; i++) {
                    if (this.isSubtypeOf(others[i])) {
                        throw new Error("Expected " + this.type + " to be a subtype of " + others[i].type);
                    }
                }
            }

            public assertIdenticalTo(other: Type) {
                if (!this.isIdenticalTo(other)) {
                    throw new Error("Expected " + this.type + " to be identical to " + other.type);
                }
            }

            public assertNotIdenticalTo(other: Type) {
                if (!this.isIdenticalTo(other)) {
                    throw new Error("Expected " + this.type + " to not be identical to " + other.type);
                }
            }

            public isAssignmentCompatibleWith(other: Type) {
                var testCode = 'module __test1__ {\n';
                testCode += '    ' + this.code + ';\n';
                testCode += '    export var __val__ = ' + this.identifier + ';\n';
                testCode += '}\n';
                testCode += 'var __test1__val__ = __test1__.__val__;\n';

                testCode += 'module __test2__ {\n';
                testCode += '    export ' + other.code + ';\n';
                testCode += '    export var __val__ = ' + other.identifier + ';\n';
                testCode += '}\n';
                testCode += 'var __test2__val__ = __test2__.__val__;\n';

                testCode += '__test2__val__ = __test1__val__;';

                return this.compilesOk(testCode);
            }

            public assertAssignmentCompatibleWith(others: any) {
                others = this.normalizeToArray(others);

                for (var i = 0; i < others.length; i++) {
                    var other = others[i];

                    if (!this.isAssignmentCompatibleWith(other)) {
                        throw new Error("Expected " + this.type + " to be assignment compatible with " + other.type);
                    }
                }
            }

            public assertNotAssignmentCompatibleWith(others: any) {
                others = this.normalizeToArray(others);

                for (var i = 0; i < others.length; i++) {
                    var other = others[i];

                    if (this.isAssignmentCompatibleWith(other)) {
                        throw new Error("Expected " + this.type + " to not be assignment compatible with " + other.type);
                    }
                }
            }
        }

        export class TypeFactory {
            public any: Type;
            public number: Type;
            public string: Type;
            public bool: Type;

            constructor () {
                this.any = this.get('var x : any', 'x');
                this.number = this.get('var x : number', 'x');
                this.string = this.get('var x : string', 'x');
                this.bool = this.get('var x : bool', 'x');
            }

            public get(code: string, identifier: string) {
                var errors = null;
                compileString(code, 'test.ts', function (compilerResult) {
                    errors = compilerResult.errors;
                })

                if (errors.length > 0)
                    throw new Error("Type definition contains errors: " + errors.join(","));

                // REVIEW: For a multi-file test, this won't work
                var script = compiler.scripts.members[1];
                var enclosingScopeContext = TypeScript.findEnclosingScopeAt(new TypeScript.NullLogger(), <TypeScript.Script>script, new TypeScript.StringSourceText(code), 0, false);
                var entries = new TypeScript.ScopeTraversal(compiler).getScopeEntries(enclosingScopeContext);
                for (var i = 0; i < entries.length; i++) {
                    if (entries[i].name === identifier) {
                        return new Type(entries[i].type, code, identifier);
                    }
                }
            }

        }

        export function generateDeclFile(code: string, verifyNoDeclFile: bool): string {
            reset();

            compiler.settings.generateDeclarationFiles = true;
            var oldOutputMany = compiler.settings.outputMany;
            try {
                addUnit(code);
                compiler.reTypeCheck();

                var outputs = {};

                compiler.settings.outputMany = true;
                compiler.emitDeclarationFile((fn: string) => {
                    outputs[fn] = new Compiler.WriterAggregator();
                    return outputs[fn];
                });

                for (var fn in outputs) {
                    if (fn.indexOf('.d.ts') >= 0) {
                        var writer = <Compiler.WriterAggregator>outputs[fn];
                        writer.Close();
                        if (verifyNoDeclFile) {
                            throw new Error('Compilation should not produce ' + fn);
                        }
                        return writer.lines.join('\n');
                    }
                }

                if (!verifyNoDeclFile) {
                    throw new Error('Compilation did not produced .d.ts files');
                }
            } finally {
                compiler.settings.generateDeclarationFiles = false;
                compiler.settings.outputMany = oldOutputMany;
            }

            return '';
        }

        // Contains the code and errors of a compilation and some helper methods to check its status.
        export class CompilerResult {
            public code: string;
            public errors: CompilerError[];

            constructor (codeLines: string[], errorLines: string[], public scripts: TypeScript.Script[]) {
                this.code = codeLines.join("\n")
                this.errors = [];

                for (var i = 0; i < errorLines.length; i++) {
                    var match = errorLines[i].match(/([^\(]*)\((\d+),(\d+)\):\s+((.*[\s\r\n]*.*)+)\s*$/);
                    if (match) {
                        this.errors.push(new CompilerError(match[1], parseFloat(match[2]), parseFloat(match[3]), match[4]));
                    }
                    else {
                        WScript.Echo("non-match on: " + errorLines[i]);
                    }
                }
            }

            public isErrorAt(line: number, column: number, message: string) {
                for (var i = 0; i < this.errors.length; i++) {
                    if (this.errors[i].line === line && this.errors[i].column === column && this.errors[i].message === message)
                        return true;
                }

                return false;
            }
        }

        // Compiler Error.
        export class CompilerError {
            constructor (public file: string,
                    public line: number,
                    public column: number,
                    public message: string) { }

            public toString() {
                return this.file + "(" + this.line + "," + this.column + "): " + this.message;
            }
        }

        export function recreate() {
            compiler = new TypeScript.TypeScriptCompiler(stderr);
            compiler.parser.errorRecovery = true;
            compiler.settings.codeGenTarget = TypeScript.CodeGenTarget.ES5;
            compiler.settings.controlFlow = true;
            compiler.settings.controlFlowUseDef = true;
            TypeScript.moduleGenTarget = TypeScript.ModuleGenTarget.Synchronous;
            compiler.addUnit(libText, 'lib.d.ts', true);
            compiler.typeCheck();
            currentUnit = 0;
            maxUnit = 0;
        }
        export function reset() {
            stdout.reset();
            stderr.reset();

            for (var i = 0; i < currentUnit; i++) {
                compiler.updateUnit('', i + '.ts', false/*setRecovery*/);
            }

            compiler.errorReporter.hasErrors = false;
            currentUnit = 0;
        }

        export function addUnit(code: string, isResident?: bool, isDeclareFile?: bool) {
            var script: TypeScript.Script = null;
            if (currentUnit >= maxUnit) {
                script = compiler.addUnit(code, currentUnit++ + (isDeclareFile ? '.d.ts' : '.ts'), isResident);
                maxUnit++;
            } else {
                var filename = currentUnit + (isDeclareFile ? '.d.ts' : '.ts');
                compiler.updateUnit(code, filename, false/*setRecovery*/);

                for (var i = 0; i < compiler.units.length; i++) {
                    if (compiler.units[i].filename === filename)
                        script = <TypeScript.Script>compiler.scripts.members[i];
                }

                currentUnit++;
            }

            return script;
        }

        export function compileUnit(path: string, callback: (res: CompilerResult) => void , settingsCallback?: () => void ) {
            if (settingsCallback) {
                settingsCallback();
            }
            path = switchToForwardSlashes(path);
            compileString(readFile(path), path.match(/[^\/]*$/)[0], callback);
        }
        export function compileUnits(callback: (res: Compiler.CompilerResult) => void, settingsCallback?: () => void ) {
            reset();
            if (settingsCallback) {
                settingsCallback();
            } 
            
            compiler.reTypeCheck();
            compiler.emitToOutfile(stdout);

            callback(new CompilerResult(stdout.lines, stderr.lines, []));
            
            recreate();
            reset();
        }
        export function compileString(code: string, unitName: string, callback: (res: Compiler.CompilerResult) => void , refreshUnitsForLSTests? = false) {
            var scripts: TypeScript.Script[] = [];

            // TODO: How to overload?
            if (typeof unitName === 'function') {
                callback = <(res: CompilerResult) => void >(<any>unitName);
                unitName = 'test.ts';
            }

            reset();

            // Some command-line tests may pollute the global namespace, which could interfere with
            // with language service testing.
            // In the case of LS tests, make sure that we refresh the first unit, and not try to update it
            if (refreshUnitsForLSTests) {
                maxUnit = 0;
            }

            scripts.push(addUnit(code));
            compiler.reTypeCheck();
            compiler.emitToOutfile(stdout);

            callback(new CompilerResult(stdout.lines, stderr.lines, scripts));
        }
    }

    export class ScriptInfo {
        public version: number;
        public editRanges: { length: number; editRange: TypeScript.ScriptEditRange; }[] = [];

        constructor (public name: string, public content: string, public isResident: bool, public maxScriptVersions: number) {
            this.version = 1;
        }

        public updateContent(content: string, isResident: bool) {
            this.editRanges = [];
            this.content = content;
            this.isResident = isResident;
            this.version++;
        }

        public editContent(minChar: number, limChar: number, newText: string) {
            // Apply edits
            var prefix = this.content.substring(0, minChar);
            var middle = newText;
            var suffix = this.content.substring(limChar);
            this.content = prefix + middle + suffix;

            // Store edit range + new length of script
            this.editRanges.push({
                length: this.content.length,
                editRange: new TypeScript.ScriptEditRange(minChar, limChar, (limChar - minChar) + newText.length)
            });

            if (this.editRanges.length > this.maxScriptVersions) {
                this.editRanges.splice(0, this.maxScriptVersions - this.editRanges.length);
            }

            // Update version #
            this.version++;
        }

        public getEditRangeSinceVersion(version: number): TypeScript.ScriptEditRange {
            if (this.version == version) {
                // No edits!
                return null;
            }

            var initialEditRangeIndex = this.editRanges.length - (this.version - version);
            if (initialEditRangeIndex < 0 || initialEditRangeIndex >= this.editRanges.length) {
                // Too far away from what we know
                return TypeScript.ScriptEditRange.unknown();
            }

            var entries = this.editRanges.slice(initialEditRangeIndex);

            var minDistFromStart = entries.map(x => x.editRange.minChar).reduce((prev, current) => Math.min(prev, current));
            var minDistFromEnd = entries.map(x => x.length - x.editRange.limChar).reduce((prev, current) => Math.min(prev, current));
            var aggDelta = entries.map(x => x.editRange.delta).reduce((prev, current) => prev + current);

            return new TypeScript.ScriptEditRange(minDistFromStart, entries[0].length - minDistFromEnd, aggDelta);
        }
    }

    export class TypeScriptLS implements Services.ILanguageServiceShimHost {
        private ls: Services.ILanguageServiceShim = null;

        public scripts: ScriptInfo[] = [];
        public maxScriptVersions = 100;

        public addDefaultLibrary() {
            this.addScript("lib.d.ts", Compiler.libText, true);
        }

        public addFile(name: string, isResident = false) {
            var code: string = readFile(name);
            this.addScript(name, code, isResident);
        }

        public addScript(name: string, content: string, isResident = false) {
            var script = new ScriptInfo(name, content, isResident, this.maxScriptVersions);
            this.scripts.push(script);
        }

        public updateScript(name: string, content: string, isResident = false) {
            for (var i = 0; i < this.scripts.length; i++) {
                if (this.scripts[i].name == name) {
                    this.scripts[i].updateContent(content, isResident);
                    return;
                }
            }

            this.addScript(name, content, isResident);
        }

        public editScript(name: string, minChar: number, limChar: number, newText: string) {
            for (var i = 0; i < this.scripts.length; i++) {
                if (this.scripts[i].name == name) {
                    this.scripts[i].editContent(minChar, limChar, newText);
                    return;
                }
            }

            throw new Error("No script with name '" + name + "'");
        }

        public getScriptContent(scriptIndex: number): string {
            return this.scripts[scriptIndex].content;
        }

        //////////////////////////////////////////////////////////////////////
        // ILogger implementation
        //
        public information(): bool { return false; }
        public debug(): bool { return true; }
        public warning(): bool { return true; }
        public error(): bool { return true; }
        public fatal(): bool { return true; }

        public log(s: string): void {
            // For debugging...
            //IO.printLine("TypeScriptLS:" + s);
        }

        //////////////////////////////////////////////////////////////////////
        // ILanguageServiceShimHost implementation
        //

        public getCompilationSettings(): string/*json for Tools.CompilationSettings*/ {
            return ""; // i.e. default settings
        }

        public getScriptCount(): number {
            return this.scripts.length;
        }

        public getScriptSourceText(scriptIndex: number, start: number, end: number): string {
            return this.scripts[scriptIndex].content.substring(start, end);
        }

        public getScriptSourceLength(scriptIndex: number): number {
            return this.scripts[scriptIndex].content.length;
        }

        public getScriptId(scriptIndex: number): string {
            return this.scripts[scriptIndex].name;
        }

        public getScriptIsResident(scriptIndex: number): bool {
            return this.scripts[scriptIndex].isResident;
        }

        public getScriptVersion(scriptIndex: number): number {
            return this.scripts[scriptIndex].version;
        }

        public getScriptEditRangeSinceVersion(scriptIndex: number, scriptVersion: number): string {
            var range = this.scripts[scriptIndex].getEditRangeSinceVersion(scriptVersion);
            var result = (range.minChar + "," + range.limChar + "," + range.delta);
            return result;
        }

        //
        // Return a new instance of the language service shim, up-to-date wrt to typecheck.
        // To access the non-shim (i.e. actual) language service, use the "ls.languageService" property.
        //
        public getLanguageService(): Services.ILanguageServiceShim {
            var ls = new Services.TypeScriptServicesFactory().createLanguageServiceShim(this);
            ls.refresh(true);
            this.ls = ls;
            return ls;
        }

        //
        // Parse file given its source text
        //
        public parseSourceText(fileName: string, sourceText: TypeScript.ISourceText): TypeScript.Script {
            var parser = new TypeScript.Parser();
            parser.setErrorRecovery(null);
            parser.errorCallback = (a, b, c, d) => { };

            var script = parser.parse(sourceText, fileName, 0);
            return script;
        }

        //
        // Parse a file on disk given its filename
        //
        public parseFile(fileName: string) {
            var sourceText = new TypeScript.StringSourceText(IO.readFile(fileName))
            return this.parseSourceText(fileName, sourceText);
        }

        //
        // line and column are 1-based
        //
        public lineColToPosition(fileName: string, line: number, col: number): number {
            var script = this.ls.languageService.getScriptAST(fileName);
            //assert.notNull(script);
            //assert.is(line >= 1);
            //assert.is(col >= 1);
            //assert.is(line < script.locationInfo.lineMap.length);

            return TypeScript.getPositionFromLineColumn(script, line, col);
        }

        //
        // line and column are 1-based
        //
        public positionToLineCol(fileName: string, position: number): TypeScript.ILineCol {
            var script = this.ls.languageService.getScriptAST(fileName);
            //assert.notNull(script);

            var result = TypeScript.getLineColumnFromPosition(script, position);

            //assert.is(result.line >= 1);
            //assert.is(result.col >= 1);
            return result;
        }

        //
        // Verify that applying edits to "sourceFileName" result in the content of the file
        // "baselineFileName"
        //
        public checkEdits(sourceFileName: string, baselineFileName: string, edits: Services.TextEdit[]) {
            var script = readFile(sourceFileName);
            var formattedScript = this.applyEdits(script, edits);
            var baseline = readFile(baselineFileName);

            //assert.noDiff(formattedScript, baseline);
            //assert.equal(formattedScript, baseline);
        }


        //
        // Apply an array of text edits to a string, and return the resulting string.
        //
        public applyEdits(content: string, edits: Services.TextEdit[]): string {
            var result = content;
            edits = this.normalizeEdits(edits);

            for (var i = edits.length - 1; i >= 0; i--) {
                var edit = edits[i];
                var prefix = result.substring(0, edit.minChar);
                var middle = edit.text;
                var suffix = result.substring(edit.limChar);
                result = prefix + middle + suffix;
            }
            return result;
        }

        //
        // Normalize an array of edits by removing overlapping entries and sorting
        // entries on the "minChar" position.
        //
        private normalizeEdits(edits: Services.TextEdit[]): Services.TextEdit[] {
            var result: Services.TextEdit[] = [];

            function mapEdits(edits: Services.TextEdit[]): { edit: Services.TextEdit; index: number; }[] {
                var result = [];
                for (var i = 0; i < edits.length; i++) {
                    result.push({ edit: edits[i], index: i });
                }
                return result;
            }

            var temp = mapEdits(edits).sort(function (a, b) {
                var result = a.edit.minChar - b.edit.minChar;
                if (result == 0)
                    result = a.index - b.index;
                return result;
            });

            var current = 0;
            var next = 1;
            while (current < temp.length) {
                var currentEdit = temp[current].edit;

                // Last edit
                if (next >= temp.length) {
                    result.push(currentEdit);
                    current++;
                    continue;
                }
                var nextEdit = temp[next].edit;

                var gap = nextEdit.minChar - currentEdit.limChar;

                // non-overlapping edits
                if (gap >= 0) {
                    result.push(currentEdit);
                    current = next;
                    next++;
                    continue;
                }

                // overlapping edits: for now, we only support ignoring an next edit 
                // entirely contained in the current edit.
                if (currentEdit.limChar >= nextEdit.limChar) {
                    next++;
                    continue;
                }
                else {
                    throw new Error("Trying to apply overlapping edits");
                }
            }

            return result;
        }

    }
}
