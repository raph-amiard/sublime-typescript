all: bin/lib.d.ts bin/typescript.js bin/typescriptServices.js core/settings.py bin/main.js

bin/main.js:
	-node lib/typescript/bin/tsc.js src/ts/main.ts --out bin/main.js

core/settings.py:
	echo "PLUGIN_PATH = \"`pwd`\"" >> core/settings.py

bin/lib.d.ts: bin
	cp lib/typescript/bin/lib.d.ts bin/

bin/typescript.js: bin
	cp lib/typescript/bin/typescript.js bin/

bin/typescriptServices.js: bin
	cp lib/typescript/bin/typescriptServices.js bin/

bin:
	mkdir bin

clean:
	rm -rf bin/*
	rm -f core/settings.py
