import * as util from "util";

export class MultipartUploadService implements IMultipartUploadService {
	private static CHUNK_SIZE = 1024 * 1024 * 20;
	private static INPUT_FILE_ENCODING = "binary";
	private static HASH_ALGORITHM = "sha512";
	private static HASH_ENCODING = "base64";
	private static MAX_CONCURRENT_UPLOADS = 3;

	constructor(private $fs: IFileSystem,
		private $server: Server.IServer,
		private $serviceProxy: Server.IServiceProxy,
		private $hashService: IHashService,
		private $logger: ILogger) { }

	public async uploadFileByChunks(filePath: string, bucketKey: string): Promise<void> {
		let fileSize: number = this.$fs.getFileSize(filePath);
		let chunkStartByte = 0,
			endByte: number;

		await this.$server.upload.initUpload(bucketKey);

		let chunks: Promise<void>[] = [];
		while (chunkStartByte < fileSize) {
			// exclusive endByte
			endByte = chunkStartByte + MultipartUploadService.CHUNK_SIZE;

			if (endByte > fileSize) {
				endByte = fileSize;
			}

			let chunkStream = this.$fs.createReadStream(filePath, { start: chunkStartByte, end: endByte });
			let promise = this.uploadChunk(bucketKey, chunkStartByte, endByte, chunkStream, fileSize);
			chunks.push(promise);
			chunkStartByte = endByte;
			if (chunks.length === MultipartUploadService.MAX_CONCURRENT_UPLOADS) {
				await Promise.all(chunks);
				chunks = [];
			}
		}

		if (chunks.length > 0) {
			await Promise.all(chunks);
		}

		let fileHash = await this.$hashService.getFileHash(filePath, MultipartUploadService.INPUT_FILE_ENCODING, MultipartUploadService.HASH_ALGORITHM, MultipartUploadService.HASH_ENCODING);

		await this.$server.upload.completeUpload(bucketKey, fileHash);
	}

	private async uploadChunk(path: string, startingIndex: number, endIndex: number, content: NodeJS.ReadableStream, fileSize: number): Promise<void> {
		let headers = {
			"Content-Range": util.format("bytes %d-%d/%s", startingIndex, endIndex - 1, fileSize),
			"Content-Length": endIndex - startingIndex
		};

		this.$logger.trace("Uploading chunk with Content-Range: %s", headers["Content-Range"]);
		// hack to override chunkUpload as in autogenerated code we cannot specify Content-Range header.
		return this.$serviceProxy.call<void>('UploadChunk', 'PUT', ['api', 'upload', encodeURI(path.replace(/\\/g, '/'))].join('/'), null, [{ name: 'content', value: content, contentType: 'application/octet-stream' }], null, headers);
	}
}

$injector.register("multipartUploadService", MultipartUploadService);
