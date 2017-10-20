'use strict';

/**
 * Turn the given value into an array.  If it is already an array then return it; if it is a set then convert to an
 * array; and if neither then return as the first item in an array. The purpose of this function is for function
 * or method parameters where they can be either a array or not.  You can use this to ensure you are working on
 * an array.
 *
 * @public
 * @param {Array|Set|*} value		Value to return or convert.
 * @returns {Array}					The converted value (or original if already an array).
 */
function makeArray(value) {
	if (value === undefined) return [];
	if (value instanceof Set) return [...value];
	return lodashRequire('castArray')(value);
}

/**
 * Do a flatten-deep on the given array and return a promise.all of promises within it.
 *
 * @param {Array.<Promise|Array>} promiseArray		Array of promises.
 * @returns {Promise}								Promise.all() of all the promisesin the array.
 */
function promiseFlatten(promiseArray) {
	return Promise.all(lodashRequire('flattenDeep')(promiseArray));
}

/**
 * Get the given function from lodash. Given a function name try to load the corresponding module.
 *
 * @throws {ReferenceError}			If function not found then throw error.
 * @param {string} functionName		The function name to find (this will be lower-cased).
 * @returns {Function}				The lodash function.
 */
function lodashRequire(functionName) {
	const moduleId = `lodash.${functionName.toLowerCase()}`;

	try {
		return require(moduleId);
	} catch (err) {
		throw new ReferenceError(`Could not find ${functionName}, did you forget to install ${moduleId}`);
	}
}


module.exports = new Proxy({
	promiseFlatten,
	makeArray
}, {
	get: function(target, property, receiver) {
		if (target.hasOwnProperty(property)) return Reflect.get(target, property, receiver);
		return lodashRequire(property);
	}
});
