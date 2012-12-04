import subprocess
import json

p = subprocess.Popen(["node", "bin/main.js"], stdin=subprocess.PIPE, stdout=subprocess.PIPE)
def msg(*args):
    return json.loads(p.communicate(json.dumps(args) + "\n")[0])

# msg("add_file", "bin/test_code.ts")
