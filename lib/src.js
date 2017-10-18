'use strict';

const {makeArray, flatten, isString} = require('./util');
const util = require('util');
const path = require('path');
const cwd = process.cwd();
const fs = require('fs');
const vinylFs = require('vinyl-fs');
const through = require('through2');
const Vinyl = require('vinyl');

const xGetRequire = /[\s\n\r]require\s*?\(\s*?["'](.*?)["']\s*?\)/g;
const xIsJs = /\.js$/;


function read(filepath) {
	return new Promise((resolve, reject)=>fs.readFile(filepath, {encoding: 'utf-8'}, (err, data)=>{
		if (err) return reject(err);
		return resolve(data);
	}));
}

function getFileFromLookup(file, options, lookup) {
	if (!isString(file)) return Promise.resolve(file);
	const filePath = ((options.mapper || {}).hasOwnProperty(file) ?
			path.normalize(cwd + '/' + options.mapper[file]) :
			file
	);
	const filePathJs = xIsJs.test(filePath) ? filePath : filePath + '.js';

	if (lookup.has(filePathJs)) return lookup.get(filePathJs);
	return filePathJs;
}

function getFileContents(files, lookup, options) {
	return Promise.all(files.map(file=>{
		const filePathJs = getFileFromLookup(file, options, lookup);
		if (!isString(filePathJs)) return Promise.resolve(filePathJs);

		return read(filePathJs).then(contents=>{
			const vinylFile = new Vinyl({
				cwd,
				base: path.dirname(filePathJs.replace(cwd, '')),
				path: filePathJs,
				contents: new Buffer(contents)
			});

			lookup.set(filePathJs, vinylFile);
			lookup.set(file, vinylFile);
			return vinylFile;
		});
	}));
}

function expandRequire(filePath, lookup, root=cwd) {
	const firstChar = filePath.charAt(0);
	if ((firstChar !== '.') && (firstChar !== '/')) return filePath;
	const fullFilePath = path.normalize(root + (firstChar === '.' ? '/' : '') + filePath);
	const fullFilePathJs = xIsJs.test(fullFilePath) ? fullFilePath : fullFilePath + '.js';
	return (lookup.has(fullFilePathJs) ? lookup.get(fullFilePathJs) : fullFilePathJs);
}

function getRequires(file, lookup) {
	const requires = [];
	let matches;
	while (matches = xGetRequire.exec(file.contents.toString('utf8'))) {
		requires.push(expandRequire(matches[1], lookup, path.dirname(file.path), file.cwd));
	}
	return requires;
}

function filterDuplicateFiles() {
	const lookup = new Map();

	return value=>{
		if (lookup.has(value)) return false;
		return lookup.set(value, true);
	}
}

async function getFiles(fullPaths, lookup, options) {
	const filePromises = flatten(await getFileContents(fullPaths, lookup, options)).map(
		file=>[file,...getRequires(file, lookup)]
	).map(files=>{
		return files.map(file=>getFileFromLookup(file, options, lookup))
	}).filter(
		filterDuplicateFiles()
	);

	const files = await Promise.all(flatten(filePromises));

	return flatten(files).filter(filterDuplicateFiles());
}

function hasUnloaded(files) {
	return !!files.find(file=>isString(file));
}

async function getMainFiles(file, options) {
	const lookup = new Map();
	let files = await getFiles([file], lookup, options);

	while (hasUnloaded(files)) files = await getFiles(files, lookup, options);

	return files;
}

function src(glob, options={}) {
	return vinylFs.src(glob, options).pipe(through.obj(function(file, encoding, done) {
		getMainFiles(file, options).then(files=>{
			files.forEach(file=>this.push(file));
			done();
		}, err=>console.error(err));
	}));
}

module.exports = src;
