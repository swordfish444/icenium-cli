import yok = require("../lib/common/yok");
import Future = require("fibers/future");
import stubs = require("./stubs");
import temp = require("temp");
import hostInfoLib = require("../lib/common/host-info");
temp.track();
import {assert} from "chai";
import * as fileSys from "fs";

let multipartUploadServiceFile = require("../lib/services/multipart-upload");
let fileSystemFile = require("../lib/common/file-system");
let hashServiceFile = require("../lib/services/hash-service");

class ServiceProxy implements Server.IServiceProxy {
	call<T>(name: string, method: string, path: string, accept: string, body: Server.IRequestBodyElement[], resultStream: NodeJS.WritableStream, headers?: any): IFuture<T> {
		return (() => {/*intentionally empty*/}).future<any>()();
	}
	setShouldAuthenticate(shouldAuthenticate: boolean): void { /* mock */}
	setSolutionSpaceName(solutionSpaceName: string): void { /* mock */ }
}

function createTestInjector(): IInjector {
	let testInjector = new yok.Yok();

	testInjector.register("hostInfo", hostInfoLib.HostInfo);
	testInjector.register("fs", fileSystemFile.FileSystem);
	testInjector.register("hashService", hashServiceFile.HashService);
	testInjector.register("errors", stubs.ErrorsStub);
	testInjector.register("logger", stubs.LoggerStub);
	testInjector.register("multipartUploadService", multipartUploadServiceFile.MultipartUploadService);
	// Hack the static variables
	multipartUploadServiceFile.MultipartUploadService.CHUNK_SIZE = 10;
	return testInjector;
}

function createTempFile(data: string): IFuture<string> {
	let future = new Future<string>();
	let myData = new Buffer(data); // "Some data that has to be uploaded.";
	let pathToTempFile: string;
	temp.open("tempMultipartUploadFile", function(err, info) {
		if(!err) {
			pathToTempFile = info.path;

			fileSys.write(info.fd, myData, 0, data.length, 0, () => {
				future.return(pathToTempFile);
			});
		} else {
			future.throw(err);
		}
	});

	return future;
}

async function createTestScenarioForContentRangeValidation(data: string): Promise<string[]> {
		let testInjector = createTestInjector();

		testInjector.register("server", {
			upload: {
				completeUpload(path: string, originalFileHash: string): IFuture<void>{
					return Future.fromResult();
				},
				initUpload(path: string): IFuture<void>{
					return Future.fromResult();
				},
				uploadChunk(path: string, hash: string, content: any): IFuture<void>{
					return Future.fromResult();
				}
			}
		});

		let actualContentRanges: string[] = [];
		testInjector.register("serviceProxy", {
			call: <T>(name: string, method: string, path: string, accept: string, body: Server.IRequestBodyElement[], resultStream: NodeJS.WritableStream, headers?: any): IFuture<T> => {
				return (() => {
					actualContentRanges.push(headers["Content-Range"]);
			},
			setShouldAuthenticate: (shouldAuthenticate: boolean): void => {/* mock */ },
			setSolutionSpaceName: (solutionSpaceName: string): void => {/* mock */ }
		});

		let mpus: IMultipartUploadService = testInjector.resolve("multipartUploadService");
		let tempFilePath = await  createTempFile(data);

		mpus.uploadFileByChunks(tempFilePath, "bucketKey").wait();

		return actualContentRanges;
	}).future<string[]>()();
}

function createDataWithSpecifiedLength(length: number): string {
	let data = "";
	for(let i = 0; i < length; i++) {
		data += "a";
	}

	return data;
}

describe("multipart upload service", () => {
	describe("uploadChunk", () => {
		// As the current autogenerated code for uploadChunk method is unusable for us,
		// this test verifies that we are calling our own uploadChunk method.
		it("does NOT call autogenerated UploadChunk", () => {
			let testInjector = createTestInjector();
			let completeUploadCalled = false,
				initUploadCalled = false,
				uploadChunkCalled = false;
			testInjector.register("server", {
				upload: {
					completeUpload(path: string, originalFileHash: string): IFuture<void>{
						return (() => completeUploadCalled = true).future<void>()();
					},
					initUpload(path: string): IFuture<void>{
						return (() => initUploadCalled = true).future<void>()();
					},
					uploadChunk(path: string, hash: string, content: any): IFuture<void>{
						return (() => uploadChunkCalled = true).future<void>()();
					}
				}
			});
			testInjector.register("serviceProxy", ServiceProxy);

			let mpus: IMultipartUploadService = testInjector.resolve("multipartUploadService");
			let tempFilePath = await  createTempFile("Some data that has to be uploaded.");

			mpus.uploadFileByChunks(tempFilePath, "bucketKey").wait();
			assert.isTrue(initUploadCalled);
			assert.isTrue(completeUploadCalled);
			assert.isFalse(uploadChunkCalled);
		});

		it("sends correct Content-Ranges", () => {
			let expectedContentRanges = ["bytes 0-9/34", "bytes 10-19/34", "bytes 20-29/34", "bytes 30-33/34"];
			let actualContentRanges = await  createTestScenarioForContentRangeValidation(createDataWithSpecifiedLength(34));
			assert.deepEqual(expectedContentRanges, actualContentRanges);
		});

		it("sends correct Content-Ranges when fileSize is exact multiple of chunk size", () => {
			let expectedContentRanges = ["bytes 0-9/20", "bytes 10-19/20"];
			let actualContentRanges = await  createTestScenarioForContentRangeValidation(createDataWithSpecifiedLength(20));
			assert.deepEqual(expectedContentRanges, actualContentRanges);
		});

		/* fileSize = (x*chunkSize) - 1 */
		it("sends correct Content-Ranges when fileSize is multiple of chunk size minus one", () => {
			let expectedContentRanges = ["bytes 0-9/19", "bytes 10-18/19"];
			let actualContentRanges = await  createTestScenarioForContentRangeValidation(createDataWithSpecifiedLength(19));
			assert.deepEqual(expectedContentRanges, actualContentRanges);
		});

		/* fileSize = (x*chunkSize) + 1 */
		it("sends correct Content-Ranges when fileSize is multiple of chunk size plus one", () => {
			let expectedContentRanges = ["bytes 0-9/21", "bytes 10-19/21", "bytes 20-20/21"];
			let actualContentRanges = await  createTestScenarioForContentRangeValidation(createDataWithSpecifiedLength(21));
			assert.deepEqual(expectedContentRanges, actualContentRanges);
		});
	});
});
