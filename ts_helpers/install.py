import sublime
import shutil
import subprocess
from os import path
import os

REPO_NAME = "sublime-typescript"
PLUGIN_FILE_NAME = "typescript.py"
TYPESCRIPT_SOURCE_LINK = "http://download-codeplex.sec.s-msft.com/Download/SourceControlFileDownload.ashx?ProjectName=typescript&changeSetId=6c2e2c092ba8"

ts_settings = sublime.load_settings("typescript.sublime-settings")
node_path = "node"

startupinfo = None
if os.name == 'nt':
    startupinfo = subprocess.STARTUPINFO()
    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
if ts_settings.has("node_path"):
    node_path = ts_settings.get("node_path")
def get_node_path():
    return node_path

def check_for_node():
    node_path = get_node_path()
    try:
        subprocess.call([node_path, "--help"], startupinfo = startupinfo)
    except Exception as e:
        sublime.error_message("The node executable hasn't been found, you might want to set it in your typescript settings by adding the \"node_path\" key")
        raise e

def check_plugin_path():
    if ts_settings.has("plugin_path") and path.isdir(ts_settings.get("plugin_path")):
        return

    # Find the plugin path (hackish way because i have no other way)
    packages_path = sublime.packages_path()
    plugin_path = path.join(packages_path, "sublime-typescript")
    if not path.isdir(plugin_path):
        plugin_path = None
        for d in os.listdir(packages_path):
            if path.isdir(d):
                for f in os.listdir(d):
                    if f == PLUGIN_FILE_NAME:
                        plugin_path = path.join(packages_path, d)
        if not plugin_path:
            sublime.error_message("Plugin is not in the expected directory")
    plugin_path = path.abspath(plugin_path)

    # Write the plugin path into the settings file
    ts_settings.set("plugin_path", plugin_path)
    sublime.save_settings("typescript.sublime-settings")

def needs_to_compile_plugin():
    mainPath = path.join(ts_settings.get("plugin_path"), "bin/main.js")
    return not path.exists(mainPath)

def compile_plugin(plugin_path):
    def plugin_file(f):
        return path.join(plugin_path, f)

    # Check if we got typescript in there
    typescript_dir = plugin_file("lib/typescript")

    if len(os.listdir(typescript_dir)) == 0:
        # We need to get typescript and unzip it
        import urllib.request, urllib.parse, urllib.error
        import zipfile
        zf_path = plugin_file("lib/typescript/ts.zip")
        urllib.request.urlretrieve(TYPESCRIPT_SOURCE_LINK, zf_path)
        zipf = zipfile.ZipFile(zf_path)
        zipf.extractall(path=plugin_file("lib/typescript/"))
        zipf.close()
        os.remove(zf_path)

    # Compile the plugin
    bindir = plugin_file("bin")
    if not path.exists(bindir):
        os.makedirs(bindir)

    print("compiling main.js")
    subprocess.call([get_node_path(),
                     plugin_file("lib/typescript/bin/tsc.js"),
                     plugin_file("src/ts/main.ts"),
                     "--out", plugin_file("bin/main.js")],
                     startupinfo = startupinfo)

    # Copy needed files to bin directory
    shutil.copyfile(plugin_file("lib/typescript/bin/typescript.js"),
                    plugin_file("bin/typescript.js"))
    shutil.copyfile(plugin_file("lib/typescript/bin/typescriptServices.js"),
                    plugin_file("bin/typescriptServices.js"))
    shutil.copyfile(plugin_file("lib/typescript/bin/lib.d.ts"),
                    plugin_file("bin/lib.d.ts"))
