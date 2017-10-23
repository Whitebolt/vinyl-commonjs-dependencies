## Vinyl CommonJs Dependencies

A vinyl adaptor for for commonJs dependency trees. Push dependant files that into a vinyl object stream.

The main use-case being gulp build processes that parse node modules for reuse in the browser.

# Install

```bash
npm install --save-dev vinyl-commonjs-dependencies
```

Or

```bash
yarn add --dev vinyl-commonjs-dependencies
```

# Example use

```javascript

const gulp = require('gulp');
const vcjd = require('vinyl-commonjs-dependencies');
const commonjsBrowserWrap = require('gulp-commonjs-browser-wrap');
const concat = require('gulp-concat');

vcd.gulp = gulp // So same version is being used and so we can access gulp.dest via vcjd class.

gulp.task('build', ()=>vcjd.src(['./index.js'])
	.pipe(commonjsBrowserWrap())
    .pipe(concat('browser.js'))
    .pipe(commonjsBrowserWrap({
    	type:'moduleWrap',
    	main:['./index.js']
    }))
    .pipe(vcjd.dest(settings.dest))
);
```

In the example above we have a basic build task in gulp.  Code is sourced from *./index.js* and it dependencies.  Files are concatenated together and then [commonjs-browser-wrap](https://github.com/Whitebolt/gulp-commonjs-browser-wrap) is used to create a browser wrapped version with no loader dependencies.

# vcjd.src(*globs* *[,options]*)

Wraps *gulp.src()* to parse supplied paths for main files.  These input files are then parsed for their dependencies, which are then added to the stream. 

In most cases, one input file would be supplied but is possible to supply as many as you want.

 | Parameter | Type | Description |
 | --- | --- | --- |
 | globs | *string*\| Array.\<string\> | Glob or array of globs to read. Globs use [node-glob](https://github.com/isaacs/node-glob) syntax except that negation is fully supported. |
 | options | *Object* | Options to pass to [node-glob](https://github.com/isaacs/node-glob#options) through [glob-stream](https://github.com/gulpjs/glob-stream). Vcjd supports all options supported by node-glob / glob-stream (except ignore) and [gulp](https://github.com/gulpjs/gulp/blob/master/docs/API.md#options). |
 
 ### Other options
 
As well as supporting all the standard gulp.src() options; Vcjd also supports the following:

 |property | type | description |
 | --- | --- | --- |
 | gulp | *Gulp* | Used to pass a gulp instance into Vcjd.  This is useful if you need to pass a specific version into the adaptor to use for src() |
 | mapper | *Object* | A module lookup object.  You may want to override module names or locations.  This a direct mapping object, so keys are module-ids (or paths) and values are their overridden path / id.  If value of mapper property is set to null then given module will be skipped and not pulled into the stream.  If the value is set to true it will override any *internalOnly* settong for given module. |
 | lookup | *Map* | This is a map, which maps full-paths to vinyl files.  Used internally to cache loaded files and avoid reloading.  It could be used to pre-cache some files |
 | resolver | Object | Options object to be passed to [async-resolve](https://github.com/Meettya/async-resolve).  If not supplied then defaults are used, which are normally what is needed.
 | internalOnly | boolean | If set then will only pull in local files rather than loading all requires (including modules from node_modules). |
 
 ### Example using mapper:
 
 ```javascript
 const gulp = require('gulp');
 const vcjd = require('vinyl-commonjs-dependencies');

gulp.task('build', ()=>vcjd.src(['./index.js'], {
	mapper: {
    	'text-encoding': './lib/textEncoding'
    }})
	// Do something here ...
    .pipe(vcjd.dest(settings.dest))
);
```

Here we are telling Vcjd that we want to override the *text-encoding* module with our own local version. Perhaps we just want to use the native one in the browser so our local module exports this.

## vcjd.gulp

This is just simple way to pass gulp to the module.  It allows for *vcjd.dest()* to wrap the gulp version.

## vcjs.dest(*path* [, *options*])

This is the just a wrapped version of *gulp.dest()* and does nothing special.


