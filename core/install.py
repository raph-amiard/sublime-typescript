import sublime
import shutil
import subprocess
from os import path
import os

REPO_NAME = "sublime-typescript"
PLUGIN_FILE_NAME = "typescript.py"

ts_settings = sublime.load_settings("typescript.sublime-settings")
def get_node_path():
    node_path = "node"
    if ts_settings.has("node_path"):
        node_path = ts_settings.get("node_path")
    return node_path

def check_for_node():
    node_path = get_node_path()
    try:
        subprocess.call([node_path, "--help"])
    except Exception, e:
        sublime.error_message("The node executable hasn't been found, you might want to set it in your typescript settings by adding the \"node_path\" key")
        raise e

def check_plugin_path():
    if ts_settings.has("plugin_path"): return False

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
            raise Exception("Plugin is not in the expected directory")
    plugin_path = path.abspath(plugin_path)

    # Write the plugin path into the settings file
    ts_settings.set("plugin_path", plugin_path)

    return True

def compile_plugin(plugin_path):
    def plugin_file(f):
        return path.join(plugin_path, f)

    # Compile the plugin
    bindir = plugin_file("bin")
    if not path.exists(bindir):
        os.makedirs(bindir)

    subprocess.call([get_node_path(), plugin_file("lib/typescript/bin/tsc.js"), plugin_file("src/ts/main.ts"), "--out", plugin_file("bin/main.js")])

    # Copy needed files to bin directory
    shutil.copyfile(plugin_file("lib/typescript/bin/typescript.js"),
                    plugin_file("bin/typescript.js"))
    shutil.copyfile(plugin_file("lib/typescript/bin/typescriptServices.js"),
                    plugin_file("bin/typescriptServices.js"))
    shutil.copyfile(plugin_file("lib/typescript/bin/lib.d.ts"),
                    plugin_file("bin/lib.d.ts"))
