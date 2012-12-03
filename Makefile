all: bin/lib.d.ts bin/typescript.js bin/typescriptServices.js
	tsc src/ts/compilerservice.ts --out bin/compilerservice.js

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
