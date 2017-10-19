'use strict';

const fs = require('fs');

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
	return (Array.isArray(value)?value:[value]);
}

function flatten(ary) {
	return ary.reduce((acc, cur)=>acc.concat(Array.isArray(cur)?flatten(cur):cur), []);
}

function promiseFlatten(promiseArray) {
	return Promise.all(flatten(promiseArray));
}

function isString(value) {
	return ((typeof value === 'string') || (value instanceof String));
}

function read(filepath) {
	return new Promise((resolve, reject)=>fs.readFile(filepath, {encoding: 'utf-8'}, (err, data)=>{
		if (err) return reject(err);
		return resolve(data);
	}));
}

module.exports = {
	makeArray, flatten, isString, promiseFlatten, read
};
