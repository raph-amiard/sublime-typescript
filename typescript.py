# -*- coding: utf-8 -*-

import sublime, sublime_plugin
from subprocess import Popen, PIPE
import json
from os import path
from threading import Thread, RLock, Semaphore
from time import sleep, time
import re
import difflib


# ================ SERVER AND COMMUNICATION HELPERS =============== #

p = Popen(["node", "bin/main.js"], stdin=PIPE, stdout=PIPE)
#prlock = RLock()

def msg(*args):
    res = None
    message = json.dumps(args) + "\n"
    print "Message : ", args[0]
    t = time()
    p.stdin.write(message)
    res = json.loads(p.stdout.readline())
    print "Time elapsed : ", time() - t
    # print res
    return res

def serv_add_file(file_name):
	resp = msg("add_file", file_name)

def serv_update_file(file_name, content):
    resp = msg("update_script", file_name, content)

def serv_edit_file(file_name, min_char, new_char, new_text):
    resp = msg("edit_script", file_name, min_char, new_char, new_text)

def serv_get_completions(file_name, pos, is_member):
    resp = msg("complete", file_name, pos, is_member)
    return resp["result"]

def serv_get_errors(file_name):
    resp = msg("get_errors", file_name)
    return resp["result"]

# ========================== GENERAL HELPERS ======================= #

def is_ts(view):
	return view.file_name() and view.file_name().endswith(".ts")

global thread_typescript_update
thread_typescript_update = None
do_thread_update = False

def get_all_text(view):
    return view.substr(sublime.Region(0, view.size()))

open_files = set()

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

def init_file(filename, no_refs=False):

    is_open = filename in open_files

    # If no refs is true and the file is already open, exit
    if no_refs and is_open: return

    content = get_dep_text(filename)
    deps = re.findall("/// *<reference path *\='(.*?)'", content)

    if not is_open:
        open_files.add(filename)
        serv_add_file(filename)
    else:
        serv_update_file(filename, content)

    for dep in deps:
        dep_unix = dep.replace("\\", "/")
        dep_path = path.join(path.split(filename)[0], dep_unix)
        init_file(dep_path, no_refs=True)


def init_view(view):
    print "is_ts view :", is_ts(view)
    if is_ts(view):
        views_text[view.file_name()] = get_all_text(view)
        init_file(view.file_name())
        serv_update_file(view.file_name(), views_text[view.file_name()])

views_text = {}

def format_diffs(seqmatcher, new_content):
    return [(oc[1], oc[2], new_content[oc[3]:oc[4]] if oc[0] == 'insert' else "")
            for oc in seqmatcher.get_opcodes()
            if oc[0] in ['insert', 'delete']]


def test_diff_python_side(old_content, minChar, limChar, new_text):
    print "TEST_DIFF_PYTHON_SIDE"
    prefix = old_content[0:minChar]
    suffix = old_content[limChar:]
    print prefix + new_text + suffix;


def update_server_code(filename, new_content):
    old_content = views_text[filename]
    print "IN UPDATE SERVER CODE"

    s = difflib.SequenceMatcher(None, old_content, new_content)
    print format_diffs(s, new_content)

    views_text[filename] = new_content
    for diff in format_diffs(s, new_content):
        serv_edit_file(filename, *diff)

def format_completion_entry(c_entry):
    prefix = ""
    if c_entry["kind"] == "method":
        prefix = u"◉"
    else:
        prefix = u"●"
    prefix += " "

    middle = c_entry["name"]
    if c_entry["kind"] == "method":
        middle += ""

    suffix = "\t" + c_entry["type"]

    return prefix + middle + suffix

def completions_ts_to_sublime(json_completions):
    return [(format_completion_entry(c), c["name"]) for c in json_completions["entries"]]

def ts_errors_to_regions(ts_errors):
    return [sublime.Region(e["minChar"], e["limChar"]) for e in ts_errors]

global errors_intervals
errors_intervals = {}
def set_errors_intervals(ts_errors):
    global errors_intervals
    errors_intervals = {}
    for e in ts_errors:
        errors_intervals[(e["minChar"], e["limChar"])] = e["message"]

def get_error_for_pos(pos):
    for (l, h), error in errors_intervals.iteritems():
        if pos >= l and pos <= h:
            return error
    return None

def get_pos(view):
    return view.sel()[0].begin()

def handle_errors(view, ts_errors):
    set_errors_intervals(ts_errors)
    view.add_regions(
        "typescript_errors",
        ts_errors_to_regions(ts_errors),
        "typescript.errors",
        "cross",
        sublime.DRAW_EMPTY_AS_OVERWRITE
    )

def show_current_error(view):
    pos = view.sel()[0].begin()

def set_error_status(view):
    error = get_error_for_pos(get_pos(view))
    if error:
        sublime.status_message(error)
    else:
        sublime.status_message("")


# ========================= INITIALIZATION ======================== #

# Iterate on every open view, add file to server if needed
for window in sublime.windows():
	for view in window.views():
		init_view(view)

serv_add_file("bin/lib.d.ts")

# ========================= EVENT HANDLERS ======================== #

class TypescriptComplete(sublime_plugin.TextCommand):

    def run(self, edit, characters):
        # Insert the autocomplete char
        for region in self.view.sel():
            self.view.insert(edit, region.end(), characters)
        # Update the code on the server side for the current file
        update_server_code(self.view.file_name(), get_all_text(self.view))
        self.view.run_command("auto_complete")

class AsyncWorker(object):

    def __init__(self, view):
        self.view = view
        self.content = view.substr(sublime.Region(0, view.size()))
        self.filename = view.file_name()
        self.view_id = view.buffer_id()
        self.errors = None
        self.sem = Semaphore()
        self.has_round_queued = False

    def do_more_work(self):
        self.content = self.view.substr(sublime.Region(0, self.view.size()))
        if not self.has_round_queued:
            self.sem.release()
            self.has_round_queued = True

    def final(self):
        handle_errors(self.view, self.errors)
        set_error_status(self.view)
        self.has_round_queued = False

    def work(self):
        while True:
            # Wait on semaphore
            self.sem.acquire()
            # Update the script
            update_server_code(self.filename, self.content)
            # Get errors
            self.errors = serv_get_errors(self.filename)
            sublime.set_timeout(self.final, 1)
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
        print "IN ON LOAD"
        init_view(view)

    def on_modified(self, view):
        if view.is_loading(): return
        if is_ts(view):
            t = self.get_worker_thread(view)
            t.do_more_work()

    def on_selection_modified(self, view):
        if is_ts(view):
            set_error_status(view)

    def on_query_completions(self, view, prefix, locations):
        if is_ts(view):
            # Get the position of the cursor (first one in case of multiple sels)
            pos = view.sel()[0].begin()
            line = view.substr(sublime.Region(view.word(pos-1).a, pos))
            # Determine wether it is a member completion or not
            is_member = line.endswith(".")
            completions_json = serv_get_completions(view.file_name(), pos, is_member)
            set_error_status(view)
            return completions_ts_to_sublime(completions_json)


    def on_query_context(self, view, key, operator, operand, match_all):
        if key == "typescript":
            view = sublime.active_window().active_view()
            return is_ts(view)

# msg("add_file", "bin/test_code.ts")
