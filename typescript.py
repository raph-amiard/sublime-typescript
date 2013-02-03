# -*- coding: utf-8 -*-

import sublime, sublime_plugin
from subprocess import Popen, PIPE
import json
from os import path
from threading import Thread, RLock, Semaphore
from time import sleep, time
import re
import difflib
from core import project
from core import settings
from itertools import cycle

# ========================== GENERAL HELPERS ======================= #

def is_ts(view):
    return view.file_name() and view.file_name().endswith(".ts")

def get_all_text(view):
    return view.substr(sublime.Region(0, view.size()))

def get_file_view(filename):
    for w in sublime.windows():
        for v in w.views():
            if v.file_name() == filename:
                return v
    return None

def get_dep_text(filename):
    view = get_file_view(filename)
    if view:
        return get_all_text(view)
    else:
        f = open(filename)
        ct = f.read()
        f.close()
        return ct

def format_diffs(old_content, new_content):
    seqmatcher = difflib.SequenceMatcher(None, old_content, new_content)
    return [(oc[1], oc[2], new_content[oc[3]:oc[4]] if oc[0] in ['insert', 'replace'] else "")
            for oc in seqmatcher.get_opcodes()
            if oc[0] in ['insert', 'delete', 'replace']]

prefixes = {
    "method": u"◉",
    "property": u"●",
    "class":u"⊗"
}

def format_completion_entry(c_entry):
    prefix = prefixes[c_entry["kind"]]
    prefix += " "
    middle = c_entry["name"]
    suffix = "\t" + c_entry["type"]
    return prefix + middle + suffix

global async_api_result
async_api_result = None
async_call_lock = Semaphore()
def async_api_call(func, *args, **kwargs):

    def timeout_func():
        global async_api_result
        async_api_result = func(*args, **kwargs)
        async_call_lock.release()

    async_call_lock.acquire()
    sublime.set_timeout(timeout_func, 0)
    async_call_lock.acquire()
    async_call_lock.release()
    return async_api_result


def completions_ts_to_sublime(json_completions):
    return [(format_completion_entry(c), c["name"]) for c in json_completions["entries"]]

def ts_errors_to_regions(ts_errors):
    return [sublime.Region(e["minChar"], e["limChar"]) for e in ts_errors]

def text_from_diff(old_content, minChar, limChar, new_text):
    prefix = old_content[0:minChar]
    suffix = old_content[limChar:]
    return (prefix + new_text + suffix)

def get_pos(view):
    return view.sel()[0].begin()

def get_plugin_path():
    print "PLUGIN PATH : ", settings.PLUGIN_PATH
    return settings.PLUGIN_PATH

def plugin_file(file_path):
    return path.join(get_plugin_path(), file_path)

node_path = "node"
ts_settings = sublime.load_settings("typescript.sublime-settings")
if ts_settings.has("node_path"):
    node_path = ts_settings.get("node_path")

def get_node_path():
    return node_path

# ================ SERVER AND COMMUNICATION HELPERS =============== #

class PluginInstance(object):
    def __init__(self):
        print "PLUGIN_FILE ", plugin_file("bin/main.js")
        self.open_files = set()
        self.views_text = {}
        self.errors_intervals = {}
        self.init_sem = Semaphore()

        def init_async():
            loading_files.inc()
            self.p = Popen([get_node_path(), plugin_file("bin/main.js")], stdin=PIPE, stdout=PIPE)
            self.serv_add_file(plugin_file("bin/lib.d.ts"))
            loading_files.dec()
            print "OUT OF INIT ASYNC"
            self.init_sem.release()

        self.init_sem.acquire()
        Thread(target=init_async).start()

    def msg(self, *args):
        res = None
        message = json.dumps(args) + "\n"
        t = time()
        self.p.stdin.write(message)
        res = json.loads(self.p.stdout.readline())
        return res

    def serv_add_file(self, file_name):
        resp = self.msg("add_file", file_name)

    def serv_update_file(self, file_name, content):
        resp = self.msg("update_script", file_name, content)

    def serv_edit_file(self, file_name, min_char, new_char, new_text):
        resp = self.msg("edit_script", file_name, min_char, new_char, new_text)

    def serv_get_completions(self, file_name, pos, is_member):
        resp = self.msg("complete", file_name, pos, is_member)
        return resp["result"]

    def serv_get_errors(self, file_name):
        resp = self.msg("get_errors", file_name)
        return resp["result"]


    def init_file(self, filename):
        is_open = filename in self.open_files
        content = async_api_call(get_dep_text, filename)
        if not is_open:
            deps = [ref[1:-1] for ref in
                    re.findall("/// *<reference path *\=('.*?'|\".*?\")", content)]
            self.open_files.add(filename)
            self.serv_add_file(filename)
            for dep in deps:
                dep_unix = dep.replace("\\", "/")
                dep_path = path.join(path.split(filename)[0], dep_unix)
                self.init_file(dep_path)
        self.serv_update_file(filename, content)

    def init_view(self, view):
        fname = view.file_name()

        def init_view_async():
            self.init_sem.acquire()
            loading_files.inc()
            self.init_file(fname)
            self.serv_update_file(fname, self.views_text[fname])
            loading_files.dec()
            self.init_sem.release()

        if is_ts(view):
            Thread(target=init_view_async).start()

    def update_server_code(self, filename, new_content):
        old_content = self.views_text[filename]
        bydiff_content = old_content

        diffs = format_diffs(old_content, new_content)

        for diff in reversed(diffs):
            bydiff_content = text_from_diff(bydiff_content, *diff)
            self.serv_edit_file(filename, *diff)

        if bydiff_content != new_content:
            print "ERROR WITH DIFF ALGORITHM"
            raise Exception("ERROR WITH DIFF ALGORITHM")
        else:
            self.views_text[filename] = new_content


# ========================= ERROR HANDLING STUFF ======================== #

    def set_errors_intervals(self, ts_errors):
        self.errors_intervals = {}
        for e in ts_errors:
            self.errors_intervals[(e["minChar"], e["limChar"])] = e["message"]

    def handle_errors(self, view, ts_errors):
        self.set_errors_intervals(ts_errors)
        view.add_regions(
            "typescript_errors",
            ts_errors_to_regions(ts_errors),
            "typescript.errors",
            "cross",
            sublime.DRAW_EMPTY_AS_OVERWRITE
        )

    def get_error_for_pos(self, pos):
        for (l, h), error in self.errors_intervals.iteritems():
            if pos >= l and pos <= h:
                return error
        return None

    def set_error_status(self, view):
        error = self.get_error_for_pos(get_pos(view))
        if error:
            sublime.status_message(error)
        else:
            sublime.status_message("")


# ========================= STATUS MESSAGE MANAGEMENT ============= #

class AtomicValue:
    def __init__(self):
        self.val = 0
        self.lock = RLock()

    def inc(self):
        self.lock.acquire()
        self.val += 1
        self.lock.release()

    def dec(self):
        self.lock.acquire()
        self.val -= 1
        self.lock.release()

loading_files = AtomicValue()

def status_msg_setter(text):
    def set_status_msg():
        sublime.status_message(text)
    return set_status_msg

def loading_status_msg():
    msg_base = "Loading typescript plugin"
    is_loading = False
    for el in cycle("|/-\\"):
        if loading_files.val > 0:
            is_loading = True
            msg = msg_base + " " + el
            sublime.set_timeout(status_msg_setter(msg), 0)
        elif is_loading == True:
            is_loading = False
            sublime.set_timeout(status_msg_setter(""), 0)
        sleep(0.1)

Thread(target=loading_status_msg).start()

# ========================= INITIALIZATION ======================== #

# Iterate on every open view, add file to server if needed
# for window in sublime.windows():
# 	for view in window.views():
# 		init_view(view)

plugin_instances = {}
project_files = {}

def init_view(view):
    project_file = get_project_file(view)
    if project_file not in plugin_instances:
        plugin_instances[project_file] = PluginInstance()
    plugin_instances[project_file].views_text[view.file_name()] = get_all_text(view)
    plugin_instances[project_file].init_view(view)


def get_project_file(view):
    filename = view.file_name()
    if filename in project_files:
        return project_files[filename]
    else:
        pfile = project.find_project_file(filename) 
        project_files[filename] = pfile
        return pfile

def get_plugin(view):
    return plugin_instances[get_project_file(view)]

# ========================= EVENT HANDLERS ======================== #

class TypescriptComplete(sublime_plugin.TextCommand):

    def run(self, edit, characters):
        # Insert the autocomplete char
        for region in self.view.sel():
            self.view.insert(edit, region.end(), characters)
        # Update the code on the server side for the current file
        get_plugin(self.view).update_server_code(self.view.file_name(), get_all_text(self.view))
        self.view.run_command("auto_complete")

class AsyncWorker(object):

    def __init__(self, view):
        self.view = view
        self.plugin = get_plugin(view)
        self.content = view.substr(sublime.Region(0, view.size()))
        self.filename = view.file_name()
        self.view_id = view.buffer_id()
        self.errors = None
        self.sem = Semaphore()
        self.sem.acquire()
        self.has_round_queued = False

    def do_more_work(self):
        self.content = self.view.substr(sublime.Region(0, self.view.size()))
        if not self.has_round_queued:
            self.sem.release()
            self.has_round_queued = True

    def final(self):
        self.plugin.handle_errors(self.view, self.errors)
        self.plugin.set_error_status(self.view)
        self.has_round_queued = False

    def work(self):
        while True:
            # Wait on semaphore
            self.sem.acquire()
            # Update the script
            self.plugin.update_server_code(self.filename, self.content)
            # Get errors
            self.errors = self.plugin.serv_get_errors(self.filename)
            sublime.set_timeout(self.final, 1)
            self.content = self.plugin.views_text[self.filename]
            sleep(1.3)


class TestEvent(sublime_plugin.EventListener):

    workers = {}

    def get_worker_thread(self, view):
        bid = view.buffer_id()
        if not bid in self.workers:
            worker = AsyncWorker(view)
            Thread(target=worker.work).start()
            self.workers[bid] = worker
        return self.workers[bid]

    def on_load(self, view):
        print "IN ON LOAD FOR VIEW : ", view.file_name()
        if is_ts(view):
            init_view(view)

    def on_modified(self, view):
        if view.is_loading(): return
        if is_ts(view):
            t = self.get_worker_thread(view)
            t.do_more_work()

    def on_selection_modified(self, view):
        if is_ts(view):
            get_plugin(view).set_error_status(view)

    def on_query_completions(self, view, prefix, locations):
        if is_ts(view):
            # Get the position of the cursor (first one in case of multiple sels)
            pos = view.sel()[0].begin()
            line = view.substr(sublime.Region(view.word(pos-1).a, pos))
            # Determine wether it is a member completion or not
            is_member = line.endswith(".")
            completions_json = get_plugin(view).serv_get_completions(view.file_name(), pos, is_member)
            get_plugin(view).set_error_status(view)
            return completions_ts_to_sublime(completions_json)


    def on_query_context(self, view, key, operator, operand, match_all):
        if key == "typescript":
            view = sublime.active_window().active_view()
            return is_ts(view)


# msg("add_file", "bin/test_code.ts")
