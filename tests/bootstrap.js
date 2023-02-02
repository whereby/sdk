/* eslint-env node */

const chai = require("chai");

chai.use(require("dirty-chai"));
chai.use(require("chai-as-promised"));
chai.use(require("sinon-chai"));

global.expect = chai.expect;
global.sinon = require("sinon");
chai.config.truncateThreshold = 0;
