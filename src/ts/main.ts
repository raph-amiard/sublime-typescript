///<reference path='compilerservice.ts'/>

function lineColToPosition(fileName: string, line: number, col: number): number {
    var script = ls.languageService.getScriptAST(fileName);
    //assert.notNull(script);

    var lineMap = script.locationInfo.lineMap;

    //assert.is(line >= 1);
    //assert.is(col >= 1);
    //assert.is(line < lineMap.length);
    var offset = lineMap[line] + (col - 1);

    //assert.is(offset < script.limChar);
    return offset;
}

var typescriptLS = new CService.TypeScriptLS();
var file_name = 'bin/test_code.ts';
typescriptLS.addFile(file_name);
var ls = typescriptLS.getLanguageService();
var pos = lineColToPosition(file_name,20, 3)
var result = ls.languageService.getCompletionsAtPosition(file_name,  203, true);
console.log(pos);
console.log(result);
console.log("HO HAI");
