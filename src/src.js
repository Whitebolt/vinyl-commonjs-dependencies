'use strict';

const path = require('path');

const detective = require('detective');
const through = require('through2');
const Resolver = require('async-resolve');
const vinylFile = require('vinyl-file');

const {isString, promiseFlatten} = require('./util');


/**
 * Get a new vinyl-file for the given path, with given options. If already a vinyl-file,just return it.
 *
 * @param {string|VinylFile} filePath		The path to load from.
 * @param {Object}options					Options object.
 * @returns  {VinylFile}					The vinyl-file object.
 */
async function getVinylFile(filePath, options) {
	if (!isString(filePath)) {
		if (!options.lookup.has(filePath.path)) options.lookup.set(filePath.path, filePath);
		return filePath;
	}
	if (options.lookup.has(filePath)) return options.lookup.get(filePath);
	return createVinylFile(filePath, options);
}

/**
 * Create a new vinyl-file for the given path, with given options.
 *
 * @param {string} filePath		The path to load from.
 * @param {Object}options		Options object.
 * @returns  {VinylFile}		New vinyl-file object.
 */
async function createVinylFile(filePath, options) {
	options.lookup.set(filePath, vinylFile.read(filePath, options));
	if (options.debugVcjd) debug(`Reading contents of: ${filePath}`);
	return await options.lookup.get(filePath);
}

/**
 * Get vinyl-files for each of the given file paths.
 *
 * @param {Array.<string|VinylFile} files		Files to get for.
 * @param {Object} options						Options object.
 * @returns {Promise.<VinylFile[]>}				The results.
 */
function getVinylFiles(files, options) {
	return Promise.all(files.map(file=>getVinylFile(file, options)));
}

/**
 * Resolve the path for the given module-id.
 *
 * @param {string} moduleId					Module to resolve for.
 * @param {Object} options					Options object.
 * @param {string} [root=options.base]		Base of path.
 * @returns {Promise.<string>}				The resolved path.
 */
async function resolveModule(moduleId, options, root=options.base) {
	if (options.lookup.has(moduleId)) return options.lookup.get(moduleId);
	const absolutePath = await options.resolver(moduleId, root);
	if (options.mapper.hasOwnProperty(absolutePath)) return options.mapper[absolutePath];
	if (options.lookup.has(absolutePath)) return options.lookup.get(absolutePath);
	return absolutePath;
}

/**
 * Generator for all the dependencies of a given file.
 *
 * @param {VinylFile} file		File to get for.
 * @yield {string}				Dependency path
 */
function* fileRequires(file) {
	try {
		const requires = detective(file.contents.toString('utf8'));
		for (let n=0; n<requires.length; n++) {
			if (options.debugVcjd) debug(`Found require for: ${requires[n]} in ${file.path}.`);
			yield requires[n];
		}
	} catch(err) {

	}
}

/**
 * Get all the require paths for a given file.
 *
 * @param {VinylFile} file		File to get for.
 * @param {Object} options		Options object.
 * @returns {Array.<string>}	Dependency paths.
 */
function getRequires(file, options) {
	return [...fileRequires(file)].map(async (moduleId)=>{
		if (options.internalOnly && (moduleId.charAt(0) !== '.') && (moduleId.charAt(0) !== '/')) {
			if (options.mapper[moduleId] !== true) return undefined;
		}

		if (options.mapper.hasOwnProperty(moduleId) && !(options.internalOnly && (options.mapper[moduleId] === true))) {
			if (options.mapper[moduleId]) return resolveModule(options.mapper[moduleId], options);
			return undefined;
		}
		return resolveModule(moduleId, options, path.dirname(file.path));
	});
}

/**
 * Filter-out any files that are already loaded.
 *
 * @returns {Function}		Filter function to track duplicates (for use in Array.prototype.filter()).
 */
function filterDuplicateFiles() {
	const lookup = new Map();

	return value=>{
		if (lookup.has(value)) return false;
		return lookup.set(value, true);
	}
}

/**
 * Get all files and their dependencies on given path.
 *
 * @param {string} paths							Path to get from.
 * @param {Object} options							Options object.
 * @returns {Promise.<VinylFile[]|string[]>}		The found files.
 */
async function getFiles(paths, options) {
	const files = (await getVinylFiles(paths, options))
		.map(file=>[file, ...getRequires(file, options)]);
	return (await promiseFlatten(files)).filter(file=>file).filter(filterDuplicateFiles());
}

/**
 * Check if given array of vinyl-files has any strings and hence vinyl-file not yet loaded.
 *
 * @param {Array.<VinylFile|string>} files		Files to test.
 * @returns {boolean}							String found?
 */
function hasUnloaded(files) {
	return !!files.find(file=>isString(file));
}

/**
 * Get input file and its dependencies.
 *
 * @param {VinylFile|string} file		File to get for.
 * @param {Object} options				Options object.
 * @returns {Promise.<VinylFile[]>}		Vinyl files found.
 */
async function getAllFiles(file, options) {
	let files = await getFiles([file], options);
	while (hasUnloaded(files)) files = await getFiles(files, options);
	return files;
}

/**
 * Push Vinyl files into object stream.
 *
 * @param {Object} options		Options object.
 */
function srcFilePusher(options) {
	return through.obj(function(file, encoding, done) {
		getAllFiles(file, options).then(files=>{
			files.forEach(file=>this.push(file));
			done();
		}, err=>{});
	})
}

function debug(message) {
	console.log(`Vinyl-CommonJs-Tree [DEBUG]: ${message}`);
}

/**
 * Create a async-resolver from the given options and return as promise-wrapped function.
 *
 * @param {Object} options				Options object.
 * @returns {Function.<Promise>}		Resolver function.
 */
function createResolver(options) {
	return (moduleId, base)=>new Promise((resolve, reject)=>{
		const resolver = new Resolver(options.resolver?options.resolver:{});
		resolver.resolve(moduleId, base, (err, absolutePath)=>{
			if (err) {
				if (options.debugVcjd) debug(`Could not resolve path to module: ${moduleId}\nFrom base: ${base}`);
				return reject(err);
			}
			if (options.debugVcjd) debug(`Resolved module: ${moduleId}:\nFrom base: ${base}\n:Is: ${base}`);
			return resolve(absolutePath);
		});
	})
}

/**
 * Parse the src options adding defaults.
 *
 * @param {object} options			Options object.
 * @param {Object} vinylCjsDeps		The module.
 * @returns {Object}				Mutated options (defaults added).
 */
function parseOptions(options={}, vinylCjsDeps) {
	options.gulp = options.gulp || vinylCjsDeps.gulp || require('gulp');
	options.base = options.base || options.cwd || process.cwd();
	options.cwd = options.cwd || options.base;
	options.mapper = options.mapper || {};
	options.lookup = options.lookup || new Map();
	options.resolver = createResolver(options);
	options.internalOnly = options.internalOnly || false;
	options.debugVcjd = options.debugVcjd || false;

	return options;
}

function src(glob, options) {
	const _options = parseOptions(options, this);
	return _options.gulp.src(glob, _options).pipe(srcFilePusher(_options));
}

module.exports = src;
