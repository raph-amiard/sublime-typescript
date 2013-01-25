Sublime-Typescript
==================

A Sublime Text plugin for the Typescript language 

Installation
------------

You need to have node.js and Typescript installed before anything.

Clone the repository in your sublime "Packages" directory, and run the makefile that will compile the plugin and do some configuration

~~~sh
git clone https://github.com/raph-amiard/sublime-typescript --recursive
make
~~~

After that you're set and you can use the plugin !

Usage
-----

For the moment the functionnality is very basic :
- Errors get highlighted and the errors messages shows in the status bar
- Autocompletion works (quite well thanks to the TypeScript language service)

![Autocompletion feature screenshot](http://i.imgur.com/UR1kn.png)

### Settings

All the settings discussed here can be set either in the typescript.sublime-settings file of the plugin folder, or in your own typescript.sublime-settings, as is usual with sublime text configuration

#### Node path

If node isn't on your path, or you want to set the node executable path manually, you can set the "node_path" key to refer to the node executable path, **including the executable name**.

~~~json
{
    "node_path":"/my/path/to/node/node"
}
~~~

### Projects

By default, a new instance of the plugin server is created for every file.
The TypeScript language service has an odd behaviour, as in, every file you add to the service will be considered to
be in the same compilation unit as the others.
If you want to specify to the plugin that some files are part of the same project, put a .sublimets file in the folder.
If you don't do that, every file will be opened in a separate plugin instance
