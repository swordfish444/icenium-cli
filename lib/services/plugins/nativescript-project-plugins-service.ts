import * as path from "path";
import * as util from "util";
import * as semver from "semver";
import { EOL } from "os";
import { getFuturesResults } from "../../common/helpers";
import { MarketplacePluginData } from "../../plugins-data";
import { isInteractive } from "../../common/helpers";
import { NODE_MODULES_DIR_NAME } from "../../common/constants";
import { PluginsServiceBase } from "./plugins-service-base";
import temp = require("temp");

temp.track();

export class NativeScriptProjectPluginsService extends PluginsServiceBase implements IPluginsService {
	private static NPM_SEARCH_URL = "http://npmsearch.com";
	private static HEADERS = ["NPM Packages", "NPM NativeScript Plugins", "Marketplace Plugins", "Advanced Plugins"];
	private static DEFAULT_NUMBER_OF_NPM_PACKAGES = 10;
	private static NATIVESCRIPT_LIVEPATCH_PLUGIN_ID = "nativescript-plugin-livepatch";

	private featuredNpmPackages = [NativeScriptProjectPluginsService.NATIVESCRIPT_LIVEPATCH_PLUGIN_ID];
	private marketplacePlugins: IPlugin[];

	constructor(private $nativeScriptResources: INativeScriptResources,
		private $typeScriptService: ITypeScriptService,
		private $pluginVariablesHelper: IPluginVariablesHelper,
		private $projectMigrationService: Project.IProjectMigrationService,
		private $server: Server.IServer,
		$errors: IErrors,
		$logger: ILogger,
		$prompter: IPrompter,
		$fs: IFileSystem,
		$project: Project.IProject,
		$projectConstants: Project.IConstants,
		$childProcess: IChildProcess,
		$httpClient: Server.IHttpClient,
		$options: IOptions,
		$npmService: INpmService,
		$hostInfo: IHostInfo,
		$npmPluginsService: INpmPluginsService) {
		super($errors, $logger, $prompter, $fs, $project, $projectConstants, $childProcess, $httpClient, $options, $npmService, $npmPluginsService);
		let versions: string[] = (<any[]>this.$fs.readJson(this.$nativeScriptResources.nativeScriptMigrationFile).supportedVersions).map(version => version.version);
		let frameworkVersion = this.$project.projectData.FrameworkVersion;
		if (!_.includes(versions, frameworkVersion)) {
			this.$errors.failWithoutHelp(`Your project targets NativeScript version '${frameworkVersion}' which does not support plugins.`);
		}
	}

	public async init(): Promise<void> {
		await this.$projectMigrationService.migrateTypeScriptProject();
	}

	public async  getAvailablePlugins(pluginsCount?: number): Promise<IPlugin[]> {
		let count = pluginsCount || NativeScriptProjectPluginsService.DEFAULT_NUMBER_OF_NPM_PACKAGES;
		return _.concat(await this.getUniqueMarketplacePlugins(),
			await this.getTopNpmPackages(count),
			await this.getTopNativeScriptNpmPackages(count),
			await this.getFeaturedNpmPackages());
	}

	public async getInstalledPlugins(): Promise<IPlugin[]> {
		let pathToPackageJson = this.getPathToProjectPackageJson();

		if (this.$fs.exists(pathToPackageJson)) {
			let content = this.$fs.readJson(pathToPackageJson);
			if (content && content.dependencies) {
				let pluginsToFilter = await Promise.all(_.map(content.dependencies, async (version: string, name: string) => {
					let marketplacePlugin = _.find(await this.getMarketplacePlugins(), pl => pl.data.Name === name && pl.data.Version === version);
					let plugin = marketplacePlugin ||
						await this.getDataForNpmPackage(name, version) ||
						await this.getDataForLocalPlugin(name, version) ||
						await this.getDataFromGitHubUrl(name, version);
					if (!plugin) {
						this.$logger.warn(`Unable to find information about plugin '${name}' with version '${version}'.`);
					}

					return plugin;
				}));

				return _.filter(pluginsToFilter, i => !!i);
			}
		}

		return null;
	}

	public async printPlugins(plugins: IPlugin[]): Promise<void> {
		let groups = _.groupBy(plugins, (plugin: IPlugin) => plugin.type);
		let outputLines: string[] = [];

		_.each(Object.keys(groups), (group: string) => {
			outputLines.push(util.format("%s:%s======================", NativeScriptProjectPluginsService.HEADERS[+group], EOL));

			let sortedPlugins = _.sortBy(groups[group], (plugin: IPlugin) => plugin.data.Name);
			_.each(sortedPlugins, (plugin: IPlugin) => {
				outputLines.push(plugin.pluginInformation.join(EOL));
			});
		});

		this.$logger.out(outputLines.join(EOL + EOL));
	}

	public async addPlugin(pluginIdentifier: string): Promise<void> {
		let pluginBasicInfo: IBasicPluginInformation;
		if (await this.isPluginInstalled(pluginIdentifier)) {
			this.$logger.printMarkdown(util.format("Plugin `%s` is already installed.", pluginIdentifier));
			return;
		}

		if (this.hasTgzExtension(pluginIdentifier)) {
			pluginBasicInfo = await this.fetchPluginBasicInformation(path.resolve(pluginIdentifier), "add", null, { actualName: pluginIdentifier, isTgz: true, addPluginToConfigFile: false });
		} else if (await this.checkIsValidLocalPlugin(pluginIdentifier)) {
			pluginBasicInfo = await this.installLocalPlugin(pluginIdentifier, { actualName: pluginIdentifier, isTgz: false, addPluginToConfigFile: true });
		} else {
			pluginBasicInfo = await this.setPluginInPackageJson(pluginIdentifier, { addPluginToPackageJson: true });
		}

		if (this.$typeScriptService.isTypeScriptProject(this.$project.projectDir)) {
			// Do not pass version here, we've already added the entry in package.json, so the correct version will be installed anyway.
			let installResult = await this.$npmService.install(this.$project.projectDir, { installTypes: this.$options.types, name: pluginBasicInfo.name });
			if (installResult.error) {
				this.$errors.failWithoutHelp(`Error while installing dependency: ${installResult.error.message}.`);
			}
		}

		this.$logger.printMarkdown(util.format("Successfully added plugin `%s`.", pluginBasicInfo.name));
	}

	public async removePlugin(pluginName: string): Promise<void> {
		let pathToPackageJson = this.getPathToProjectPackageJson();
		let packageJsonContent = this.getProjectPackageJsonContent();
		let pluginBasicInfo = await this.getPluginBasicInformation(pluginName);
		if (packageJsonContent.dependencies[pluginBasicInfo.name]) {
			let pathToPlugin = packageJsonContent.dependencies[pluginBasicInfo.name].toString().replace("file:", "");

			let fullPluginPath = path.join(this.$project.projectDir, pathToPlugin);

			if (await this.checkIsValidLocalPlugin(pathToPlugin) || (this.hasTgzExtension(fullPluginPath) && this.isPluginPartOfTheProject(fullPluginPath))) {
				this.$fs.deleteDirectory(fullPluginPath);
			}

			if (packageJsonContent.nativescript) {
				delete packageJsonContent.nativescript[`${pluginBasicInfo.name}-variables`];
			}

			this.$fs.writeJson(pathToPackageJson, packageJsonContent);

			await this.$npmService.uninstall(this.$project.projectDir, pluginBasicInfo.name);

			this.$logger.printMarkdown(util.format("Successfully removed plugin `%s`.", pluginBasicInfo.name));
		} else {
			this.$logger.printMarkdown(util.format("Plugin `%s` is not installed.", pluginBasicInfo.name));
		}
	}

	public async configurePlugin(pluginName: string, version?: string, configurations?: string[]): Promise<void> {
		let basicPluginInfo = await this.getPluginBasicInformation(pluginName),
			packageJsonContent = this.getProjectPackageJsonContent(),
			dependencies = _.keys(packageJsonContent.dependencies);

		if (!_.some(dependencies, d => d === basicPluginInfo.name)) {
			this.$errors.failWithoutHelp(`Plugin ${pluginName} is not installed.`);
		}

		let pluginVersion = packageJsonContent.dependencies[basicPluginInfo.name].replace("file:", "");
		if (await this.checkIsValidLocalPlugin(pluginVersion)) {
			await this.installLocalPlugin(pluginVersion);
		} else {
			await this.setPluginInPackageJson(pluginName);
		}

		this.$logger.printMarkdown(util.format("Successfully configured plugin `%s`.", basicPluginInfo.name));
	}

	public async isPluginInstalled(pluginName: string): Promise<boolean> {
		let packageJsonContent = this.getProjectPackageJsonContent();
		let pluginBasicInfo = await this.getPluginBasicInformation(pluginName);
		return packageJsonContent
			&& !!packageJsonContent.dependencies && !!packageJsonContent.dependencies[pluginBasicInfo.name]
			&& (!pluginBasicInfo.version || packageJsonContent.dependencies[pluginBasicInfo.name] === pluginBasicInfo.version) || this.isPluginFetched(pluginName);
	}

	public async getPluginBasicInformation(pluginName: string): Promise<IBasicPluginInformation> {
		let dependencyInfo = this.$npmService.getDependencyInformation(pluginName);
		return await this.getBasicPluginInfoFromMarketplace(dependencyInfo.name, dependencyInfo.version) || { name: dependencyInfo.name, version: dependencyInfo.version };
	}

	public async filterPlugins(plugins: IPlugin[]): Promise<IPlugin[]> {
		return Promise.resolve(plugins);
	}

	protected getCopyLocalPluginData(pathToPlugin: string): NpmPlugins.ICopyLocalPluginData {
		// We need this check because for NS projects we do not extract the tgz.
		if (this.hasTgzExtension(pathToPlugin)) {
			return {
				sourceDirectory: pathToPlugin,
				destinationDirectory: path.join(this.$project.getProjectDir(), "plugins")
			};
		} else {
			return super.getCopyLocalPluginData(pathToPlugin);
		}
	}

	protected getPluginsDirName(): string {
		return NODE_MODULES_DIR_NAME;
	}

	protected composeSearchQuery(keywords: string[]): string[] {
		return keywords;
	}

	protected async installLocalPluginCore(pathToPlugin: string, pluginData: ILocalPluginData): Promise<IBasicPluginInformation> {
		let content = pluginData && pluginData.configFileContents || this.$fs.readJson(path.join(pathToPlugin, this.$projectConstants.PACKAGE_JSON_NAME));
		let name = content.name;
		let basicPluginInfo: IBasicPluginInformation = {
			name: name,
			version: content.version,
			variables: content.nativescript && content.nativescript.variables
		};

		let pathToPackageJson = this.getPathToProjectPackageJson();
		let packageJsonContent = this.getProjectPackageJsonContent();
		if (pluginData && pluginData.addPluginToConfigFile) {
			packageJsonContent.dependencies[name] = "file:" + path.relative(this.$project.getProjectDir(), pathToPlugin);
		}

		// Skip variables configuration for AppManager LiveSync Plugin.
		if (name !== NativeScriptProjectPluginsService.NATIVESCRIPT_LIVEPATCH_PLUGIN_ID) {
			packageJsonContent = await this.setPluginVariables(packageJsonContent, basicPluginInfo);
		}

		this.$fs.writeJson(pathToPackageJson, packageJsonContent);

		return basicPluginInfo;
	}

	protected async fetchPluginBasicInformationCore(pathToInstalledPlugin: string, version: string, pluginData?: ILocalPluginData, options?: NpmPlugins.IFetchLocalPluginOptions): Promise<IBasicPluginInformation> {
		if (pluginData && pluginData.isTgz || this.$fs.exists(pluginData.actualName)) {
			pluginData.configFileContents = this.$fs.readJson(path.join(pathToInstalledPlugin, this.$projectConstants.PACKAGE_JSON_NAME));
		}

		// Need to set addPluginToConfigFile to true when fetching NativeScript plugins.
		pluginData.addPluginToConfigFile = true;

		// Pass the actual plugin name because we do not need to add the extracted plugin if it is tgz file.
		return super.installLocalPlugin(pluginData && pluginData.isTgz ? pluginData.actualName : pathToInstalledPlugin, pluginData, options);
	}

	protected shouldCopyToPluginsDirectory(pathToPlugin: string): boolean {
		return super.shouldCopyToPluginsDirectory(pathToPlugin) || pathToPlugin.indexOf(this.getPluginsDirName()) !== -1;
	}

	protected validatePluginInformation(pathToPlugin: string): void {
		if (!this.$fs.exists(path.join(pathToPlugin, this.$projectConstants.PACKAGE_JSON_NAME))) {
			this.$errors.failWithoutHelp(`${path.basename(pathToPlugin)} is not a valid NativeScript plugin.`);
		}
	}

	private async getMarketplacePlugins(): Promise<IPlugin[]> {
		if (!this.marketplacePlugins || !this.marketplacePlugins.length) {
			try {
				let plugins = await this.$server.nativescript.getMarketplacePluginVersionsData();
				this.marketplacePlugins = [];
				_.each(plugins, plugin => {
					let versions = _.map(plugin.Versions, (pluginVersionData) =>
						new MarketplacePluginData(<any>plugin, <any>pluginVersionData, this.$project, this.$projectConstants));
					this.marketplacePlugins = this.marketplacePlugins.concat(versions);
				});
			} catch (err) {
				this.$logger.trace("Unable to get NativeScript Marketplace plugins.");
				this.$logger.trace(err);
				this.marketplacePlugins = null;
			}
		}

		return this.marketplacePlugins;
	}

	private async getUniqueMarketplacePlugins(): Promise<IPlugin[]> {
		return _(await this.getMarketplacePlugins())
			.groupBy(pl => pl.data.Name)
			.map((pluginGroup: IPlugin[]) => _(pluginGroup)
				.sortBy(gr => gr.data.Version)
				.last())
			.value();
	}

	private getPathToProjectPackageJson(): string {
		return path.join(this.$project.getProjectDir(), this.$projectConstants.PACKAGE_JSON_NAME);
	}

	private getProjectPackageJsonContent(): any {
		let pathToPackageJson = this.getPathToProjectPackageJson();

		if (!this.$fs.exists(pathToPackageJson)) {
			this.$fs.copyFile(this.$nativeScriptResources.nativeScriptDefaultPackageJsonFile, pathToPackageJson);
		}

		return this.$fs.readJson(pathToPackageJson);
	}

	private async getTopNpmPackages(count: number): Promise<IPlugin[]> {
		let plugins: IPlugin[];
		try {
			let url = `${NativeScriptProjectPluginsService.NPM_SEARCH_URL}/query?fields=name,version,rating,homepage,description,repository,author&sort=rating+desc&start=0&size=${count}`;
			let result = (await this.$httpClient.httpRequest(url)).body;
			if (result) {
				let npmSearchResult = JSON.parse(result).results;
				let pluginsToFilter = await Promise.all(_.map(npmSearchResult, async (pluginResult: any) => {
					if (pluginResult) {
						let pluginInfo: IPluginInfoBase = {
							Authors: pluginResult.author,
							Name: this.getStringFromNpmSearchResult(pluginResult, "name"),
							Identifier: this.getStringFromNpmSearchResult(pluginResult, "name"),
							Version: this.getStringFromNpmSearchResult(pluginResult, "version"),
							Url: this.getStringFromNpmSearchResult(pluginResult, "homepage"),
							Platforms: [],
							Description: this.getStringFromNpmSearchResult(pluginResult, "description"),
							SupportedVersion: ""
						};
						pluginInfo.Variables = await this.getPluginVariablesInfoFromNpm(pluginInfo.Name, pluginInfo.Version) || [];

						return new NativeScriptPluginData(pluginInfo, PluginType.NpmPlugin, this.$project);
					}

					return null;
				}));
				plugins = _.filter(pluginsToFilter, pl => !!pl);
			}
		} catch (err) {
			this.$logger.trace("Unable to get top NPM packages.");
			this.$logger.trace(err);
		}

		return plugins;
	}

	private getStringFromNpmSearchResult(pluginResult: any, propertyName: string): string {
		if (pluginResult && pluginResult[propertyName] && pluginResult[propertyName].length) {
			let item = _.first(pluginResult[propertyName]);
			if (item) {
				return item.toString();
			}
		}

		return "";
	}

	private async getFeaturedNpmPackages(): Promise<IPlugin[]> {
		let plugins: IPlugin[] = [];
		try {
			if (this.featuredNpmPackages && this.featuredNpmPackages.length) {
				let pluginFutures = _.map(this.featuredNpmPackages, packageId => this.getDataForNpmPackage(packageId));
				plugins = await getFuturesResults<IPlugin>(pluginFutures, pl => !!pl && !!pl.data);

				_.each(plugins, featuredPackage => {
					featuredPackage.type = PluginType.FeaturedPlugin;

					// Hide Variables and Url properties for the AppManager LiveSync Plugin.
					if (featuredPackage.data.Identifier === NativeScriptProjectPluginsService.NATIVESCRIPT_LIVEPATCH_PLUGIN_ID) {
						featuredPackage.data.Variables = [];
						featuredPackage.data.Url = "";
					}
				});
			}
		} catch (err) {
			this.$logger.trace("Unable to get advanced NPM packages.");
			this.$logger.trace(err);
			plugins = null;
		}

		return plugins;
	}

	private async getTopNativeScriptNpmPackages(count: number): Promise<IPlugin[]> {
		let currentPage = 0;
		let shouldBreak = false;
		let plugins: IPlugin[] = [];
		try {
			do {
				let nativescriptUrl = `${NativeScriptProjectPluginsService.NPM_SEARCH_URL}/query?fields=name,version,rating&sort=rating+desc&q=keywords:nativescript+NativeScript&start=${currentPage * count}&size=${count}`;
				let result = (await this.$httpClient.httpRequest(nativescriptUrl)).body;
				if (result) {
					let npmSearchResults: any[] = JSON.parse(result).results;
					shouldBreak = !npmSearchResults.length;
					let pluginFutures = _.map(npmSearchResults, pluginResult => this.getDataForNpmPackage(this.getStringFromNpmSearchResult(pluginResult, "name"), this.getStringFromNpmSearchResult(pluginResult, "version")));
					let allPlugins = await getFuturesResults<IPlugin>(pluginFutures, pl => !!pl && !!pl.data && !!pl.data.Platforms && pl.data.Platforms.length > 0);
					plugins = plugins.concat(allPlugins.slice(0, count - plugins.length));
				} else {
					shouldBreak = true;
				}

				currentPage++;
			} while (plugins.length < count && !shouldBreak);
		} catch (err) {
			this.$logger.trace("Unable to get top NativeScript NPM packages.");
			this.$logger.trace(err);
			plugins = null;
		}

		return plugins;
	}

	private async getDataForNpmPackage(packageName: string, version?: string): Promise<IPlugin> {
		version = version || "latest";
		let result = await this.$npmService.getPackageJsonFromNpmRegistry(packageName, version);
		if (result) {
			return await this.constructNativeScriptPluginData(result);
		}

		return null;
	}

	private async getDataForLocalPlugin(packageName: string, pathToPlugin?: string): Promise<IPlugin> {
		if (!!pathToPlugin.match(/^file:/)) {
			pathToPlugin = pathToPlugin.replace("file:", "");
		}

		if (await this.checkIsValidLocalPlugin(pathToPlugin)) {
			let fullPath = path.resolve(pathToPlugin);
			let packageJsonContent = this.$fs.readJson(path.join(fullPath, this.$projectConstants.PACKAGE_JSON_NAME));
			return await this.constructNativeScriptPluginData(packageJsonContent);
		}

		return null;
	}

	private async getDataFromGitHubUrl(packageName: string, url?: string): Promise<IPlugin> {
		/* From `npm help install`:
		 * <protocol> is one of git, git+ssh, git+http, or git+https. If no <commit-ish> is specified, then master is used.
		 */
		if (!!url.match(/^(http|git)/)) {
			let pathToInstalledPackage = await this.installPackageToTempDir(url);
			if (pathToInstalledPackage) {
				let packageJsonContent = this.$fs.readJson(path.join(pathToInstalledPackage, this.$projectConstants.PACKAGE_JSON_NAME));
				return await this.constructNativeScriptPluginData(packageJsonContent);

			}
		}

		return null;
	}

	private async constructNativeScriptPluginData(packageJsonContent: any): Promise<NativeScriptPluginData> {
		let platforms: string[];
		let supportedVersion: string;
		let type = PluginType.NpmPlugin;
		if (packageJsonContent.nativescript && packageJsonContent.nativescript.platforms) {
			type = PluginType.NpmNativeScriptPlugin;
			platforms = _.keys(packageJsonContent.nativescript.platforms);
			supportedVersion = semver.maxSatisfying(_.values<string>(packageJsonContent.nativescript.platforms), ">=0.0.0");
		}

		let data: IPluginInfoBase = {
			Authors: packageJsonContent.author ? [packageJsonContent.author.name || packageJsonContent.author] : null,
			Name: packageJsonContent.name,
			Identifier: packageJsonContent.name,
			Version: packageJsonContent.version,
			Url: (packageJsonContent.repository && packageJsonContent.repository.url) || packageJsonContent.homepage || '',
			Platforms: platforms,
			Description: packageJsonContent.description,
			SupportedVersion: supportedVersion,
			Variables: packageJsonContent.nativescript && packageJsonContent.nativescript.variables
		};

		return new NativeScriptPluginData(data, type, this.$project);
	}

	private async checkIsValidLocalPlugin(pluginName: string): Promise<boolean> {
		let fullPath = path.resolve(pluginName);

		return this.$fs.exists(fullPath) && this.$fs.exists(path.join(fullPath, this.$projectConstants.PACKAGE_JSON_NAME));
	}

	private async getBasicPluginInfoFromMarketplace(pluginName: string, version: string): Promise<IBasicPluginInformation> {
		let basicInfo: IBasicPluginInformation;
		let allMarketplacePlugins = await this.getMarketplacePlugins();
		let marketPlacePlugins: IPlugin[] = _.filter(allMarketplacePlugins, pl => pl.data.Identifier.toLowerCase() === pluginName.toLowerCase());
		if (marketPlacePlugins && marketPlacePlugins.length) {
			let selectedPlugin = this.selectMarketplacePlugin(marketPlacePlugins, version);

			if (selectedPlugin) {
				basicInfo = {
					name: selectedPlugin.data.Identifier,
					version: selectedPlugin.data.Version
				};

				// TODO: Use variables from server when it returns them to us.
				basicInfo.variables = await this.getPluginVariablesInfoFromNpm(basicInfo.name, basicInfo.version);
				if (!semver.satisfies(this.$project.projectData.FrameworkVersion, selectedPlugin.data.SupportedVersion)) {
					this.$errors.failWithoutHelp(`Plugin ${pluginName} requires at least version ${selectedPlugin.data.SupportedVersion}, but your project targets ${this.$project.projectData.FrameworkVersion}.`);
				}
			}
		}

		return basicInfo;
	}

	private selectMarketplacePlugin(marketPlacePlugins: IPlugin[], version: string): IPlugin {
		let plugin: IPlugin;

		if (this.$options.default && marketPlacePlugins.length) {
			version = this.getDefaultPluginVersion(marketPlacePlugins[0]);
		}

		if (!version || version === "latest") {
			version = _(marketPlacePlugins)
				.map((marketplacePlugin: IPlugin) => marketplacePlugin.data.Version)
				.sort((firstVersion: string, secondVersion: string) => semver.gt(firstVersion, secondVersion) ? -1 : 1)
				.first();
		}

		if (version && semver.valid(version)) {
			plugin = _.find(marketPlacePlugins, (marketPlacePlugin: IPlugin) => marketPlacePlugin.data.Version === version);
		}

		return plugin;
	}

	private async getBasicPluginInfoFromNpm(name: string, version: string): Promise<IBasicPluginInformation> {
		let basicInfo: IBasicPluginInformation;
		let jsonInfo = await this.$npmService.getPackageJsonFromNpmRegistry(name, version);
		if (jsonInfo) {
			basicInfo = {
				name: jsonInfo.name,
				version: jsonInfo.version,
				variables: jsonInfo.nativescript && jsonInfo.nativescript.variables
			};

			if (jsonInfo.nativescript && jsonInfo.nativescript.platforms) {
				const requiredVersions = _.values<string>(jsonInfo.nativescript.platforms)
					.filter(ver => !!semver.valid(ver));

				const notSupportedValues = requiredVersions.filter(ver => semver.gt(ver, this.$project.projectData.FrameworkVersion));

				if (requiredVersions.length && notSupportedValues.length === requiredVersions.length) {
					this.$errors.failWithoutHelp(`Plugin ${name} requires newer version of NativeScript, your project targets ${this.$project.projectData.FrameworkVersion}.`);
				}
			}
		}

		return basicInfo;
	}

	private async getPluginVariablesInfoFromNpm(name: string, version: string): Promise<any> {
		let jsonInfo = await this.$npmService.getPackageJsonFromNpmRegistry(name, version);
		return jsonInfo && jsonInfo.nativescript && jsonInfo.nativescript.variables;
	}

	private async getBasicPluginInfoFromUrl(url: string): Promise<IBasicPluginInformation> {
		let basicInfo: IBasicPluginInformation;

		/* From `npm help install`:
		 * <protocol> is one of git, git+ssh, git+http, or git+https. If no <commit-ish> is specified, then master is used.
		 */
		if (!!url.match(/^(http|git)/)) {
			let pathToInstalledPackage = await this.installPackageToTempDir(url);
			if (pathToInstalledPackage) {
				let packageJson = this.$fs.readJson(path.join(pathToInstalledPackage, this.$projectConstants.PACKAGE_JSON_NAME));
				basicInfo = {
					name: packageJson.name,
					version: url,
					variables: packageJson.nativescript && packageJson.nativescript.variables
				};
			}
		}

		return basicInfo;
	}

	private async setPluginInPackageJson(pluginIdentifier: string, pluginOpts?: { addPluginToPackageJson: boolean }): Promise<IBasicPluginInformation> {
		let pathToPackageJson = this.getPathToProjectPackageJson(),
			packageJsonContent = this.getProjectPackageJsonContent(),
			pluginBasicInfo = await this.getPluginBasicInformation(pluginIdentifier),
			name = pluginBasicInfo.name,
			selectedVersion = pluginBasicInfo.version || "latest",
			basicPlugin = await this.getBasicPluginInfoFromMarketplace(name, selectedVersion) ||
				await this.getBasicPluginInfoFromNpm(name, selectedVersion) ||
				await this.getBasicPluginInfoFromUrl(pluginIdentifier);

		if (!basicPlugin) {
			this.$errors.failWithoutHelp(`Unable to add plugin ${pluginIdentifier}. Make sure you've provided a valid name, path to local directory or git URL.`);
		}

		if (pluginOpts && pluginOpts.addPluginToPackageJson) {
			packageJsonContent.dependencies[basicPlugin.name] = basicPlugin.version;
		}

		// Skip variables configuration for AppManager LiveSync Plugin.
		if (basicPlugin.variables && pluginIdentifier !== NativeScriptProjectPluginsService.NATIVESCRIPT_LIVEPATCH_PLUGIN_ID) {
			packageJsonContent = await this.setPluginVariables(packageJsonContent, basicPlugin);
		}

		this.$fs.writeJson(pathToPackageJson, packageJsonContent);
		return basicPlugin;
	}

	private async setPluginVariables(packageJsonContent: any, basicPlugin: IBasicPluginInformation): Promise<any> {
		let variablesInformation = basicPlugin.variables;
		if (variablesInformation && _.keys(variablesInformation).length) {
			this.$logger.trace(`Plugin ${basicPlugin.name}@${basicPlugin.version} describes the following plugin variables:`);
			this.$logger.trace(variablesInformation);
			packageJsonContent.nativescript = packageJsonContent.nativescript || {};
			let pluginVariableNameInPackageJson = `${basicPlugin.name}-variables`;
			let currentVariablesValues = packageJsonContent.nativescript[pluginVariableNameInPackageJson] || {};
			let newObj: IStringDictionary = Object.create(null);

			for (let variableName in variablesInformation) {
				let variableInfo = variablesInformation[variableName];
				let currentValue = currentVariablesValues[variableName] || variableInfo.defaultValue;
				newObj[variableName] = (await this.gatherVariableInformation(variableName, currentValue))[variableName];
			}

			delete packageJsonContent.nativescript[pluginVariableNameInPackageJson];
			if (_.keys(newObj).length) {
				packageJsonContent.nativescript[pluginVariableNameInPackageJson] = newObj;
			}
		}

		return packageJsonContent;
	}

	private async gatherVariableInformation(variableName: string, defaultValue: any): Promise<any> {
		let schema: IPromptSchema = {
			name: variableName,
			type: "input",
			message: `Set value for variable ${variableName}`,
			validate: (val: string) => !!val ? true : 'Please enter a value!'
		};

		if (defaultValue) {
			schema.default = () => defaultValue;
		}

		let fromVarOpion = this.$pluginVariablesHelper.getPluginVariableFromVarOption(variableName);
		if (!isInteractive() && !fromVarOpion) {
			if (defaultValue) {
				this.$logger.trace(`Console is not interactive, so default value for ${variableName} will be used: ${defaultValue}.`);
				let defaultObj: any = Object.create(null);
				defaultObj[variableName] = defaultValue;
				return defaultObj;
			}
			this.$errors.failWithoutHelp(`Unable to find value for ${variableName} plugin variable. Ensure the --var option is specified or the plugin variable has default value.`);
		}

		return fromVarOpion || await this.$prompter.get([schema]);
	}
}

$injector.register("nativeScriptProjectPluginsService", NativeScriptProjectPluginsService);

export enum PluginType {
	NpmPlugin = 0,
	NpmNativeScriptPlugin = 1,
	MarketplacePlugin = 2,
	FeaturedPlugin = 3
}

export class NativeScriptPluginData implements IPlugin {
	public configurations: string[];

	constructor(public data: IPluginInfoBase,
		public type: PluginType,
		protected $project: Project.IProject) {
		this.configurations = [];
	}

	public get pluginInformation(): string[] {
		let additionalPluginData: string[];
		if (this.data.Platforms && this.data.Platforms.length > 0) {
			additionalPluginData = [this.buildRow("Platforms", this.data.Platforms.join(", "))];
		}
		return this.composePluginInformation(additionalPluginData);
	}

	public toProjectDataRecord(version: string): string {
		return `"${this.data.Name}": "${version}"`;
	}

	protected buildRow(key: string, value: string): string {
		return util.format("    %s: %s", key, value);
	}

	protected composePluginInformation(additionalPluginData: string[]): string[] {
		let result = _.flatten<string>([this.getBasicPluginInformation(), additionalPluginData]);
		return result;
	}

	private getBasicPluginInformation(): string[] {
		let nameRow = this.buildRow("Plugin", this.data.Name);
		let versionRow = this.buildRow("Version", this.data.Version);
		let urlRow = this.buildRow("Url", this.data.Url);

		let result = [nameRow, versionRow, urlRow];

		if (this.data.Authors) {
			result.push(this.buildRow("Authors", this.data.Authors.join(", ")));
		}

		if (this.data.SupportedVersion) {
			let supportedVersion = this.buildRow("Supported Version", this.data.SupportedVersion);
			result.push(supportedVersion);
		}

		if (this.configurations && this.configurations.length > 0) {
			result.push(util.format("    Configuration: %s", this.configurations.join(", ")));
		}

		if (this.data.Variables && _.keys(this.data.Variables).length) {
			let varInfo = this.$project.getPluginVariablesInfo();
			if (varInfo && varInfo[this.data.Identifier]) {
				result.push("    Variables:");
				_.each(varInfo[this.data.Identifier], (variableValue: any, variableName: string) => {
					result.push(`        ${variableName}: ${variableValue}`);
				});
			} else {
				let variables = _.keys(this.data.Variables).join(", ");
				result.push(`    Variables: ${variables}`);
			}
		}

		return result;
	}
}
