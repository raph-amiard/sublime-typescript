var global = Function("return this").call(null);
exports.userSpecifiedroot = "";
function switchToForwardSlashes(path) {
    return path.replace(/\\/g, "/");
}
function filePath(fullPath) {
    fullPath = switchToForwardSlashes(fullPath);
    var components = fullPath.split("/");
    var path = components.slice(0, components.length - 1);
    return path.join("/") + "/";
}
function readFile(path) {
    return IO.readFile(exports.userSpecifiedroot + path);
}
exports.readFile = readFile;
(function (Compiler) {
    var WriterAggregator = (function () {
        function WriterAggregator() {
            this.lines = [];
            this.currentLine = "";
        }
        WriterAggregator.prototype.Write = function (str) {
            this.currentLine += str;
        };
        WriterAggregator.prototype.WriteLine = function (str) {
            this.lines.push(this.currentLine + str);
            this.currentLine = "";
        };
        WriterAggregator.prototype.Close = function () {
            this.lines.push(this.currentLine);
            this.currentLine = "";
        };
        WriterAggregator.prototype.reset = function () {
            this.lines = [];
            this.currentLine = "";
        };
        return WriterAggregator;
    })();
    Compiler.WriterAggregator = WriterAggregator;    
    var libFolder = global['WScript'] ? TypeScript.filePath(global['WScript'].ScriptFullName) : (__dirname + '/');
    Compiler.libText = IO ? IO.readFile(libFolder + "lib.d.ts") : '';
    var stdout = new WriterAggregator();
    var stderr = new WriterAggregator();
    var currentUnit = 0;
    var maxUnit = 0;
    Compiler.compiler;
    recreate();
    var Type = (function () {
        function Type(type, code, identifier) {
            this.type = type;
            this.code = code;
            this.identifier = identifier;
        }
        Type.prototype.normalizeToArray = function (arg) {
            if((Array.isArray && Array.isArray(arg)) || arg instanceof Array) {
                return arg;
            }
            return [
                arg
            ];
        };
        Type.prototype.compilesOk = function (testCode) {
            var errors = null;
            compileString(testCode, 'test.ts', function (compilerResult) {
                errors = compilerResult.errors;
            });
            return errors.length === 0;
        };
        Type.prototype.isSubtypeOf = function (other) {
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
        };
        Type.prototype.isIdenticalTo = function (other) {
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
        };
        Type.prototype.assertSubtypeOf = function (others) {
            others = this.normalizeToArray(others);
            for(var i = 0; i < others.length; i++) {
                if(!this.isSubtypeOf(others[i])) {
                    throw new Error("Expected " + this.type + " to be a subtype of " + others[i].type);
                }
            }
        };
        Type.prototype.assertNotSubtypeOf = function (others) {
            others = this.normalizeToArray(others);
            for(var i = 0; i < others.length; i++) {
                if(this.isSubtypeOf(others[i])) {
                    throw new Error("Expected " + this.type + " to be a subtype of " + others[i].type);
                }
            }
        };
        Type.prototype.assertIdenticalTo = function (other) {
            if(!this.isIdenticalTo(other)) {
                throw new Error("Expected " + this.type + " to be identical to " + other.type);
            }
        };
        Type.prototype.assertNotIdenticalTo = function (other) {
            if(!this.isIdenticalTo(other)) {
                throw new Error("Expected " + this.type + " to not be identical to " + other.type);
            }
        };
        Type.prototype.isAssignmentCompatibleWith = function (other) {
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
        };
        Type.prototype.assertAssignmentCompatibleWith = function (others) {
            others = this.normalizeToArray(others);
            for(var i = 0; i < others.length; i++) {
                var other = others[i];
                if(!this.isAssignmentCompatibleWith(other)) {
                    throw new Error("Expected " + this.type + " to be assignment compatible with " + other.type);
                }
            }
        };
        Type.prototype.assertNotAssignmentCompatibleWith = function (others) {
            others = this.normalizeToArray(others);
            for(var i = 0; i < others.length; i++) {
                var other = others[i];
                if(this.isAssignmentCompatibleWith(other)) {
                    throw new Error("Expected " + this.type + " to not be assignment compatible with " + other.type);
                }
            }
        };
        return Type;
    })();
    Compiler.Type = Type;    
    var TypeFactory = (function () {
        function TypeFactory() {
            this.any = this.get('var x : any', 'x');
            this.number = this.get('var x : number', 'x');
            this.string = this.get('var x : string', 'x');
            this.bool = this.get('var x : bool', 'x');
        }
        TypeFactory.prototype.get = function (code, identifier) {
            var errors = null;
            compileString(code, 'test.ts', function (compilerResult) {
                errors = compilerResult.errors;
            });
            if(errors.length > 0) {
                throw new Error("Type definition contains errors: " + errors.join(","));
            }
            var script = Compiler.compiler.scripts.members[1];
            var enclosingScopeContext = TypeScript.findEnclosingScopeAt(new TypeScript.NullLogger(), script, new TypeScript.StringSourceText(code), 0, false);
            var entries = new TypeScript.ScopeTraversal(Compiler.compiler).getScopeEntries(enclosingScopeContext);
            for(var i = 0; i < entries.length; i++) {
                if(entries[i].name === identifier) {
                    return new Type(entries[i].type, code, identifier);
                }
            }
        };
        return TypeFactory;
    })();
    Compiler.TypeFactory = TypeFactory;    
    function generateDeclFile(code, verifyNoDeclFile) {
        reset();
        Compiler.compiler.settings.generateDeclarationFiles = true;
        var oldOutputMany = Compiler.compiler.settings.outputMany;
        try  {
            addUnit(code);
            Compiler.compiler.reTypeCheck();
            var outputs = {
            };
            Compiler.compiler.settings.outputMany = true;
            Compiler.compiler.emitDeclarationFile(function (fn) {
                outputs[fn] = new Compiler.WriterAggregator();
                return outputs[fn];
            });
            for(var fn in outputs) {
                if(fn.indexOf('.d.ts') >= 0) {
                    var writer = outputs[fn];
                    writer.Close();
                    if(verifyNoDeclFile) {
                        throw new Error('Compilation should not produce ' + fn);
                    }
                    return writer.lines.join('\n');
                }
            }
            if(!verifyNoDeclFile) {
                throw new Error('Compilation did not produced .d.ts files');
            }
        }finally {
            Compiler.compiler.settings.generateDeclarationFiles = false;
            Compiler.compiler.settings.outputMany = oldOutputMany;
        }
        return '';
    }
    Compiler.generateDeclFile = generateDeclFile;
    var CompilerResult = (function () {
        function CompilerResult(codeLines, errorLines, scripts) {
            this.scripts = scripts;
            this.code = codeLines.join("\n");
            this.errors = [];
            for(var i = 0; i < errorLines.length; i++) {
                var match = errorLines[i].match(/([^\(]*)\((\d+),(\d+)\):\s+((.*[\s\r\n]*.*)+)\s*$/);
                if(match) {
                    this.errors.push(new CompilerError(match[1], parseFloat(match[2]), parseFloat(match[3]), match[4]));
                } else {
                    WScript.Echo("non-match on: " + errorLines[i]);
                }
            }
        }
        CompilerResult.prototype.isErrorAt = function (line, column, message) {
            for(var i = 0; i < this.errors.length; i++) {
                if(this.errors[i].line === line && this.errors[i].column === column && this.errors[i].message === message) {
                    return true;
                }
            }
            return false;
        };
        return CompilerResult;
    })();
    Compiler.CompilerResult = CompilerResult;    
    var CompilerError = (function () {
        function CompilerError(file, line, column, message) {
            this.file = file;
            this.line = line;
            this.column = column;
            this.message = message;
        }
        CompilerError.prototype.toString = function () {
            return this.file + "(" + this.line + "," + this.column + "): " + this.message;
        };
        return CompilerError;
    })();
    Compiler.CompilerError = CompilerError;    
    function recreate() {
        Compiler.compiler = new TypeScript.TypeScriptCompiler(stderr);
        Compiler.compiler.parser.errorRecovery = true;
        Compiler.compiler.settings.codeGenTarget = TypeScript.CodeGenTarget.ES5;
        Compiler.compiler.settings.controlFlow = true;
        Compiler.compiler.settings.controlFlowUseDef = true;
        TypeScript.moduleGenTarget = TypeScript.ModuleGenTarget.Synchronous;
        Compiler.compiler.addUnit(Compiler.libText, 'lib.d.ts', true);
        Compiler.compiler.typeCheck();
        currentUnit = 0;
        maxUnit = 0;
    }
    Compiler.recreate = recreate;
    function reset() {
        stdout.reset();
        stderr.reset();
        for(var i = 0; i < currentUnit; i++) {
            Compiler.compiler.updateUnit('', i + '.ts', false);
        }
        Compiler.compiler.errorReporter.hasErrors = false;
        currentUnit = 0;
    }
    Compiler.reset = reset;
    function addUnit(code, isResident, isDeclareFile) {
        var script = null;
        if(currentUnit >= maxUnit) {
            script = Compiler.compiler.addUnit(code, currentUnit++ + (isDeclareFile ? '.d.ts' : '.ts'), isResident);
            maxUnit++;
        } else {
            var filename = currentUnit + (isDeclareFile ? '.d.ts' : '.ts');
            Compiler.compiler.updateUnit(code, filename, false);
            for(var i = 0; i < Compiler.compiler.units.length; i++) {
                if(Compiler.compiler.units[i].filename === filename) {
                    script = Compiler.compiler.scripts.members[i];
                }
            }
            currentUnit++;
        }
        return script;
    }
    Compiler.addUnit = addUnit;
    function compileUnit(path, callback, settingsCallback) {
        if(settingsCallback) {
            settingsCallback();
        }
        path = switchToForwardSlashes(path);
        compileString(readFile(path), path.match(/[^\/]*$/)[0], callback);
    }
    Compiler.compileUnit = compileUnit;
    function compileUnits(callback, settingsCallback) {
        reset();
        if(settingsCallback) {
            settingsCallback();
        }
        Compiler.compiler.reTypeCheck();
        Compiler.compiler.emitToOutfile(stdout);
        callback(new CompilerResult(stdout.lines, stderr.lines, []));
        recreate();
        reset();
    }
    Compiler.compileUnits = compileUnits;
    function compileString(code, unitName, callback, refreshUnitsForLSTests) {
        if (typeof refreshUnitsForLSTests === "undefined") { refreshUnitsForLSTests = false; }
        var scripts = [];
        if(typeof unitName === 'function') {
            callback = (unitName);
            unitName = 'test.ts';
        }
        reset();
        if(refreshUnitsForLSTests) {
            maxUnit = 0;
        }
        scripts.push(addUnit(code));
        Compiler.compiler.reTypeCheck();
        Compiler.compiler.emitToOutfile(stdout);
        callback(new CompilerResult(stdout.lines, stderr.lines, scripts));
    }
    Compiler.compileString = compileString;
})(exports.Compiler || (exports.Compiler = {}));
var Compiler = exports.Compiler;
var ScriptInfo = (function () {
    function ScriptInfo(name, content, isResident, maxScriptVersions) {
        this.name = name;
        this.content = content;
        this.isResident = isResident;
        this.maxScriptVersions = maxScriptVersions;
        this.editRanges = [];
        this.version = 1;
    }
    ScriptInfo.prototype.updateContent = function (content, isResident) {
        this.editRanges = [];
        this.content = content;
        this.isResident = isResident;
        this.version++;
    };
    ScriptInfo.prototype.editContent = function (minChar, limChar, newText) {
        var prefix = this.content.substring(0, minChar);
        var middle = newText;
        var suffix = this.content.substring(limChar);
        this.content = prefix + middle + suffix;
        this.editRanges.push({
            length: this.content.length,
            editRange: new TypeScript.ScriptEditRange(minChar, limChar, (limChar - minChar) + newText.length)
        });
        if(this.editRanges.length > this.maxScriptVersions) {
            this.editRanges.splice(0, this.maxScriptVersions - this.editRanges.length);
        }
        this.version++;
    };
    ScriptInfo.prototype.getEditRangeSinceVersion = function (version) {
        if(this.version == version) {
            return null;
        }
        var initialEditRangeIndex = this.editRanges.length - (this.version - version);
        if(initialEditRangeIndex < 0 || initialEditRangeIndex >= this.editRanges.length) {
            return TypeScript.ScriptEditRange.unknown();
        }
        var entries = this.editRanges.slice(initialEditRangeIndex);
        var minDistFromStart = entries.map(function (x) {
            return x.editRange.minChar;
        }).reduce(function (prev, current) {
            return Math.min(prev, current);
        });
        var minDistFromEnd = entries.map(function (x) {
            return x.length - x.editRange.limChar;
        }).reduce(function (prev, current) {
            return Math.min(prev, current);
        });
        var aggDelta = entries.map(function (x) {
            return x.editRange.delta;
        }).reduce(function (prev, current) {
            return prev + current;
        });
        return new TypeScript.ScriptEditRange(minDistFromStart, entries[0].length - minDistFromEnd, aggDelta);
    };
    return ScriptInfo;
})();
exports.ScriptInfo = ScriptInfo;
var TypeScriptLS = (function () {
    function TypeScriptLS() {
        this.ls = null;
        this.scripts = [];
        this.maxScriptVersions = 100;
    }
    TypeScriptLS.prototype.addDefaultLibrary = function () {
        this.addScript("lib.d.ts", Compiler.libText, true);
    };
    TypeScriptLS.prototype.addFile = function (name, isResident) {
        if (typeof isResident === "undefined") { isResident = false; }
        var code = readFile(name);
        this.addScript(name, code, isResident);
    };
    TypeScriptLS.prototype.addScript = function (name, content, isResident) {
        if (typeof isResident === "undefined") { isResident = false; }
        var script = new ScriptInfo(name, content, isResident, this.maxScriptVersions);
        this.scripts.push(script);
    };
    TypeScriptLS.prototype.updateScript = function (name, content, isResident) {
        if (typeof isResident === "undefined") { isResident = false; }
        for(var i = 0; i < this.scripts.length; i++) {
            if(this.scripts[i].name == name) {
                this.scripts[i].updateContent(content, isResident);
                return;
            }
        }
        this.addScript(name, content, isResident);
    };
    TypeScriptLS.prototype.editScript = function (name, minChar, limChar, newText) {
        for(var i = 0; i < this.scripts.length; i++) {
            if(this.scripts[i].name == name) {
                this.scripts[i].editContent(minChar, limChar, newText);
                return;
            }
        }
        throw new Error("No script with name '" + name + "'");
    };
    TypeScriptLS.prototype.getScriptContent = function (scriptIndex) {
        return this.scripts[scriptIndex].content;
    };
    TypeScriptLS.prototype.information = function () {
        return false;
    };
    TypeScriptLS.prototype.debug = function () {
        return true;
    };
    TypeScriptLS.prototype.warning = function () {
        return true;
    };
    TypeScriptLS.prototype.error = function () {
        return true;
    };
    TypeScriptLS.prototype.fatal = function () {
        return true;
    };
    TypeScriptLS.prototype.log = function (s) {
    };
    TypeScriptLS.prototype.getCompilationSettings = function () {
        return "";
    };
    TypeScriptLS.prototype.getScriptCount = function () {
        return this.scripts.length;
    };
    TypeScriptLS.prototype.getScriptSourceText = function (scriptIndex, start, end) {
        return this.scripts[scriptIndex].content.substring(start, end);
    };
    TypeScriptLS.prototype.getScriptSourceLength = function (scriptIndex) {
        return this.scripts[scriptIndex].content.length;
    };
    TypeScriptLS.prototype.getScriptId = function (scriptIndex) {
        return this.scripts[scriptIndex].name;
    };
    TypeScriptLS.prototype.getScriptIsResident = function (scriptIndex) {
        return this.scripts[scriptIndex].isResident;
    };
    TypeScriptLS.prototype.getScriptVersion = function (scriptIndex) {
        return this.scripts[scriptIndex].version;
    };
    TypeScriptLS.prototype.getScriptEditRangeSinceVersion = function (scriptIndex, scriptVersion) {
        var range = this.scripts[scriptIndex].getEditRangeSinceVersion(scriptVersion);
        var result = (range.minChar + "," + range.limChar + "," + range.delta);
        return result;
    };
    TypeScriptLS.prototype.getLanguageService = function () {
        var ls = new Services.TypeScriptServicesFactory().createLanguageServiceShim(this);
        ls.refresh(true);
        this.ls = ls;
        return ls;
    };
    TypeScriptLS.prototype.parseSourceText = function (fileName, sourceText) {
        var parser = new TypeScript.Parser();
        parser.setErrorRecovery(null);
        parser.errorCallback = function (a, b, c, d) {
        };
        var script = parser.parse(sourceText, fileName, 0);
        return script;
    };
    TypeScriptLS.prototype.parseFile = function (fileName) {
        var sourceText = new TypeScript.StringSourceText(IO.readFile(fileName));
        return this.parseSourceText(fileName, sourceText);
    };
    TypeScriptLS.prototype.lineColToPosition = function (fileName, line, col) {
        var script = this.ls.languageService.getScriptAST(fileName);
        return TypeScript.getPositionFromLineColumn(script, line, col);
    };
    TypeScriptLS.prototype.positionToLineCol = function (fileName, position) {
        var script = this.ls.languageService.getScriptAST(fileName);
        var result = TypeScript.getLineColumnFromPosition(script, position);
        return result;
    };
    TypeScriptLS.prototype.checkEdits = function (sourceFileName, baselineFileName, edits) {
        var script = readFile(sourceFileName);
        var formattedScript = this.applyEdits(script, edits);
        var baseline = readFile(baselineFileName);
    };
    TypeScriptLS.prototype.applyEdits = function (content, edits) {
        var result = content;
        edits = this.normalizeEdits(edits);
        for(var i = edits.length - 1; i >= 0; i--) {
            var edit = edits[i];
            var prefix = result.substring(0, edit.minChar);
            var middle = edit.text;
            var suffix = result.substring(edit.limChar);
            result = prefix + middle + suffix;
        }
        return result;
    };
    TypeScriptLS.prototype.normalizeEdits = function (edits) {
        var result = [];
        function mapEdits(edits) {
            var result = [];
            for(var i = 0; i < edits.length; i++) {
                result.push({
                    edit: edits[i],
                    index: i
                });
            }
            return result;
        }
        var temp = mapEdits(edits).sort(function (a, b) {
            var result = a.edit.minChar - b.edit.minChar;
            if(result == 0) {
                result = a.index - b.index;
            }
            return result;
        });
        var current = 0;
        var next = 1;
        while(current < temp.length) {
            var currentEdit = temp[current].edit;
            if(next >= temp.length) {
                result.push(currentEdit);
                current++;
                continue;
            }
            var nextEdit = temp[next].edit;
            var gap = nextEdit.minChar - currentEdit.limChar;
            if(gap >= 0) {
                result.push(currentEdit);
                current = next;
                next++;
                continue;
            }
            if(currentEdit.limChar >= nextEdit.limChar) {
                next++;
                continue;
            } else {
                throw new Error("Trying to apply overlapping edits");
            }
        }
        return result;
    };
    return TypeScriptLS;
})();
exports.TypeScriptLS = TypeScriptLS;
