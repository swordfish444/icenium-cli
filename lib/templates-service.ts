import * as path from "path";
import * as helpers from "./helpers";
import * as temp from "temp";
import * as shelljs from "shelljs";

export class ConfigurationFile {
	constructor(public template: string,
		public filepath: string,
		public templateFilepath: string,
		public helpText: string) { }
}

export class TemplatesService implements ITemplatesService {
	constructor(private $fs: IFileSystem,
		private $server: Server.IServer,
		private $resources: IResourceLoader,
		private $httpClient: Server.IHttpClient) { }

	public get projectTemplatesDir(): string {
		return this.$resources.resolvePath("ProjectTemplates");
	}

	public get itemTemplatesDir(): string {
		return this.$resources.resolvePath("ItemTemplates");
	}

	public getTemplatesString(regexp: RegExp, replacementNames: IStringDictionary): string {
		let templates = _(this.$fs.readDirectory(this.projectTemplatesDir))
			.map((file: string) => {
				let match = file.match(regexp),
					templateName = match && match[1],
					replacementName = templateName && replacementNames[templateName.toLowerCase()];

				return replacementName || templateName;
			})
			.filter((file: string) => file !== null)
			.value();

		return helpers.formatListOfNames(templates);
	}

	public async downloadProjectTemplates(): Promise<void> {
		let templates = await this.$server.projects.getProjectTemplates();
		let templatesDir = this.projectTemplatesDir;
		this.$fs.deleteDirectory(templatesDir);
		this.$fs.createDirectory(templatesDir);

		await Promise.all(_.map(templates, async (template: any) => await this.downloadTemplate(template, templatesDir)));
	}

	public async downloadItemTemplates(): Promise<void> {
		let templates = await this.$server.projects.getItemTemplates();
		let templatesDir = this.itemTemplatesDir;
		this.$fs.deleteDirectory(templatesDir);
		this.$fs.createDirectory(templatesDir);

		await Promise.all(_.map(templates, async (template: any) => {
			if (template["Category"] === "Configuration") {
				await this.downloadTemplate(template, templatesDir);
			}
		}));
	}

	public async unpackAppResources(): Promise<void> {
		let cordovaAssetsZipFileName = path.join(this.projectTemplatesDir, "Telerik.Mobile.Cordova.Blank.zip");
		await this.unpackAppResourcesCore(this.$resources.resolvePath("Cordova"), cordovaAssetsZipFileName);
		let nsAssetsZipFileName = path.join(this.projectTemplatesDir, "Telerik.Mobile.NS.Blank.zip");
		await this.unpackAppResourcesCore(this.$resources.resolvePath("NativeScript"), nsAssetsZipFileName);
	}

	private async unpackAppResourcesCore(appResourcesDir: string, assetsZipFileName: string): Promise<void> {
		temp.track();
		let extractionDir = temp.mkdirSync("appResourcesTemp");

		// In NativeScript templates App_Resources are under app/App_Resources.
		// In Cordova templates App_Resources are at the root.
		// So extract all *App_Resources and filter them after that, so we'll copy the real App_Resources directory to the destination appResourcesDir.
		await this.$fs.unzip(assetsZipFileName, extractionDir, { caseSensitive: false, overwriteExisitingFiles: true }, ["*App_Resources/**"]);

		let appResourcesDirInTemp = _(this.$fs.enumerateFilesInDirectorySync(extractionDir, null, { enumerateDirectories: true }))
			.filter((file: string) => path.basename(file) === "App_Resources")
			.first();

		if (appResourcesDirInTemp) {
			shelljs.cp("-rf", `${appResourcesDirInTemp}`, appResourcesDir);
		}
	}

	private async downloadTemplate(template: any, templatesDir: string): Promise<void> {
		let downloadUri = template.DownloadUri;
		let name = path.basename(downloadUri);
		let filepath = path.join(templatesDir, name);
		let file = this.$fs.createWriteStream(filepath);
		let fileEnd = this.$fs.futureFromEvent(file, "finish");

		await this.$httpClient.httpRequest({ url: downloadUri, pipeTo: file });
		await fileEnd;
	}
}
$injector.register("templatesService", TemplatesService);
