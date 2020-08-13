/*
 * Copyright 2018-2020 IBM Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* global module, require, __dirname */
const func = require('@jupyterlab/testutils/lib/jest-config');
const upstream = func('jupyterlab_go_to_definition', __dirname);

const reuseFromUpstream = [
  'moduleNameMapper',
  'setupFilesAfterEnv',
  'setupFiles',
  'moduleFileExtensions'
];

const local = {
  globals: { 'ts-jest': { tsConfig: 'tsconfig.json' } },
  // eslint-disable-next-line no-useless-escape
  testRegex: `.*\.spec\.tsx?$`,
  transform: {
    '\\.(ts|tsx)?$': 'ts-jest',
    '\\.(js|jsx)?$': '../../testutils/transform.js'
  },
  transformIgnorePatterns: ['/node_modules/(?!(@jupyterlab/.*)/)']
};

for (const option of reuseFromUpstream) {
  local[option] = upstream[option];
}

local['setupFilesAfterEnv'].push('../../testutils/jest.setup.js');

module.exports = local;
