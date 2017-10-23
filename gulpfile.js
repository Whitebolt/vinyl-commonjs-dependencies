'use strict';

const gulp = require('gulp');
const babel = require('gulp-babel');

gulp.task('build', ()=>gulp.src(['./lib/*.js'])
	.pipe(babel())
	.pipe(gulp.dest('./build'))
);