///<reference path=".d.ts"/>
"use strict";

import os = require("os");
import path = require("path");
import util = require("util");

import commonHelpers = require("./common/helpers");
import helpers = require("./helpers");
import MobileHelper = require("./common/mobile/mobile-helper");
import options = require("./options");
import projectPropertiesServiceLib = require("./services/project-properties-service");

export class Project implements Project.IProject {
	private static JSON_PROJECT_FILE_NAME_REGEX = "[.]abproject";
	private static CONFIGURATION_FILE_SEARCH_PATTERN: RegExp = new RegExp(".*.abproject$", "i");
	private static VALID_CONFIGURATION_CHARACTERS_REGEX = "[-_A-Za-z0-9]";
	private static CONFIGURATION_FROM_FILE_NAME_REGEX = new RegExp("^[.](" + Project.VALID_CONFIGURATION_CHARACTERS_REGEX + "+?)" + Project.JSON_PROJECT_FILE_NAME_REGEX + "$", "i");
	private static INDENTATION = "     ";
	private static EXPERIMENTAL_TAG = "Experimental";

	private _hasBuildConfigurations: boolean = false;
	private _projectSchema: any;
	private cachedProjectDir: string = "";

	private frameworkProject: Project.IFrameworkProject;
	public projectData: IProjectData;
	public configurationSpecificData: IDictionary<IDictionary<any>>;

	constructor(private $config: IConfiguration,
		private $cordovaMigrationService: ICordovaMigrationService,
		private $errors: IErrors,
		private $frameworkProjectResolver: Project.IFrameworkProjectResolver,
		private $fs: IFileSystem,
		private $jsonSchemaValidator: IJsonSchemaValidator,
		private $logger: ILogger,
		private $projectConstants: Project.IProjectConstants,
		private $projectFilesManager: Project.IProjectFilesManager,
		private $projectPropertiesService: IProjectPropertiesService,
		private $resources: IResourceLoader,
		private $staticConfig: IStaticConfig,
		private $templatesService: ITemplatesService,
		private $prompter: IPrompter) {

		this.configurationSpecificData = Object.create(null);
		this.readProjectData().wait();

		if(this.projectData && this.projectData["TemplateAppName"]) {
			this.$errors.fail({
				formatStr: "This hybrid project targets Apache Cordova 2.x. " +
					"The AppBuilder CLI lets you target only Apache Cordova 3.0.0 or later. " +
					"To develop your projects with Apache Cordova 2.x, run the AppBuilder Windows client or the in-browser client.",
				suppressCommandHelp: true
			});
		}
	}

	public get capabilities(): IProjectCapabilities {
		return this.frameworkProject.capabilities;
	}

	public getLiveSyncUrl(): string {
		return this.frameworkProject.liveSyncUrl;
	}

	public get projectConfigFiles(): Project.IConfigurationFile[] {
		return this.frameworkProject.configFiles;
	}

	public getProjectTargets(): IFuture<string[]> {
		return (() => {
			var projectDir = this.getProjectDir().wait();
			var projectTargets = this.frameworkProject.getProjectTargets(projectDir).wait();
			return projectTargets;
		}).future<string[]>()();
	}

	public configurationFilesString(): string {
		if(!this.frameworkProject) {
			var result: string[] = [];

			_.each(_.values(this.$projectConstants.TARGET_FRAMEWORK_IDENTIFIERS), (framework: string) => {
				var frameworkProject = this.$frameworkProjectResolver.resolve(framework);
				var configFiles = frameworkProject.configFiles;
				var title = util.format("Configuration files for %s projects:", framework);
				result.push(title);
				result.push(this.configurationFilesStringCore(configFiles));
			});

			return result.join("\n")
		}

		return this.configurationFilesStringCore(this.frameworkProject.configFiles);
	}

	private configurationFilesStringCore(configFiles: Project.IConfigurationFile[]) {
		return _.map(configFiles, (file) => {
			return util.format("        %s - %s", file.template, file.helpText);
		}).join("\n");
	}

	public get configurations(): string[] {
		var configurations: string[] = [];
		if(options.debug || options.d) {
			configurations.push(this.$projectConstants.DEBUG_CONFIGURATION_NAME);
		}

		if(options.release || options.r) {
			configurations.push(this.$projectConstants.RELEASE_CONFIGURATION_NAME);
		}

		if(configurations.length === 0) {
			configurations.push(this.$projectConstants.DEBUG_CONFIGURATION_NAME);
			configurations.push(this.$projectConstants.RELEASE_CONFIGURATION_NAME);
		}

		return configurations;
	}

	public hasBuildConfigurations(): boolean {
		return this._hasBuildConfigurations;
	}

	public getBuildConfiguration(): string {
		var configuration = options.release || options.r ? this.$projectConstants.RELEASE_CONFIGURATION_NAME : this.$projectConstants.DEBUG_CONFIGURATION_NAME;
		return configuration.charAt(0).toUpperCase() + configuration.slice(1);
	}

	public getProperty(propertyName: string, configuration: string): any {
		return (<any>this.frameworkProject).getProperty(propertyName, configuration, this.projectInformation);
	}

	public setProperty(propertyName: string, value: any, configuration: string): void {
		if(this._hasBuildConfigurations) {
			var configData = this.configurationSpecificData[configuration];
			if (!configData) {
				configData = Object.create(null);
				this.configurationSpecificData[configuration] = configData;
			}

			configData[propertyName] = value;
		} else {
			this.projectData[propertyName] = value;
		}
	}

	public getProjectDir(): IFuture<string> {
		return (() => {
			if(this.cachedProjectDir !== "") {
				return this.cachedProjectDir;
			}
			this.cachedProjectDir = null;

			var projectDir = path.resolve(options.path || ".");
			while(true) {
				this.$logger.trace("Looking for project in '%s'", projectDir);

				if(this.$fs.exists(path.join(projectDir, this.$staticConfig.PROJECT_FILE_NAME)).wait()) {
					this.$logger.debug("Project directory is '%s'.", projectDir);
					this.cachedProjectDir = projectDir;
					break;
				}

				var dir = path.dirname(projectDir);
				if(dir === projectDir) {
					this.$logger.debug("No project found at or above '%s'.", path.resolve("."));
					break;
				}
				projectDir = dir;
			}

			return this.cachedProjectDir;
		}).future<string>()();
	}

	public createTemplateFolder(projectDir: string): IFuture<void> {
		return (() => {
			this.$fs.createDirectory(projectDir).wait();
			var projectDirFiles = this.$fs.readDirectory(projectDir).wait();

			if(projectDirFiles.length !== 0) {
				this.$errors.fail("The specified directory must be empty to create a new project.");
			}
		}).future<void>()();
	}

	public createProjectFile(projectDir: string, properties: any): IFuture<void> {
		return ((): void => {
			properties = properties || {};

			this.$fs.createDirectory(projectDir).wait();
			this.cachedProjectDir = projectDir;
			this.projectData = properties;
			this.frameworkProject = this.$frameworkProjectResolver.resolve(this.projectData.Framework);

			this.$projectPropertiesService.completeProjectProperties(this.projectData, this.frameworkProject);

			this.validateProjectData(this.projectData);
			this.saveProject(projectDir).wait();
		}).future<void>()();
	}

	public createNewProject(projectName: string, framework: string): IFuture<void> {
		if(!projectName) {
			this.$errors.fail("No project name specified.")
		}

		var projectDir = this.getNewProjectDir();
		this.frameworkProject = this.$frameworkProjectResolver.resolve(framework);
		return this.createFromTemplate(projectName, projectDir);
	}

	public initializeProjectFromExistingFiles(framework: string): IFuture<void> {
		return ((): void => {
			var projectDir = this.getNewProjectDir();
			if(!this.$fs.exists(projectDir).wait()) {
				this.$errors.fail({ formatStr: util.format("The specified folder '%s' does not exist!", projectDir), suppressCommandHelp: true });
			}

			var projectFile = path.join(projectDir, this.$staticConfig.PROJECT_FILE_NAME);
			if(this.$fs.exists(projectFile).wait()) {
				this.$errors.fail({ formatStr: "The specified folder is already an AppBuilder command line project!", suppressCommandHelp: true });
			}

			this.frameworkProject = this.$frameworkProjectResolver.resolve(framework);
			var blankTemplateFile = this.frameworkProject.getTemplateFilename("Blank");
			this.$fs.unzip(path.join(this.$templatesService.projectTemplatesDir, blankTemplateFile), projectDir, { overwriteExisitingFiles: false }, ["*.abproject", ".abignore"]).wait();

			this.createProjectFileFromExistingProject(projectDir, framework).wait();
		}).future<void>()();
	}

	private createProjectFileFromExistingProject(projectDir: string, framework: string): IFuture<void> {
		return ((): void => {
			var appname = path.basename(projectDir);

			var properties = this.getProjectPropertiesFromExistingProject(projectDir, appname).wait();
			this.projectData = this.alterPropertiesForNewProject(properties, appname);

			try {
				this.validateProjectData(this.projectData);
				this.saveProject(projectDir).wait();
			}
			catch(e) {
				this.$errors.fail("There was an error while initialising the project: " + os.EOL + e);
			}
		}).future<void>()();
	}

	public getNewProjectDir() {
		return options.path || process.cwd();
	}

	public ensureProject(): void {
		if(!this.projectData) {
			this.$errors.fail("No project found at or above '%s' and neither was a --path specified.", process.cwd());
		}
	}

	public ensureCordovaProject() {
		this.ensureProject();

		if(this.projectData.Framework !== this.$projectConstants.TARGET_FRAMEWORK_IDENTIFIERS.Cordova) {
			this.$errors.fail("This command is applicable only to Cordova projects.");
		}
	}

	public enumerateProjectFiles(additionalExcludedProjectDirsAndFiles?: string[]): IFuture<string[]> {
		return (() => {
			var projectDir = this.getProjectDir().wait();
			var projectFiles = this.$projectFilesManager.enumerateProjectFiles(projectDir, additionalExcludedProjectDirsAndFiles).wait();
			return projectFiles;
		}).future<string[]>()();
	}

	public onWPSdkVersionChanging(newVersion: string): IFuture<void> {
		return ((): void => {
			if(newVersion === this.projectData["WPSdk"]) {
				return;
			}

			var validWPSdks = this.getSupportedWPFrameworks().wait();
			if(!_.contains(validWPSdks, newVersion)) {
				this.$errors.failWithoutHelp("The selected version %s is not supported. Supported versions are %s", newVersion, validWPSdks.join(", "));
			}

			this.$logger.info("Migrating to WPSdk version %s", newVersion);
			if(helpers.versionCompare(newVersion, "8.0") > 0) {
				// at least Cordova 3.7 is required
				if(helpers.versionCompare(this.projectData.FrameworkVersion, "3.7.0") < 0) {
					var cordovaVersions = this.$cordovaMigrationService.getSupportedFrameworks().wait();

					// Find last framework which is not experimental.
					var selectedFramework = _.findLast(cordovaVersions, cv => cv.DisplayName.indexOf(Project.EXPERIMENTAL_TAG) === -1);
					if(helpers.versionCompare(selectedFramework.Version, "3.7.0") < 0) {
						// if latest stable framework version is below 3.7.0, find last 'Experimental'.
						selectedFramework = _.findLast(cordovaVersions, cv => cv.DisplayName.indexOf(Project.EXPERIMENTAL_TAG) !== -1 && helpers.versionCompare("3.7.0", cv.Version) <= 0);
					}

					var shouldUpdateFramework = this.$prompter.confirm(util.format("You are trying to use version of Windows Phone SDK that is not supported for your project's Cordova version. Do you want to use %s?", selectedFramework.DisplayName)).wait()
					if(shouldUpdateFramework) {
						this.onFrameworkVersionChanging(selectedFramework.Version).wait();
						this.projectData.FrameworkVersion = selectedFramework.Version;
					} else {
						this.$errors.failWithoutHelp("Unable to use Windows Phone SDK %s as the current Cordova version %s does not support it. You should target at least Cordova 3.7.0 in order to use Windows Phone 8.1 SDK.", newVersion, selectedFramework.Version);
					}
				}
			}
		}).future<void>()();
	}

	public onFrameworkVersionChanging(newVersion: string): IFuture<void> {
		return ((): void => {
			if(newVersion === this.projectData.FrameworkVersion) {
				return;
			}

			if(this.projectData.WPSdk && helpers.versionCompare(this.projectData.WPSdk, "8.0") > 0 && helpers.versionCompare(newVersion, "3.7.0") < 0) {
				var shouldUpdateWPSdk = this.$prompter.confirm("You are trying to use version of Cordova that does not support current Windows Phone SDK version. Do you want to use Windows Phone SDK 8.0?").wait();
				if(shouldUpdateWPSdk) {
					this.onWPSdkVersionChanging("8.0").wait();
					this.projectData.WPSdk = "8.0";
				} else {
					this.$errors.failWithoutHelp("Unable to use Cordova version %s. The project uses Windows Phone SDK %s which is not supported in this Cordova version.", newVersion, this.projectData["WPSdk"]);
				}
			}

			var versionDisplayName = this.$cordovaMigrationService.getDisplayNameForVersion(newVersion).wait();
			this.$logger.info("Migrating to Cordova version %s", versionDisplayName);
			var oldVersion = this.projectData.FrameworkVersion;

			_.each(this.configurations, (configuration: string) => {
				var oldPluginsList = this.getProperty("CorePlugins", configuration);
				var newPluginsList = this.$cordovaMigrationService.migratePlugins(oldPluginsList, oldVersion, newVersion).wait();
				this.$logger.trace("Migrated core plugins to: ", helpers.formatListOfNames(newPluginsList, "and"));
				this.setProperty("CorePlugins", newPluginsList, configuration);
			});

			var successfullyChanged: string[] = [],
				backupSuffix = ".backup";
			try {
				Object.keys(MobileHelper.platformCapabilities).forEach((platform) => {
					this.$logger.trace("Replacing cordova.js file for %s platform ", platform);
					var cordovaJsFileName = path.join(this.getProjectDir().wait(), util.format("cordova.%s.js", platform).toLowerCase());
					var cordovaJsSourceFilePath = this.$resources.buildCordovaJsFilePath(newVersion, platform);
					this.$fs.copyFile(cordovaJsFileName, cordovaJsFileName + backupSuffix).wait();
					this.$fs.copyFile(cordovaJsSourceFilePath, cordovaJsFileName).wait();
					successfullyChanged.push(cordovaJsFileName);
				});
			} catch(error) {
				_.each(successfullyChanged, file => {
					this.$logger.trace("Reverting %s", file);
					this.$fs.copyFile(file + backupSuffix, file).wait();
				});
				throw error;
			}
			finally {
				_.each(successfullyChanged, file => {
					this.$fs.deleteFile(file + backupSuffix).wait();
				});
			}

			this.$logger.info("Successfully migrated to version %s", versionDisplayName);
		}).future<void>()();
	}

	public getSupportedPlugins(): IFuture<string[]> {
		return (() => {
			var version: string;
			if(this.projectData) {
				version = this.projectData.FrameworkVersion;
			} else {
				var selectedFramework = _.last(_.select(this.$cordovaMigrationService.getSupportedFrameworks().wait(), (sv: Server.FrameworkVersion) => sv.DisplayName.indexOf(Project.EXPERIMENTAL_TAG) === -1));
				version = selectedFramework.Version;
			}

			return this.$cordovaMigrationService.pluginsForVersion(version).wait();
		}).future<string[]>()();
	}

	public getSupportedWPFrameworks(): IFuture<string[]>{
		return ((): string[]=> {
			var validValues: string[] = [];
			var projectSchema = this.getProjectSchema().wait();
			if(projectSchema) {
				validValues = this.$projectPropertiesService.getValidValuesForProperty(projectSchema["WPSdk"]).wait();
			}

			return validValues;
		}).future<string[]>()();
	}

	public get projectTargets(): IFuture<string[]> {
		return (() => {
			var projectDir = this.getProjectDir().wait();
			var projectTargets = this.frameworkProject.getProjectTargets(projectDir).wait();

			return projectTargets;
		}).future<string[]>()();
	}

	public getTempDir(extraSubdir?: string): IFuture<string> {
		return (() => {
			var dir = path.join(this.getProjectDir().wait(), ".ab");
			this.$fs.createDirectory(dir).wait();
			if(extraSubdir) {
				dir = path.join(dir, extraSubdir);
				this.$fs.createDirectory(dir).wait();
			}
			return dir;
		}).future<string>()();
	}

	public updateProjectPropertyAndSave(mode: string, propertyName: string, propertyValues: string[]): IFuture<void> {
		return (() => {
			this.ensureProject();

			this.$projectPropertiesService.updateProjectProperty(this.projectData, mode, propertyName, propertyValues).wait();
			this.printProjectProperty(propertyName).wait();
			this.saveProject(this.getProjectDir().wait()).wait();
		}).future<void>()();
	}

	public printProjectProperty(property: string): IFuture<void> {
		return (() => {
			if(this.projectData) {
				var schema: any = this.getProjectSchema().wait();

				if(property) {
					var normalizedPropertyName = this.$projectPropertiesService.normalizePropertyName(property, this.projectData);

					if(options.validValue) {
						// '$ appbuilder prop print <PropName> --validValue' called inside project dir
						var prop: any = schema[normalizedPropertyName];
						this.printValidValuesOfProperty(prop).wait();
					} else {
						// '$ appbuilder prop print <PropName>' called inside project dir
						if(_.has(this.projectData, normalizedPropertyName)) {
							this.$logger.out(this.projectData[normalizedPropertyName]);
						} else {
							this.$errors.fail("Unrecognized project property '%s'", property);
						}
					}
				} else {
					if(options.validValue) {
						// 'appbuilder prop print --validValue' called inside project dir
						var propKeys: any = _.keys(schema);
						var sortedProperties = _.sortBy(propKeys, (propertyName: string) => propertyName.toUpperCase());
						_.each(sortedProperties, propKey => {
							var prop = schema[propKey];
							this.$logger.info("  " + propKey);
							this.printValidValuesOfProperty(prop).wait();
						});
					} else {
						// 'appbuilder prop print' called inside project dir
						var propKeys: any = _.keys(this.projectData);
						var sortedProperties = _.sortBy(propKeys, (propertyName: string) => propertyName.toUpperCase());
						_.each(sortedProperties, (propertyName: string) => this.$logger.out(propertyName + ": " + this.projectData[propertyName]));
					}
				}
			} else {
				// We'll get here only when command is called outside of project directory and --validValue is specified
				if(property) {
					var targetFrameworkIdentifiers = _.values(this.$projectConstants.TARGET_FRAMEWORK_IDENTIFIERS);
					_.each(targetFrameworkIdentifiers, (targetFrameworkIdentifier: string) => {
						var projectSchema: IDictionary<any> = this.$jsonSchemaValidator.tryResolveValidationSchema(targetFrameworkIdentifier);
						var currentProp = _.find(_.keys(projectSchema), key => key === property);
						if(currentProp) {
							this.$logger.out("  Project type %s:", targetFrameworkIdentifier);
							this.printValidValuesOfProperty(projectSchema[currentProp]).wait();
						}
					});
				} else {
					this.$logger.out(this.$projectPropertiesService.getPropertiesForAllSupportedProjects().wait());
				}
			}
		}).future<void>()();
	}

	private printValidValuesOfProperty(property: any): IFuture<void> {
		return (() => {
			if(property.description) {
				this.$logger.info("%s%s", Project.INDENTATION, property.description);
			}

			if(property.pattern) {
				this.$logger.trace("%sDesired pattern is: %s", Project.INDENTATION, property.pattern);
			}

			var validValues: string[] = this.$projectPropertiesService.getValidValuesForProperty(property).wait();
			if(validValues) {
				this.$logger.out("%sValid values:", Project.INDENTATION);
				_.forEach(validValues, value => {
					this.$logger.out("%s  %s", Project.INDENTATION, value);
				});
			}
		}).future<void>()();
	}

	public validateProjectProperty(property: string, args: string[], mode: string): IFuture<boolean> {
		return (() => {
			var validProperties = this.$jsonSchemaValidator.getValidProperties(this.projectData.Framework, this.projectData.FrameworkVersion);
			if(_.contains(validProperties, property)) {
				var normalizedPropertyName =  this.$projectPropertiesService.normalizePropertyName(property, this.projectData);
				var isArray = this.$jsonSchemaValidator.getPropertyType(this.projectData.Framework, normalizedPropertyName) === "array";
				if(!isArray) {
					if(!args || args.length === 0 ) {
						this.$errors.fail("Property %s requires a single value.", property);
					}
					if(args.length !== 1) {
						this.$errors.fail("Property '%s' is not a collection of flags. Specify only a single property value.", property);
					}

					if(mode === "add" || mode === "del") {
						this.$errors.fail("Property '%s' is not a collection of flags. Use prop-set to set a property value.", property);
					}
				}

				return true;
			}

			this.$errors.fail("Invalid property name '%s'.", property);
		}).future<boolean>()();
	}

	public getProjectSchema(): IFuture<any> {
		return (() => {
			if(!this._projectSchema) {
				this._projectSchema = this.frameworkProject.getProjectFileSchema();
			}

			return this._projectSchema;
		}).future<any>()();
	}

	public adjustBuildProperties(buildProperties: any): any {
		return this.frameworkProject.adjustBuildProperties(buildProperties, this.projectInformation);
	}

	public get requiredAndroidApiLevel(): number {
		return this.frameworkProject.requiredAndroidApiLevel;
	}

	public ensureAllPlatformAssets(): IFuture<void> {
		return (() => {
			var projectDir = this.getProjectDir().wait();
			this.frameworkProject.ensureAllPlatformAssets(projectDir, this.projectData.FrameworkVersion).wait();
		}).future<void>()();
	}

	private validateProjectData(properties: any): void {
		this.$jsonSchemaValidator.validate(properties);
	}

	public saveProject(projectDir: string): IFuture<void> {
		return (() => {
			projectDir = projectDir || this.getProjectDir().wait();
			this.$fs.writeJson(path.join(projectDir, this.$staticConfig.PROJECT_FILE_NAME), this.projectData).wait();

			_.each(this.configurations, (configuration: string) => {
				var configFilePath = path.join(projectDir, util.format(".%s%s", configuration, this.$projectConstants.PROJECT_FILE));

				if(this.$fs.exists(configFilePath).wait() && this.configurationSpecificData[configuration]) {
					this.$fs.writeJson(configFilePath, this.configurationSpecificData[configuration]).wait();
				}
			});
		}).future<void>()();
	}

	private get projectInformation(): Project.IProjectInformation {
		return {
			projectData: this.projectData,
			configurationSpecificData: this.configurationSpecificData,
			hasBuildConfigurations: this._hasBuildConfigurations
		}
	}

	private readProjectData(): IFuture<void> {
		return (() => {
			var projectDir = this.getProjectDir().wait();
			var shouldSaveProject = false;
			if(projectDir) {
				var projectFilePath = path.join(projectDir, this.$staticConfig.PROJECT_FILE_NAME);
				try {
					var data = this.$fs.readJson(projectFilePath).wait();
					if(data.projectVersion && data.projectVersion !== 1) {
						this.$errors.fail("FUTURE_PROJECT_VER");
					}

					if(!_.has(data, "Framework")) {
						if(_.has(data, "projectType")) {
							data["Framework"] = data["projectType"];
							delete data["projectType"];
						} else {
							data["Framework"] = this.$projectConstants.TARGET_FRAMEWORK_IDENTIFIERS.Cordova;
						}

						shouldSaveProject = true;
					}

					this.projectData = data;
					this.frameworkProject = this.$frameworkProjectResolver.resolve(this.projectData.Framework);
					shouldSaveProject = this.$projectPropertiesService.completeProjectProperties(this.projectData, this.frameworkProject) || shouldSaveProject;
					
					if(this.$staticConfig.triggerJsonSchemaValidation) {
						this.$jsonSchemaValidator.validate(this.projectData);
					}

					var debugProjectFile = path.join(projectDir, this.$projectConstants.DEBUG_PROJECT_FILE_NAME);
					if(options.debug && !this.$fs.exists(debugProjectFile).wait()) {
						this.$fs.writeJson(debugProjectFile, {}).wait();
					}

					var releaseProjectFile = path.join(projectDir, this.$projectConstants.RELEASE_PROJECT_FILE_NAME);
					if(options.release && !this.$fs.exists(releaseProjectFile).wait()) {
						this.$fs.writeJson(releaseProjectFile, {}).wait();
					}

					var allProjectFiles = commonHelpers.enumerateFilesInDirectorySync(projectDir, (file: string, stat: IFsStats) => {
						return Project.CONFIGURATION_FILE_SEARCH_PATTERN.test(file);
					});

					_.each(allProjectFiles, (configProjectFile: string) => {
						var configMatch = path.basename(configProjectFile).match(Project.CONFIGURATION_FROM_FILE_NAME_REGEX);
						if(configMatch && configMatch.length > 1) {
							var configurationName = configMatch[1];
							var configProjectContent = this.$fs.readJson(configProjectFile).wait();
							this.configurationSpecificData[configurationName.toLowerCase()] = configProjectContent;
							this._hasBuildConfigurations = true;
						}
					});
				} catch(err) {
					if(err === "FUTURE_PROJECT_VER") {
						this.$errors.fail({
							formatStr: "This project is created by a newer version of AppBuilder. Upgrade AppBuilder CLI to work with it.",
							suppressCommandHelp: true
						});
					}
					this.$errors.fail({
						formatStr: "The project file %s is corrupted." + os.EOL +
						"Consider restoring an earlier version from your source control or backup." + os.EOL +
						"To create a new one with the default settings, delete this file and run $ appbuilder init hybrid." + os.EOL +
						"Additional technical info: %s",
						suppressCommandHelp: true
					},
						projectFilePath, err.toString());
				}

				if(shouldSaveProject && this.$config.AUTO_UPGRADE_PROJECT_FILE) {
					this.saveProject(projectDir).wait();
				}
			}
		}).future<void>()();
	}

	private createFromTemplate(appname: string, projectDir: string): IFuture<void> {
		return (() => {
			var templatesDir = this.$templatesService.projectTemplatesDir;
			var template = options.template || this.frameworkProject.defaultProjectTemplate;
			var templateFileName = path.join(templatesDir, this.frameworkProject.getTemplateFilename(template));

			this.$logger.trace("Using template '%s'", templateFileName);
			if(this.$fs.exists(templateFileName).wait()) {
				projectDir = path.join(projectDir, appname);
				this.$logger.trace("Creating template folder '%s'", projectDir);
				this.createTemplateFolder(projectDir).wait();
				try {
					this.$logger.trace("Extracting template from '%s'", templateFileName);
					this.$fs.unzip(templateFileName, projectDir).wait();
					this.$logger.trace("Reading template project properties.");

					var properties = this.$projectPropertiesService.getProjectProperties(path.join(projectDir, this.$projectConstants.PROJECT_FILE), true, this.frameworkProject).wait();
					properties = this.alterPropertiesForNewProject(properties, appname);
					this.$logger.trace(properties);
					this.$logger.trace("Saving project file.");
					this.createProjectFile(projectDir, properties).wait();
					this.$logger.trace("Removing unnecessary files from template.");
					this.removeExtraFiles(projectDir).wait();
					this.$fs.createDirectory(path.join(projectDir, "hooks")).wait();
					this.$logger.info("Project '%s' has been successfully created in '%s'.", appname, projectDir);
				}
				catch(ex) {
					this.$fs.deleteDirectory(projectDir).wait();
					throw ex;
				}
			} else {
				var templates = this.frameworkProject.projectTemplatesString().wait();

				var message = util.format("The specified template %s does not exist. You can use any of the following templates: %s",
					options.template,
					os.EOL,
					templates);
				this.$errors.fail({ formatStr: message, suppressCommandHelp: true });
			}
		}).future<void>()();
	}

	private alterPropertiesForNewProject(properties: any, projectName: string): IProjectData {
		properties.ProjectGuid = commonHelpers.createGUID();
		properties.ProjectName = projectName;

		this.frameworkProject.alterPropertiesForNewProject(properties, projectName);

		return properties;
	}

	private removeExtraFiles(projectDir: string): IFuture<void> {
		return ((): void => {
			_.each(["mobile.vstemplate"],
				(file) => this.$fs.deleteFile(path.join(projectDir, file)).wait());
		}).future<void>()();
	}

	private getProjectPropertiesFromExistingProject(projectDir: string, appname: string): IFuture<IProjectData> {
		return ((): any => {
			var projectFile = _.find(this.$fs.readDirectory(projectDir).wait(), file => {
				var extension = path.extname(file);
				return extension == ".proj" || extension == ".iceproj" || file === this.$projectConstants.PROJECT_FILE;
			});

			if(projectFile) {
				var isJsonProjectFile = projectFile === this.$projectConstants.PROJECT_FILE;
				return this.$projectPropertiesService.getProjectProperties(path.join(projectDir, projectFile), isJsonProjectFile, this.frameworkProject).wait();
			}

			this.$logger.warn("No AppBuilder project file found in folder. Creating project with default settings!");
			return null;
		}).future<IProjectData>()();
	}
}
$injector.register("project", Project);
