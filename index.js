'use strict';

require("babel-polyfill");

const vinylCjsDeps = {};

vinylCjsDeps.src = require('./build/src').bind(vinylCjsDeps);

vinylCjsDeps.dest = (...params)=>{
		if (vinylCjsDeps.gulp) return vinylCjsDeps.gulp.dest.bind(vinylCjsDeps.gulp)(...params);
		throw new SyntaxError(`No dest() available because gulp has not been set.`);
};

module.exports = vinylCjsDeps;
