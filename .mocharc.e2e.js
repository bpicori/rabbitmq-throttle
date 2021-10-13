'use strict';

module.exports = {
	jobs: 1,
	package: './package.json',
	require: ['ts-node/register', 'source-map-support/register'],
	spec: ['tests/before.ts', 'tests/**/*.spec.ts', 'tests/after.ts'],
	recursive: true,
	timeout: 40000,
	exit: true,
	slow: 30000,
};
