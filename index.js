'use strict';

require("babel-polyfill");

const vinylCjsDeps = {};

vinylCjsDeps.src = require('./build/src').bind(vinylCjsDeps);

vinylCjsDeps.dest = ()=>{
		if (vinylCjsDeps.gulp) return vinylCjsDeps.gulp.dest.apply(vinylCjsDeps.gulp, arguments);
		throw new SyntaxError(`No dest() available because gulp has not been set.`);
};

module.exports = vinylCjsDeps;
