'use strict';

const vinylCjsDeps = {};

vinylCjsDeps.src = require('./lib/src').bind(vinylCjsDeps);

vinylCjsDeps.dest = (...params)=>{
		if (vinylCjsDeps.gulp) return vinylCjsDeps.gulp.dest.bind(vinylCjsDeps.gulp)(...params);
		throw new SyntaxError(`No dest() available because gulp has not been set.`);
};

module.exports = vinylCjsDeps;
