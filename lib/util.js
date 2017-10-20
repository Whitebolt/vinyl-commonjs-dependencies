'use strict';

const util = require('lodash-provider');
util.__require = require;

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
util.makeArray = function makeArray(value) {
	if (value === undefined) return [];
	if (value instanceof Set) return [...value];
	return util.castArray(value);
};

/**
 * Do a flatten-deep on the given array and return a promise.all of promises within it.
 *
 * @param {Array.<Promise|Array>} promiseArray		Array of promises.
 * @returns {Promise}								Promise.all() of all the promisesin the array.
 */
util.promiseFlatten = function promiseFlatten(promiseArray) {
	return Promise.all(util.flattenDeep(promiseArray));
};


module.exports = util;
