///<reference path="../../.d.ts"/>
"use strict";

import Future = require("fibers/future");
import path = require("path");
import options = require("./../../options");
import util = require("util");

import ProjectCommandBaseLib = require("./project-command-base");

export class CreateCommand extends ProjectCommandBaseLib.ProjectCommandBase {
	constructor($errors: IErrors,
		private $fs: IFileSystem,
		private $nameCommandParameter: ICommandParameter,
		$project: Project.IProject,
		private $projectConstants: Project.IProjectConstants,
		private $screenBuilderService: IScreenBuilderService) {
		super($errors, $project);
	}

	public execute(args: string[]): IFuture<void> {
		return (() => {
			var projectName = args[0];
			var projectPath = path.join(this.$project.getNewProjectDir(), projectName);
			this.$fs.createDirectory(projectPath).wait();

			var screenBuilderOptions = {
				projectPath: projectPath,
				answers: {
					name: projectName
				}
			};
			this.$screenBuilderService.prepareAndGeneratePrompt(this.$screenBuilderService.generatorName, screenBuilderOptions).wait();
			this.$screenBuilderService.installAppDependencies().wait();

			this.$project.initializeProjectFromExistingFiles(this.$projectConstants.TARGET_FRAMEWORK_IDENTIFIERS.Cordova).wait();
		}).future<void>()();
	}

	public canExecute(args: string[]): IFuture<boolean> {
		return this.canExecuteCore();
	}

	allowedParameters = [this.$nameCommandParameter];
}
$injector.registerCommand("create|*default", CreateCommand);