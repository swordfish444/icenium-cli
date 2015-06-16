///<reference path="../.d.ts"/>

"use strict";
import util = require("util");
import path = require("path");
import helpers = require("../helpers");

export class RemoteProjectService implements IRemoteProjectService {
	private clientSolutions: Server.TapSolutionData[];
	private clientProjectsPerSolution: IDictionary<Server.IWorkspaceItemData[]> = {};

	constructor(private $server: Server.IServer,
				private $userDataStore: IUserDataStore,
				private $serviceProxy: Server.IServiceProxy,
				private $errors: IErrors) { }

	public makeTapServiceCall<T>(call: () => IFuture<T>): IFuture<T> {
		return (() => {
			let user = this.$userDataStore.getUser().wait();
			let tenantId = user.tenant.id;
			this.$serviceProxy.setSolutionSpaceName(tenantId);
			try {
				return call().wait();
			} finally {
				this.$serviceProxy.setSolutionSpaceName(null);
			}
		}).future<T>()();
	}

	public getSolutionName(solutionId: string): IFuture<string> {
		return ((): string => {
			let clientSolutions = this.getSolutions().wait();

			let result = helpers.findByNameOrIndex(solutionId, clientSolutions, (clientSolution: Server.TapSolutionData) => clientSolution.name);
			if(!result) {
				this.$errors.failWithoutHelp("Could not find solution named '%s' or was not given a valid index. List available solutions with 'cloud list' command", solutionId);
			}

			return result.name;
		}).future<string>()();
	}
	
	public getProjectName(solutionId: string, projectId: string): IFuture<string> {
		return ((): string => {
			let slnName = this.getSolutionName(solutionId).wait();
			let clientProjects = this.getProjectsForSolution(slnName).wait();
			let result = helpers.findByNameOrIndex(projectId, clientProjects, (clientProject: Server.IWorkspaceItemData) => clientProject.Name);
			if(!result) {
				this.$errors.failWithoutHelp("Could not find project named '%s' inside '%s' solution or was not given a valid index. List available solutions with 'cloud list' command", projectId, solutionId);
			}

			return result.Name;
		}).future<string>()();
	}

	public getSolutions(): IFuture<Server.TapSolutionData[]> {
		return (() => {
			if (!this.clientSolutions) {
				let existingClientSolutions = this.makeTapServiceCall(() => this.$server.tap.getExistingClientSolutions()).wait();
				this.clientSolutions = _.sortBy(existingClientSolutions, (clientSolution: Server.TapSolutionData) => clientSolution.name);
			}

			return this.clientSolutions;
		}).future<Server.TapSolutionData[]>()();
	}

	public getProjectProperties(solutionId: string, projectId: string): IFuture<any> {
		return (() => {
			let solutionName = this.getSolutionName(solutionId).wait();
			let projectName = this.getProjectName(solutionName, projectId).wait();
			let properties = (<any>this.getProjectData(solutionName, projectName).wait())["Properties"];
			properties.ProjectName = projectName;
			return properties;
		}).future()();
	}

	public getProjectsForSolution(solutionName: string): IFuture<Server.IWorkspaceItemData[]> {
		return ((): Server.IWorkspaceItemData[] => {
			let slnName = this.getSolutionName(solutionName).wait();
			if(!(this.clientProjectsPerSolution[slnName] && this.clientProjectsPerSolution[slnName].length > 0)) {
				this.clientProjectsPerSolution[slnName] = _.sortBy(this.getSolutionData(slnName).wait().Items, project => project.Name);
			}

			return this.clientProjectsPerSolution[slnName];
		}).future<Server.IWorkspaceItemData[]>()();
	}

	private getSolutionData(projectName: string): IFuture<Server.SolutionData> {
		return this.makeTapServiceCall(() => this.$server.projects.getSolution(projectName, true));
	}

	private getProjectData(solutionName: string, projectName: string): IFuture<Server.IWorkspaceItemData> {
		return (() => {
			return _.find(this.getProjectsForSolution(solutionName).wait(), pr => pr.Name === projectName);
		}).future<Server.IWorkspaceItemData>()();
	}
}
$injector.register("remoteProjectService", RemoteProjectService);