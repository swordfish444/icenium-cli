import temp = require("temp");
import * as path from "path";
import * as util from "util";
import { KendoUIBaseCommand } from "./kendoui-base";

class KendoUIInstallCommand extends KendoUIBaseCommand implements ICommand {
	constructor(private $fs: IFileSystem,
		private $httpClient: Server.IHttpClient,
		private $logger: ILogger,
		private $opener: IOpener,
		private $prompter: IPrompter,
		$errors: IErrors,
		$kendoUIService: IKendoUIService,
		$loginManager: ILoginManager,
		$options: IOptions,
		$project: Project.IProject) {

		super($errors, $project, $kendoUIService, $loginManager, $options);
	}

	public allowedParameters: ICommandParameter[] = [];

	public async execute(args: string[]): Promise<void> {
		let packages = await this.getKendoPackages();

		let selectedPackage = await this.selectKendoVersion(packages);

		let confirm = this.$options.force || await this.$prompter.confirm(
			"This operation will overwrite existing Kendo UI framework files and " +
			"any changes will be lost. ".red.bold +
			"Are you sure you want to continue?",
			() => true);
		if (!confirm) {
			return;
		}

		await this.updateKendoFiles(selectedPackage.DownloadUrl, selectedPackage.Version);
	}

	private async selectKendoVersion(packages: Server.IKendoDownloadablePackageData[]): Promise<Server.IKendoDownloadablePackageData> {
		let selectedPackage: Server.IKendoDownloadablePackageData;
		if (packages.length === 1) {
			selectedPackage = _.first(packages);
		} else {
			this.$logger.out("You can download and install the following Kendo UI packages.");
			this.$logger.out(this.getKendoPackagesAsTable(packages));
			let schema: IPromptSchema = {
				type: "input",
				name: "packageIdx",
				message: "Enter the index of the package that you want to install.",
				validate: (value: string) => {
					let num = parseInt(value, 10);
					return !isNaN(num) && num >= 1 && num <= packages.length ? true : `Valid values are between 1 and ${packages.length}.`;
				}
			};

			let choice = await this.$prompter.get([schema]);
			let packageIdx = parseInt(choice.packageIdx, 10) - 1;
			selectedPackage = packages[packageIdx];
		}

		if (selectedPackage.HasReleaseNotes && !this.$options.force) {
			let shouldShowReleaseNotes = await this.$prompter.confirm(
				"Do you want to review the release notes for this package?",
				() => true);
			if (shouldShowReleaseNotes) {
				this.$opener.open(selectedPackage.ReleaseNotesUrl);
			}
		}

		this.$logger.trace("The selected package is:");
		this.$logger.trace(selectedPackage);
		return selectedPackage;
	}

	private async updateKendoFiles(downloadUri: string, version: string): Promise<void> {
		temp.track();

		let filepath = temp.path({ suffix: ".zip", prefix: "abkendoupdate-" });
		let file = this.$fs.createWriteStream(filepath);
		let fileEnd = this.$fs.futureFromEvent(file, "finish");
		await this.$httpClient.httpRequest({ url: downloadUri, pipeTo: file });
		await fileEnd;

		let outDir = path.join(this.$project.getProjectDir(), "kendo");
		let backupFolder = `${outDir}.ab-backup`;

		try {
			if (this.$fs.exists(outDir)) {
				this.$fs.rename(outDir, backupFolder);
			}

			await this.$fs.unzip(filepath, outDir);
		} catch (error) {
			if (error.code === "EPERM") {
				this.$errors.failWithoutHelp(`Permission denied, make sure ${outDir} is not locked.`);
			}

			this.$fs.rename(backupFolder, outDir);
			throw error;
		} finally {
			this.$fs.deleteDirectory(backupFolder);
		}

		this.$logger.printMarkdown(util.format("Successfully updated Kendo UI to version `%s`.", version));
	}
}

$injector.registerCommand("update-kendoui", KendoUIInstallCommand);
$injector.registerCommand("kendoui|install", KendoUIInstallCommand);
