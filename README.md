Sublime-Typescript
==================

A Sublime Text plugin for the Typescript language 

Installation
------------

You need to have node.js installed before anything.

Clone the repository in your sublime "Packages" directory. 
You need to clone with the --recursive option, or to put the typescript *source* into the lib/typescript directory.
You also need to ensure that the node executable is on your path, or that the "node_path" key is set somewhere in a
typescript.sublime-settings settings file that sublime text can reach.

~~~sh
git clone https://github.com/raph-amiard/sublime-typescript
~~~

After that you're set and you can use the plugin !
First run might take long to set up, and it will need an internet connection, because the plugin is actually :
- Getting the typescript sources online.
- Compiling it's JS part the first time you will use it.

After that you can use the plugin offline. 
If you don't have an internet connection, getting typescript and unzipping it in the lib/typescript directory will work too.

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
