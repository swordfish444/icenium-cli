import yok = require("../lib/common/yok");
import stubs = require("./stubs");
import pnv = require("../lib/common/validators/project-name-validator");
import { assert } from "chai";

describe("project-name-validator smoke tests", () => {

	let validator: IProjectNameValidator;
	before(() => {
		let testInjector = new yok.Yok();
		testInjector.register("errors", stubs.ErrorsStub);
		validator = testInjector.resolve(pnv.ProjectNameValidator);
	});

	it("invalid chars in the middle", () => {
		assert.throws(() => validator.validate("d@#z"));
	});

	it("invalid chars at start", () => {
		assert.throws(() => validator.validate("\\app"));
	});

	it("invalid chars at end", () => {
		assert.throws(() => validator.validate("app//"));
	});

	it("only numbers", () => {
		assert.strictEqual(true, validator.validate("123"));
	});

	it("invalid length", () => {
		assert.throws(() => validator.validate("Thirtyone character long string"));
	});
});
