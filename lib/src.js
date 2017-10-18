'use strict';

const through = require( 'through2' );
const {makeArray, flatten, isString} = require('./util');
const vinylFs = require('vinyl-fs');
const util = require('util');
const path = require('path');
const cwd = process.cwd();
const fs = require('fs');
const toThrough = require('to-through');
const streamify = require('stream-array');
const os = require('os');

const xGetRequire = /[\s\n\r]require\s*?\(\s*?["'](.*?)["']\s*?\)/g;
const xIsJs = /\.js$/;

const globber = util.promisify(require('glob'));

function globbedFiles(file, encoding, callback) {
	console.log(file);
	callback(file);
}

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
			const fileData = {contents, path:filePathJs};
			lookup.set(filePathJs, fileData);
			lookup.set(file, fileData);
			return fileData;
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
	while (matches = xGetRequire.exec(file.contents)) {
		requires.push(expandRequire(matches[1], lookup, path.dirname(file.path)));
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

	return flatten(files).filter(
		filterDuplicateFiles()
	);
}

function hasUnloaded(files) {
	return !!files.find(file=>isString(file));
}

async function getMainFiles(globs, options) {
	const lookup = new Map();
	const relativePaths = flatten(await Promise.all(globs.map(glob=>globber(glob))));
	let files = relativePaths.map(filePath=>path.normalize(cwd + '/' + filePath));

	while (hasUnloaded(files)) files = await getFiles(files, lookup, options);

	//console.log(files);

	return files;
}

function src(globs, options={}) {
	const glob = vinylFs.src(globs, options);
	const Readable = require('stream').Readable;
	const stream = new Readable();
	stream._read = function noop() {};

	getMainFiles(globs, options).then(files=>{
		files.push(os.EOL);
		stream.pipe(streamify(files));
	}, err=>console.error(err));


	return toThrough(stream);
}

module.exports = src;
