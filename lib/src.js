'use strict';

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();

const detective = require('detective');
const through = require('through2');
const Resolver = require('async-resolve');
const resolver = new Resolver();
const Vinyl = require('vinyl');
const vinylFs = require('vinyl-fs');

const {isString, promiseFlatten} = require('./util');


function read(filepath) {
	return new Promise((resolve, reject)=>fs.readFile(filepath, {encoding: 'utf-8'}, (err, data)=>{
		if (err) return reject(err);
		return resolve(data);
	}));
}

function createVinylFile(filePath, contents, lookup) {
	const vinylFile = new Vinyl({
		cwd,
		base: path.dirname(filePath.replace(cwd, '')),
		path: filePath,
		contents: new Buffer(contents)
	});

	lookup.set(filePath, vinylFile);

	return vinylFile;
}

function getFileContents(files, lookup) {
	return Promise.all(files.map(file=>{
		if (!isString(file)) return Promise.resolve(file);
		if (lookup.has(file)) return Promise.resolve(lookup.get(file));
		return read(file).then(contents=>createVinylFile(file, contents, lookup));
	}));
}

function resolveModule(moduleId, lookup, mapper, root=cwd) {
	return new Promise((resolve, reject)=>resolver.resolve(moduleId, root, (err, absolutePath)=>{
		if (err) return reject(err);
		if (mapper.hasOwnProperty(absolutePath)) return resolve(mapper[absolutePath]);
		if (lookup.has(absolutePath)) return resolve(lookup.get(absolutePath));
		return resolve(absolutePath);
	}));
}

function* fileRequires(file) {
	const requires = detective(file.contents.toString('utf8'));
	for (let n=0; n<requires.length; n++) yield requires[n];
}

function getRequires(file, lookup, mapper) {
	return [...fileRequires(file)].map(async (moduleId)=>{
		if (mapper.hasOwnProperty(moduleId)) return resolveModule(mapper[moduleId], lookup, mapper, cwd);
		if (lookup.has(moduleId)) return lookup.get(moduleId);
		return resolveModule(moduleId, lookup, mapper, path.dirname(file.path));
	});
}

function filterDuplicateFiles() {
	const lookup = new Map();

	return value=>{
		if (lookup.has(value)) return false;
		return lookup.set(value, true);
	}
}

async function getFiles(paths, lookup, options) {
	const files = (await getFileContents(paths, lookup)).map(
		file=>[file, ...getRequires(file, lookup, options.mapper || {})]
	);
	return (await promiseFlatten(files)).filter(filterDuplicateFiles());
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
