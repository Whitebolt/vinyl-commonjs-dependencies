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
	return (Array.isArray(value)?value:[value]);
}

function flatten(ary) {
	return ary.reduce((acc, cur)=>acc.concat(cur), []);
}

function isString(value) {
	return ((typeof value === 'string') || (value instanceof String));
}

module.exports = {
	makeArray, flatten, isString
};
