'use strict';


const path = require('path');

const detective = require('detective');
const through = require('through2');
const Resolver = require('async-resolve');
const vinylFile = require('vinyl-file');

const {isString, promiseFlatten} = require('./util');


async function getVinylFile(filePath, options) {
	if (!isString(filePath)) {
		if (!options.lookup.has(filePath.path)) options.lookup.set(filePath.path, filePath);
		return filePath;
	}
	if (options.lookup.has(filePath)) return options.lookup.get(filePath);
	return createVinylFile(filePath, options);
}

async function createVinylFile(filePath, options) {
	const file = await vinylFile.read(filePath, options);
	options.lookup.set(filePath, file);
	return file;
}

function getFileContents(files, options) {
	return Promise.all(files.map(file=>getVinylFile(file, options)));
}

async function resolveModule(moduleId, options, root=options.base) {
	if (options.lookup.has(moduleId)) return options.lookup.get(moduleId);
	const absolutePath = await options.resolver(moduleId, root);
	if (options.mapper.hasOwnProperty(absolutePath)) return options.mapper[absolutePath];
	if (options.lookup.has(absolutePath)) return options.lookup.get(absolutePath);
	return absolutePath;
}

function* fileRequires(file) {
	const requires = detective(file.contents.toString('utf8'));
	for (let n=0; n<requires.length; n++) yield requires[n];
}

function getRequires(file, options) {
	return [...fileRequires(file)].map(async (moduleId)=>{
		if (options.mapper.hasOwnProperty(moduleId)) return resolveModule(options.mapper[moduleId], options);
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
	const files = (await getFileContents(paths, options))
		.map(file=>[file, ...getRequires(file, options)]);
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

function createResolver(options) {
	return (moduleId, base)=>new Promise((resolve, reject)=>{
		const resolver = new Resolver(options.resolver?options.resolver:{});
		resolver.resolve(moduleId, base, (err, absolutePath)=>{
			if (err) return reject(err);
			return resolve(absolutePath);
		});
	})
}

function parseOptions(options={}, vinylCjsDeps) {
	options.gulp = options.gulp || vinylCjsDeps.gulp || require('gulp');
	options.base = options.base || options.cwd || process.cwd();
	options.cwd = options.cwd || options.base;
	options.mapper = options.mapper || {};
	options.lookup = options.lookup || new Map();
	options.resolver = createResolver(options);

	return options;
}

function src(glob, options) {
	const _options = parseOptions(options, this);
	return _options.gulp.src(glob, _options).pipe(srcFilePusher(options));
}

module.exports = src;
