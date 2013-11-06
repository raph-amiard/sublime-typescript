///<reference path='compilerservice.ts'/>
///<reference path='../../lib/typescript/samples/node/node.d.ts'/>

var readline = require('readline');

/*
var typescriptLS = new CService.TypeScriptLS();
var file_name = 'bin/test_code.ts';
typescriptLS.addFile(file_name);
var ls = typescriptLS.getLanguageService();

var pos = lineColToPosition(file_name,11, 3)
var result = ls.languageService.getCompletionsAtPosition(file_name,  pos, true);
console.log(result);

pos = lineColToPosition(file_name,36, 9)
result = ls.languageService.getCompletionsAtPosition(file_name,  pos, true);
console.log(result);

console.log("HO HAI");
*/

var ts_ls : CService.TypeScriptLS = new CService.TypeScriptLS();
var ls : Services.ILanguageServiceShim;

function lineColToPosition(fileName: string, line: number, col: number): number {
    var script = ls.languageService.getScriptAST(fileName);
    var lineMap = script.locationInfo.lineMap;
    var offset = lineMap[line] + (col - 1);
    return offset;
}

function repl(prompt : string, callback : (string) => void) {
    var rl = readline.createInterface(process.stdin, process.stdout);
    rl.setPrompt(prompt);
    rl.prompt();
    rl.on('line', function (line) { callback(line); rl.prompt(); });
}


var repl_actions = {
    // Set the root of the project
    // root_path : the root path relative to which 
    // file paths will be resolved
    "set_root" : function (root_path) {
        CService.userSpecifiedroot = root_path;
        return {status: "OK"};
    },

    // Add a file to the list of tracked scripts
    // file_path : the path of the file to complete
    "add_file" : function (file_path) {
        ts_ls.addFile(file_path);
        ls = ts_ls.getLanguageService();
        return {status: "OK"};
    },

    // Initiate a completion request
    // file_path : the path of the file to complete
    // pos : either a number (absolute pos in the file), or a couple [line, col]
    // is_member : wether the completion is a member completion (eg a.***)
    "complete" : function (file_path, pos, is_member) {
        var ipos : number = (pos instanceof Array) ? 
                            lineColToPosition(file_path, pos[0], pos[1]) : pos;

        return {status: "OK",
                result: ls.languageService
                          .getCompletionsAtPosition(file_path, ipos, is_member)};
    },

    "edit_script": function (file_path, min_char, lim_char, new_text) {
        ts_ls.editScript(file_path, min_char, lim_char, new_text);
        return {status: "OK"};
    },

    "update_script": function (file_path, content) {
        ts_ls.updateScript(file_path, content);
        return {status: "OK"};
    },

    "get_errors": function(file_path) {
        return {status: "OK",
                result: ls.languageService
                          .getScriptErrors(file_path, 100)};
    },

    "dummy": function () {
        return {status: "OK", data:"dummy"};
    }
}

repl("", (line) => {
    var json_data = JSON.parse(line);
    var result;
    try {
        result = repl_actions[json_data[0]].apply(null, json_data.slice(1));
        console.error(result);
    } catch (err) {
        console.error(err);
        result = {status: "ERROR", error:err};
    }
    console.log(JSON.stringify(result));
})
