sublime-typescript
==================

A sublime plugin for the typescript language 

Installation
------------

You need to have node and typescript installed before anything.

Clone the repository in your sublime "Packages" directory, and run the makefile that will compile the plugin and do some configuration
~~~sh
git clone https://github.com/raph-amiard/sublime-typescript --recursive
make
~~~

After that you're set and you can use the plugin !

Usage
-----

For the moment the functionnality is very basic :
- Errors get highlighted and the error message shows in the status bar
- Autocompletion

![Autocompletion feature screenshot](http://i.imgur.com/UR1kn.png)

### Projects

By default, a new instance of the plugin server is created for every file.
The TypeScript language service has an odd behaviour, as in, every file you add to the service will be considered to
be in the same compilation unit as the others.
If you want to specify to the plugin that some files are part of the same project, put a .sublimets file in the folder.
If you don't do that, every file will be opened in a separate plugin instance
