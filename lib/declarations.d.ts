
declare module Server {
	interface IRequestBodyElement {
		name: string;
		value: any;
		contentType: string;
	}

	interface IServiceProxy {
		call<T>(name: string, method: string, path: string, accept: string, body: IRequestBodyElement[], resultStream: NodeJS.WritableStream, headers?: any): IFuture<T>;
		setShouldAuthenticate(shouldAuthenticate: boolean): void;
		setSolutionSpaceName(solutionSpaceName: string): void;
	}

	interface IServiceContractClientCode {
		interfaceFile: string;
		implementationFile: string;
	}

	interface IServiceContractGenerator {
		generate(): IFuture<Server.IServiceContractClientCode>;
	}

	interface IServiceContractProvider {
		getApi(path?: string): IFuture<Swagger.ISwaggerServiceContract>;
	}

	interface IIdentityManager {
		listCertificates(): IFuture<void>;
		listProvisions(provisionStr?: string): IFuture<void>;
		findCertificate(identityStr: string): IFuture<ICryptographicIdentity>;
		findProvision(provisionStr: string): IFuture<IProvision>;
		autoselectProvision(appIdentifier: string, provisionTypes: string[], deviceIdentifier?: string): IFuture<IProvision>;
		autoselectCertificate(provision: IProvision): IFuture<ICryptographicIdentity>;
		isCertificateCompatibleWithProvision(certificate: ICryptographicIdentity, provision: IProvision): boolean;
		findReleaseCertificate(): IFuture<ICryptographicIdentity>;
	}

	interface IPackageDef {
		platform: string;
		solution: string;
		solutionPath: string;
		relativePath: string;
		localFile?: string;
	}

	interface IBuildResult {
		buildResults: IPackageDef[];
		output: string;
		errors: string[];
	}

	interface IKendoDownloadablePackageData {
		Id: string;
		DownloadUrl: string;
		Keywords: string[];
		Name: string;
		Version: string;
		NeedPurchase: boolean;
		VersionTags: string[];
	}
}

interface IUserDataStore {
	hasCookie(): IFuture<boolean>;
	getCookies(): IFuture<IStringDictionary>;
	getUser(): IFuture<any>;
	setCookies(cookies?: IStringDictionary): IFuture<void>;
	parseAndSetCookies(setCookieHeader: any, cookies?: IStringDictionary): IFuture<void>;
	setUser(user?: any): IFuture<void>;
	clearLoginData(): IFuture<void>;
}

interface ILoginManager {
	login(): IFuture<void>;
	logout(): IFuture<void>;
	isLoggedIn(): IFuture<boolean>;
	ensureLoggedIn(): IFuture<void>;
	telerikLogin(user: string, password: string): IFuture<void>;
}

declare module Server.Contract {
	interface IParameter {
		name: string;
		binding: {
			type: string;
			contentType: string;
		}
		routePrefixes: string[];
		routeSuffixes: string[];
	}

	interface IOperation {
		name: string;
		actionName: string;
		httpMethod: string;
		responseType: string;
		routePrefixes: string[];
		routeSuffixes: string[];
		parameters: IParameter[];
	}

	interface IService {
		name: string;
		endpoint: string;
		operations: IOperation[];
	}
}

declare module Project {
	interface IBuildResult {
		buildProperties: any;
		packageDefs: Server.IPackageDef[];
		provisionType?: string;
	}

	interface IBuildPropertiesAdjustment {
		adjustBuildProperties(oldBuildProperties: any): any;
	}

	interface IBuildService {
		getLiveSyncUrl(urlKind: string, filesystemPath: string, liveSyncToken: string): IFuture<string>;
		executeBuild(platform: string): IFuture<void>;
		build(settings: IBuildSettings): IFuture<Server.IPackageDef[]>;
		deploy(platform: string, device?: Mobile.IDevice): IFuture<Server.IPackageDef[]>;
	}

	interface IBuildSettings {
		platform: string;
		configuration?: string;
		showQrCodes?: boolean;
		downloadFiles?: boolean;
		downloadedFilePath?: string;

		provisionTypes?: string[];
		device?: Mobile.IDevice;

		buildForiOSSimulator?: boolean;
		showWp8SigningMessage?: boolean;
		buildForTAM?: boolean;
	}

	interface IPlatformMigrator {
		ensureAllPlatformAssets(): IFuture<void>;
	}
}

interface IProjectTypes {
	Cordova: number;
	NativeScript: number;
	Common: number;
}

interface IProjectCapabilities {
	build: boolean;
	buildCompanion: boolean;
	deploy: boolean
	simulate: boolean;
	livesync: boolean;
	livesyncCompanion: boolean;
	updateKendo: boolean;
	emulate: boolean;
	publish: boolean;
	uploadToAppstore: boolean;
	canChangeFrameworkVersion: boolean;
}

interface IProjectData extends IDictionary<any> {
	ProjectName: string;
	ProjectGuid: string;
	projectVersion : number;
	AppIdentifier: string;
	DisplayName: string;
	Author: string;
	Description: string;
	BundleVersion: string;
	Framework: string;
	FrameworkVersion: string;
	CorePlugins: string[];
	AndroidPermissions: string[];
	DeviceOrientations: string[];
	AndroidHardwareAcceleration: string;
	AndroidVersionCode: string;
	iOSStatusBarStyle: string;
	iOSDeviceFamily: string[];
	iOSBackgroundMode: string[];
	WP8ProductID: string;
	WP8PublisherID: string;
	WP8Publisher: string;
	WP8TileTitle: string;
	WP8Capabilities: string[];
	WP8Requirements: string[];
	WP8SupportedResolutions: string[];
	WPSdk?: string;
	WP8PackageIdentityName?: string;
	WP8WindowsPublisherName?: string;
	CordovaPluginVariables?: any;
}

interface IProjectPropertiesService {
	getProjectProperties(projectFile: string, isJsonProjectFile: boolean, frameworkProject: Project.IFrameworkProject): IFuture<IProjectData>;
	completeProjectProperties(properties: any, frameworkProject: Project.IFrameworkProject): boolean;
	updateProjectProperty(projectData: any, configurationSpecificData: IProjectData, mode: string, property: string, newValue: any): IFuture<void>;
	normalizePropertyName(property: string, projectData: IProjectData): string;
	getValidValuesForProperty(propData: any): IFuture<string[]>;
	getPropertiesForAllSupportedProjects(): IFuture<string>;
	/**
	 * Removes property from the project and validates the result data.  If it is configuration specific (commonly written in .debug.abproject or .release.abproject) 
	 * you have to pass the projectData as last parameter of the method.
	 * @param {IProjectData} dataToBeUpdated The data from which to remove the property.
	 * @param {string} propertyName The name of the property that should be removed from the data. 
	 * @param {IProjectData} projectData Optional parameter. The project data, commonly written in .abproject. Set this property whenever you want to remove property from configuration specific data.
	 * @return {IProjectData} Modified data. In case configurationSpecificData exists, returns it, else returns projectData.
	 * @throws Error when the modified data cannot be validated with the respective JSON schema. In this case the modification is not saved to the file. 
	 */
	removeProjectProperty(dataToBeUpdated: IProjectData, property: string, projectData?: IProjectData) : IProjectData;

	/**
	 * Updates CorePlugins property value in all configurations.
	 * @param {IProjectData} projectData The project data commonly written in .abproject.
	 * @param {IDictionary<IProjectData>} configurationSpecificData Dictionary with all configuration specific data. 
	 * @param {string} mode Type of operation which should be executed with the property.
	 * @param {Array<any>} newValue The new value that should be used for CorePlugins modification.
	 * @param {string[]} configurationsSpecifiedByUser The configurations which the user want to modify.
	 * @return {IFuture<void>}
	 * @throws Error when the modified data cannot be validated with the respective JSON schema. In this case the modification is not saved to the file.
	 * @throws Error when the different CorePlugins are enabled in projectData and any configuration specific data.
	 */
	updateCorePlugins(projectData: IProjectData, configurationSpecificData: IDictionary<IProjectData>, mode: string, newValue: Array<any>, configurationsSpecifiedByUser: string[]): IFuture<void>
}

interface IServerConfigurationData {
	assemblyVersion: string;
	applicationName: string;
	backendServiceScheme: string;
	stsServer: string;
	clientId: string;
	analyticsAccountCode: string;
	eqatecProductId: string;
}

interface IConfiguration extends Config.IConfig {
	DEFAULT_CORDOVA_PROJECT_TEMPLATE: string;
	DEFAULT_NATIVESCRIPT_PROJECT_TEMPLATE: string;
	DEFAULT_WEBSITE_PROJECT_TEMPLATE: string;
	CORDOVA_PLUGINS_REGISTRY: string;
	USE_CDN_FOR_EXTENSION_DOWNLOAD: boolean;
	AUTO_UPGRADE_PROJECT_FILE: boolean;
	TYPESCRIPT_COMPILER_OPTIONS: ITypeScriptCompilerOptions;

	reset(): IFuture<void>;
	apply(configName: string): IFuture<void>;
	printConfigData(): IFuture<void>;
}

interface IStaticConfig extends Config.IStaticConfig {
	/**
	 * The full path to the file, which contains GitHub access token used for GitHub api calls.
	 */
	GITHUB_ACCESS_TOKEN_FILEPATH: string;
	QR_SIZE: number;
	SOLUTION_SPACE_NAME: string;
	triggerJsonSchemaValidation: boolean;
}

interface IDependencyConfigService {
	dependencyConfigFilePath: string;
	getAppScaffoldingConfig(): IFuture<IAppScaffoldingConfig>;
	getAllGenerators(): IFuture<IGeneratorConfig[]>;
	getGeneratorConfig(generatorName: string): IFuture<IGeneratorConfig>;
}

interface IServerConfiguration {
	tfisServer: IFuture<string>;
	assemblyVersion: IFuture<string>;
	resourcesPath: IFuture<string>;
}

interface IExtensionPlatformServices {
	getPackageName() : string;
	executableName: string;
	runApplication(applicationPath: string, applicationParams: string[]): void;
	canRunApplication(): IFuture<boolean>;
}

interface IX509Certificate {
	issuerData: any;
	issuedOn: Date;
	expiresOn: Date;
}

interface IX509CertificateLoader {
	load(certificatePem: string): IX509Certificate;
}

interface IQrCodeGenerator {
	generateDataUri(data: string): string;
}

interface IPackageDownloadLink {
	packageUrl: string;
	downloadText: string;
}

interface IPackageDownloadViewModel {
	qrUrl?: string;
	qrImageData: string;
	instruction: string;
	packageUrls?: IPackageDownloadLink[];
}

interface IResourceLoader {
	resolvePath(path: string): string;
	openFile(path: string): any;
	readJson(path: string): IFuture<any>;
	buildCordovaJsFilePath(version: string, platform: string): string;
	getPathToAppResources(framework: string): string;
}

interface IResourceDownloader {
	downloadCordovaJsFiles(): IFuture<void>;
}

interface IUserSettingsFileService {
	deleteUserSettingsFile(): IFuture<void>;
	userSettingsFilePath: string;
}

interface IUserSettingsService extends UserSettings.IUserSettingsService {
	loadUserSettingsFile(): IFuture<void>;
	saveSettings(data: IDictionary<{}>): IFuture<void>;
}

interface IDependencyConfig {
	name: string;
	version: string;
	gitHubRepoUrl: string;
	downloadUrl?: string;
	pathToSave?: string;
}

interface IAppScaffoldingConfig extends IDependencyConfig { }

interface IGeneratorConfig extends IDependencyConfig {
	alias: string; 
}

interface IExtensionsServiceBase {
	getExtensionVersion(packageName: string): string;
	getExtensionPath(packageName: string): string;
	cacheDir: string;
}

interface IServerExtensionsService extends IExtensionsServiceBase {
	prepareExtension(packageName: string, beforeDownloadPackageAction: () => void): IFuture<void>;
}

interface IDependencyExtensionsServiceBase extends IExtensionsServiceBase {
	prepareDependencyExtension(dependencyExtensionName: string, dependencyConfig: IDependencyConfig, afterPrepareAction: () => IFuture<void>): IFuture<void>;
}

interface IGeneratorExtensionsService {
	prepareGenerator(generatorName: string): IFuture<void>;
}

interface IAppScaffoldingExtensionsService {
	appScaffoldingPath: string;
	prepareAppScaffolding(afterPrepareAction?: () => void): IFuture<void>;
}

interface IScreenBuilderService {
	generatorName: string;
	commandsPrefix: string;
	prepareAndGeneratePrompt(generatorName: string, screenBuilderOptions?: IScreenBuilderOptions): IFuture<void>;
	allSupportedCommands(generatorName?: string): IFuture<string[]>;
	generateAllCommands(generatorName: string): IFuture<void>;
	installAppDependencies(screenBuilderOptions: IScreenBuilderOptions): IFuture<void>;
}

interface IScreenBuilderOptions {
	type?: string;
	answers?: IScreenBuilderAnswer;
	projectPath?: string;
}

interface IScreenBuilderAnswer {
	name?: string;
}

interface IExtensionData {
	packageName: string;
	version: string;
	downloadUri: string;
	pathToSave?: string;
	forceDownload?: boolean;
}

interface IPathFilteringService {
	getRulesFromFile(file: string) : string[];
	filterIgnoredFiles(files: string[], rules: string[], rootDir: string) :string[];
	isFileExcluded(file: string, rules: string[], rootDir: string): boolean
}

/**
 * Defines methods required for migrating Cordova or NativeScript projects.
 */
interface IFrameworkMigrationService {
	/**
	 * Downloads the data that is required in order to be able to migrate any project.
	 * @return {IFuture<void>}
	 */
	downloadMigrationData(): IFuture<void>;

	/**
	 * Gives a list of all supported versions. Each version is a string in the following format <Major>.<Minor>.<Patch>
	 * @return {IFuture<string[]>} List of all supported versions.
	 */
	getSupportedVersions(): IFuture<string[]>;

	/**
	 * Gives a list of all supported framework versions. Each one is presented with version and user-friendly display name.
	 * @return {IFuture<IFrameworkVersion[]>} List of all supported frameworks, each one with version and display name.
	 */
	getSupportedFrameworks(): IFuture<IFrameworkVersion[]>;

	/**
	 * Gets the user-friendly name of the specified version.
	 * @param  {string} version The version of the framework.
	 * @return {IFuture<string>} User-friendly name of the specified version.
	 */
	getDisplayNameForVersion(version: string): IFuture<string>;
	/**
	 * Hook which is dynamically called when a project's framework version is changing
	 * @param  {string} newVersion The version to upgrade/downgrade to
	 * @return {IFuture<void>}
	 */
	onFrameworkVersionChanging(newVersion: string): IFuture<void>;
}

/**
 * Defines methods required for migrating Cordova projects.
 */
interface ICordovaMigrationService extends IFrameworkMigrationService {
	/**
	 * Get all plugins available for specified version.
	 * @param {string} version The Cordova Framework version.
	 * @return {string[]} plugins available for the selected Cordova version
	 */
	pluginsForVersion(version: string): IFuture<string[]>;
	/**
	 * Migrate plugins from one Cordova version to another. 
	 * @param {string} fromVersion The current Cordova Framework version.
	 * @param {string} toVersion The Cordova Framework version to be used.
	 * @return {string[]} Migrated plugins.
	 */
	migratePlugins(plugins: string[], fromVersion: string, toVersion: string): IFuture<string[]>;
	/**
	 * Hook which is dynamically called when a project's windows phone sdk version is changing
	 * @param  {string} newVersion The version to upgrade/downgrade to
	 * @return {IFuture<void>}
	 */
	onWPSdkVersionChanging?(newVersion: string): IFuture<void>;
}

/**
 * Defines data that is comming from server
 */
interface ICordovaJsonData {
	deletedVersions: any;
	supportedVersions: any;
	minVersionsPerPlatform: any;
	minimumSupportedVersion: string;
	corePluginsMinimumVersion: string;
	forceHardwareAccelerationAfter: string;
	corePluginRegex: any;
	defaultEnabledPluginsIncludeRegex: string;
	defaultEnabledPluginsExcludeRegex: string;
	renamedPlugins: any;
}

interface ISamplesService {
	cloneSample(sampleName: string): IFuture<void>;
	printSamplesInformation(framework?: string): IFuture<void>;
}

interface IExpress {
	run(): void;
	listen(port: number, callback?: Function): any;
	post(route: string, callback: (req: any, res: any) => IFuture<void>): void;
}

interface IDomainNameSystem {
	getDomains(): IFuture<string[]>;
}

interface ICordovaPluginsService {
	getAvailablePlugins(): IFuture<Server.CordovaPluginData[]>;
	createPluginData(plugin: any): IPlugin[];
}

interface IPluginsService {
	getAvailablePlugins(): IPlugin[];
	getInstalledPlugins(): IPlugin[];
	printPlugins(plugins: IPlugin[]): void;
	addPlugin(pluginName: string): IFuture<void>;
	removePlugin(pluginName: string): IFuture<void>;
	/**
	 * Used to configure a plugin.
	 * @param  {string}        pluginName     The name of the plugin.
	 * @param  {string}        version        The version of the plugin.
	 * @param  {string[]}      configurations Configurations in which the plugin should be configured. Example: ['debug'], ['debug', 'release']
	 * @return {IFuture<void>}
	 */
	configurePlugin(pluginName: string, version?: string, configurations?: string[]): IFuture<void>;
	isPluginInstalled(pluginName: string): boolean;
	/**
	 * Returns basic information about the plugin - it's name, version and cordova version range
	 * @param  {string}                  pluginName The name of the plugin
	 * @return {IBasicPluginInformation}            Basic information about the plugin
	 */
	getPluginBasicInformation(pluginName: string): IBasicPluginInformation;
	/**
	 * Checks wether a plugin is supported for a specific framework version
	 * @param  {string}  plugin           The name of the plugin
	 * @param  {string}  version          The plugin's version
	 * @param  {string}  frameworkVersion The framework's version
	 * @return {boolean}                  true if the plugin is supported, false otherwise
	 */
	isPluginSupported(plugin: string, version: string, frameworkVersion: string): boolean;
}

interface IPlugin {
	data: Server.CordovaPluginData;
	type: any;
	configurations: string[];
	pluginInformation: string[];
	toProjectDataRecord(version?: string): string;
}

interface IPluginVersion {
	/**
	 * The name of the plugin
	 * @type {string}
	 */
	name: string;
	/**
	 * The plugin's version
	 * @type {string}
	 */
	value: string;
	/**
	 * The cordova version range this plugin supports
	 * Example: >=3.5.0, <3.7.0, 4.0.0, >=3.0.0 && <4.0.0
	 * @type {string}
	 */
	cordovaVersionRange: string;
}

interface IBasicPluginInformation {
	/**
	 * The plugin's name
	 * @type {string}
	 */
	name: string;
	/**
	 * The plugin's description
	 * @type {[type]}
	 */
	description?: string;
	/**
	 * The plugin's version in the form of Major.Minor.Patch
	 * @type {string}
	 */
	version: string;
}

/**
 * Extends Server's MarketplacePluginVersionsData interface.
 */
interface IMarketplacePluginVersionsData extends Server.MarketplacePluginVersionsData {
	/**
	 * The version of the plugin, that is marked as default. This version may not be the latest version.
	 */
	DefaultVersion: string;
	/**
	 * Id of the plugin.
	 */
	Identifier: string;
	/**
	 * The framework that is required in order to work with this plugin.
	 */
	Framework: string;
}

interface IMarketplacePlugin extends IPlugin {
	pluginVersionsData: IMarketplacePluginVersionsData;
}

interface ITypeScriptCompilerOptions {
	codePage: number; // Specify the codepage to use when opening source files.
	declaration: boolean; //  Generates corresponding .d.ts file.
	mapRoot: string; //  Specifies the location where debugger should locate map files instead of generated locations.
	module: string; // Specify module code generation: 'commonjs' or 'amd'.
	noImplicitAny: boolean; //  Warn on expressions and declarations with an implied 'any' type.
	out: string; // Concatenate and emit output to single file.
	outDir: string; // Redirect output structure to the directory.
	removeComments: boolean; // Do not emit comments to output.
	sourceMap: boolean; // Generates corresponding .map file
	sourceRoot: string; // Specifies the location where debugger should locate TypeScript files instead of source locations.
	targetVersion: string;  // Specify ECMAScript target version: 'ES3' (default), or 'ES5'.
}

interface IProcessInfo {
	isRunning(name: string): IFuture<boolean>;
}

interface IRemoteProjectService {
	makeTapServiceCall<T>(call: () => IFuture<T>): IFuture<T>;
	getProjectProperties(projectName: string): IFuture<any>;
	getProjects(): IFuture<Server.TapSolutionData[]>;
	getProjectName(projectId: string): IFuture<string>;
}

interface IProjectSimulatorService {
	getSimulatorParams(simulatorPackageName: string): IFuture<string[]>;
}

interface IDeployHelper {
	deploy(platform?: string): IFuture<void>;
}

interface ILiveSyncService {
	livesync(platform?: string): IFuture<void>;
}

interface IAppManagerService {
	upload(platform: string): IFuture<void>;
	openAppManagerStore(): void;
	publishLivePatch(platforms: string[]): IFuture<void>;
	getGroups(): IFuture<void>;
}

interface IProgressIndicator {
	showProgressIndicator(future: IFuture<any>, timeout: number): IFuture<void>;
}

interface IDynamicSubCommandInfo {
	baseCommandName: string;
	filePath: string;
	commandConstructor: Function;
}

interface IPublishService {
	publish(idOrUrl: string, username: string, password: string): IFuture<void>;
	listAllConnections(): void;
	addConnection(name: string, publishUrl: string): IFuture<void>;
	removeConnection(idOrName: string): IFuture<void>;
}

interface IPublishConnection extends IStringDictionary {
	type: string;
	publicUrl: string;
	publishUrl: string;
	name: string;
}

/**
 * Represents all supported options.
 */
interface IOptions extends ICommonOptions {
	companion: boolean;
	download: boolean;
	certificate: string;
	provision: string;
	template: string;
	deploy: string;
	device: string;
	saveTo: string;
	client: string;
	available: boolean;
	release: boolean;
	debug: boolean;
	screenBuilderCacheDir: string;
	force: boolean;
	validValue: boolean;
	deviceType: string;
	core: boolean;
	professional: boolean;
	verified: boolean;
	latest: boolean;
	publish: boolean;
	sendPush: boolean;
	sendEmail: boolean;
	group: string[];
	default: boolean;
}

/**
 * Describes the migration data for NativeScript project.
 * This data is written in resource file.
 */
interface INativeScriptMigrationData{
	/**
	 * Versions that can be used for building the project, but cannot be migrated to other ones.
	 */
	obsoleteVersions: IFrameworkVersion[];
	/**
	 * Versions that can be used for building the project and it can be migrated between them.
	 */
	supportedVersions: IFrameworkVersion[];
}

/**
 * Describes framework version with valid version and its display name.
 */
interface IFrameworkVersion {
	/**
	 * The version in format <Major>.<Minor>.<Patch>
	 */
	version: string;
	/**
	 * User friendly name, describing the version.
	 */
	displayName: string;
}

/**
 * Describes WebViewService
 */
interface IWebViewService {
	supportedWebViews: IDictionary<IWebView[]>;
	getWebView(platform: string, webViewName: string): IWebView;
	getWebViews(platform: string): IWebView[];
	getWebViewNames(platform: string): string[];
	enableWebView(platform: string, webViewName: string): IFuture<void>;
	getCurrentWebViewName(platform: string): string;
}

/**
 * Describes WebView with name minSupportedVersion and pluginIdentifier.
 */
interface IWebView {
	name: string;
	minSupportedVersion: string;	
	pluginIdentifier?: string;
	default?: boolean;
}