'use strict';


const path = require('path');

const cwd = process.cwd();

const detective = require('detective');
const through = require('through2');
const Resolver = require('async-resolve');
const Vinyl = require('vinyl');

const {read, isString, promiseFlatten} = require('./util');


function createVinylFile(filePath, contents, options) {
	const vinylFile = new Vinyl({
		cwd: options.base,
		base: path.dirname(filePath.replace(options.base, '')),
		path: filePath,
		contents: new Buffer(contents)
	});

	options.lookup.set(filePath, vinylFile);

	return vinylFile;
}

function getFileContents(files, options) {
	return Promise.all(files.map(file=>{
		if (!isString(file)) return Promise.resolve(file);
		if (options.lookup.has(file)) return Promise.resolve(options.lookup.get(file));
		return read(file).then(contents=>createVinylFile(file, contents, options));
	}));
}

function resolveModule(moduleId, options, root=options.base) {
	return new Promise((resolve, reject)=>options.resolver.resolve(moduleId, root, (err, absolutePath)=>{
		if (err) return reject(err);
		if (options.mapper.hasOwnProperty(absolutePath)) return resolve(options.mapper[absolutePath]);
		if (options.lookup.has(absolutePath)) return resolve(options.lookup.get(absolutePath));
		return resolve(absolutePath);
	}));
}

function* fileRequires(file) {
	const requires = detective(file.contents.toString('utf8'));
	for (let n=0; n<requires.length; n++) yield requires[n];
}

function getRequires(file, options) {
	return [...fileRequires(file)].map(async (moduleId)=>{
		if (options.mapper.hasOwnProperty(moduleId)) {
			return resolveModule(options.mapper[moduleId], options);
		}
		if (options.lookup.has(moduleId)) return options.lookup.get(moduleId);
		return resolveModule(moduleId, options, path.dirname(file.path));
	});
}

function filterDuplicateFiles() {
	const lookup = new Map();

	return value=>{
		if (lookup.has(value)) return false;
		return lookup.set(value, true);
	}
}

async function getFiles(paths, options) {
	const files = (await getFileContents(paths, options)).map(
		file=>[file, ...getRequires(file, options)]
	);
	return (await promiseFlatten(files)).filter(filterDuplicateFiles());
}

function hasUnloaded(files) {
	return !!files.find(file=>isString(file));
}

async function getMainFiles(file, options) {
	let files = await getFiles([file], options);

	while (hasUnloaded(files)) files = await getFiles(files, options);

	return files;
}

function srcFilePusher(options) {
	return through.obj(function(file, encoding, done) {
		getMainFiles(file, options).then(files=>{
			files.forEach(file=>this.push(file));
			done();
		}, err=>console.error(err));
	})
}

function parseOptions(options={}) {
	options.gulp = options.gulp || require('gulp');
	options.base = options.base || cwd;
	options.mapper = options.mapper || {};
	options.resolver = new Resolver(options.resolver?options.resolver:{});
	options.lookup = new Map();
	return options;
}

function src(glob, options) {
	const _options = parseOptions(options);
	return _options.gulp.src(glob, _options).pipe(srcFilePusher(options));
}

module.exports = src;
