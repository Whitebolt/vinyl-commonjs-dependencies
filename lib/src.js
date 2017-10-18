'use strict';

const {flatten, isString} = require('./util');
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

function getFileFromLookup(file, mapper, lookup) {
	if (!isString(file)) return Promise.resolve(file);
	const filePath = (mapper.hasOwnProperty(file) ? path.normalize(cwd + '/' + mapper[file]) : file);
	const fullPath = xIsJs.test(filePath) ? filePath : filePath + '.js';

	if (lookup.has(fullPath)) return lookup.get(fullPath);
	return fullPath;
}

function getFileContents(files, lookup, options) {
	const mapper = options.mapper || {};
	return Promise.all(files.map(file=>{
		const fullPath = getFileFromLookup(file, mapper, lookup);
		if (!isString(fullPath)) return Promise.resolve(fullPath);

		return read(fullPath).then(contents=>{
			const vinylFile = new Vinyl({
				cwd,
				base: path.dirname(fullPath.replace(cwd, '')),
				path: fullPath,
				contents: new Buffer(contents)
			});

			lookup.set(fullPath, vinylFile);
			lookup.set(file, vinylFile);
			return vinylFile;
		});
	}));
}

function expandRequire(filePath, lookup, root=cwd) {
	const firstChar = filePath.charAt(0);
	if ((firstChar !== '.') && (firstChar !== '/')) return filePath;
	const fullRequirePath = path.normalize(root + (firstChar === '.' ? '/' : '') + filePath);
	const fullPath = xIsJs.test(fullRequirePath) ? fullRequirePath : fullRequirePath + '.js';

	return (lookup.has(fullPath) ? lookup.get(fullPath) : fullPath);
}

function* fileRequires(file) {
	let matches;
	while (matches = xGetRequire.exec(file.contents.toString('utf8'))) yield matches[1];
}

function getRequires(file, lookup) {
	return [...fileRequires(file)].map(moduleId=>
		expandRequire(moduleId, lookup, path.dirname(file.path))
	);
}

function filterDuplicateFiles() {
	const lookup = new Map();

	return value=>{
		if (lookup.has(value)) return false;
		return lookup.set(value, true);
	}
}

async function getFiles(fullPaths, lookup, options) {
	const mapper = options.mapper || {};
	const filePromises = flatten(await getFileContents(fullPaths, lookup, mapper)).map(
		file=>[file, ...getRequires(file, lookup)]
	).map(files=>
		files.map(file=>getFileFromLookup(file, mapper, lookup))
	).filter(
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
