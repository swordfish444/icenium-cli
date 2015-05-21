///<reference path=".d.ts"/>
"use strict";

import yok = require("../lib/common/yok");

import Future = require("fibers/future");
import stubs = require("./stubs");
import hostInfoLib = require("../lib/common/host-info");
import temp = require("temp");
temp.track();
import util = require("util");
let assert = require("chai").assert;
let fileSys = require("fs");

let fileSystemFile = require("../lib/common/file-system");
let hashServiceFile = require("../lib/services/hash-service");

let failed = false;

function createTestInjector(): IInjector {
	let testInjector = new yok.Yok();

	testInjector.register("fs", fileSystemFile.FileSystem);
	testInjector.register("hashService", hashServiceFile.HashService);
	testInjector.register("logger", stubs.LoggerStub);
	testInjector.register("errors", stubs.ErrorsNoFailStub);
	testInjector.register("hostInfo", hostInfoLib.HostInfo);

	let errors = testInjector.resolve("errors");
	errors.fail = (...args: any[]) => {
		failed = true;
		throw new Error(args[0]);
	};

	return testInjector;
}

function createTempFile(data: string): IFuture<string> {
	let future = new Future<string>();
	let myData = data; // "Some data that has to be uploaded.";
	let pathToTempFile: string;
	temp.open("tempHashServiceTestsFile", function(err, info) {
		if(!err) {
			fileSys.write(info.fd, myData);
			pathToTempFile = info.path;
			future.return(pathToTempFile);
		} else {
			future.throw(err);
		}
	});

	return future;
}

describe("hash service", () => {
	describe("getFileHash", () => {
		// As the current autogenerated code for uploadChunk method is unusable for us,
		// this test verifies that we are calling our own uploadChunk method.
		it("fails when file doesn't exist", () => {
			failed = false;
			let expectedErrorMessage = "Specified file thisFileDoesNotExist does not exist.";
			let testInjector = createTestInjector();
			let hashService: IHashService = testInjector.resolve("hashService");
			try {
				hashService.getFileHash("thisFileDoesNotExist", "utf8", "sha512", "base64").wait();
			} catch(e) {
				assert.isTrue(failed);
				assert.isTrue(e.message.indexOf(expectedErrorMessage) > -1);
			}
		});

		it("fails when input file encoding is not correct", () => {
			failed = false;
			let expectedErrorMessage = "Specified input file encoding not valid is not valid.";
			let testInjector = createTestInjector();
			let hashService: IHashService = testInjector.resolve("hashService");
			let filePath = createTempFile("testFile").wait();
			try {
				hashService.getFileHash(filePath, "not valid", "sha512", "base64").wait();
			} catch(e) {
				assert.isTrue(failed);
				assert.isTrue(e.message.indexOf(expectedErrorMessage) > -1);
			}
		});

		it("fails when input hash algorithm is not correct", () => {
			failed = false;
			let expectedErrorMessage = "Specified hash algorithm not valid is not valid. Valid algorithms are";
			let testInjector = createTestInjector();
			let hashService: IHashService = testInjector.resolve("hashService");
			let filePath = createTempFile("testFile").wait();
			try {
				hashService.getFileHash(filePath, "utf8", "not valid", "base64").wait();
			} catch(e) {
				assert.isTrue(failed);
				assert.isTrue(e.message.indexOf(expectedErrorMessage) > -1);
			}
		});

		it("fails when hash encoding is not correct", () => {
			failed = false;
			let expectedErrorMessage = "Specified hash encoding not valid is not valid. Valid values are";
			let testInjector = createTestInjector();
			let hashService: IHashService = testInjector.resolve("hashService");
			let filePath = createTempFile("testFile").wait();
			try {
				hashService.getFileHash(filePath, "utf8", "sha512", "not valid").wait();
			} catch(e) {
				assert.isTrue(failed);
				assert.isTrue(e.message.indexOf(expectedErrorMessage) > -1);
			}
		});

		it("does not fail when input parameters are correct", () => {
			failed = false;
			
			let testInjector = createTestInjector();
			let hashService: IHashService = testInjector.resolve("hashService");
			// NOTE: in case you change testFile string passed to createTempFile, you should create new hash file as well.
			let filePath = createTempFile("testFile").wait();
			let expectedHash = "kpcHKUXV7JjoyHcXqsVB5EAz+HX1ffWA/X48ozSakHgaNR3OiEctsMKafwewR836Gi4dRyBsjW+GkR+hTQ4Qog=="
			let hash = hashService.getFileHash(filePath, "utf8", "sha512", "base64").wait();
			
			assert.isFalse(failed);
			assert.equal(expectedHash, hash);
		});
	});
});
