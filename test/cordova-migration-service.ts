///<reference path=".d.ts"/>

import Future = require("fibers/future");
import chai = require("chai");
import fs = require("fs");
import path = require("path");
import stubs = require("./stubs");
import yok = require("../lib/common/yok");
import cordovaMigrationService = require("../lib/services/cordova-migration-service");
let assert: chai.Assert = chai.assert;

let testInjector = new yok.Yok();
testInjector.register("server", {});
testInjector.register("errors", {});
testInjector.register("logger", {});
testInjector.register("mobileHelper", {});
testInjector.register("pluginsService", {
	getPluginBasicInformation: (pluginName: string) => { 
		return {
			name: 'Name',
			version: '1.0.0'
		}
	},
	getPluginVersions: (pluginName: string) => {
		return [{
			name: '1.0.0',
			value: '1.0.0',
			minCordova: '3.0.0'
		}]
	},
	removePlugin: (pluginName: string) => {return (() => { }).future<void>()() },
	isPluginSupported: (plugin: string, version: string, migrationVersion: string) => { return true;}
});
testInjector.register("project", {});
testInjector.register("projectConstants", {});
testInjector.register("projectPropertiesService", {});
testInjector.register("prompter", {
	promptForChoice: (promptMessage: string, choices: any[]) => { return (() => { return choices[0] }).future<string>()() }
});
testInjector.register("resources", {});
testInjector.register("loginManager", { ensureLoggedIn: (): IFuture<void> => { return (() => { }).future<void>()() }});
testInjector.register("webViewService", {});
testInjector.register("serverConfiguration", {});
testInjector.register("httpClient", {});

function registerMockedFS(mockResult: any): void {
	testInjector.register("fs", {
		readJson: () => { return Future.fromResult(mockResult); },
	});
}

describe("cordova-migration-service", () => {
	describe("migratePlugins", () => {
		it("Return unchanged plugins if no rename matches", () => {
			registerMockedFS({
				renamedPlugins:
				[{
					version: "3.2.0",
					oldName: "org.apache.cordova.AudioHandler",
					newName: "org.apache.cordova.media"
				}],
				integratedPlugins: {
					"3.2.0": ["org.apache.cordova.media", "plugin"]
				}
			});

			let service: ICordovaMigrationService = testInjector.resolve(cordovaMigrationService.CordovaMigrationService);
			assert.deepEqual(service.migratePlugins(["plugin"], "3.0.0", "3.2.0").wait(), ["plugin"]);
		});

		it("Return unchanged plugins if a rename matches but it's for a later version", () => {
			registerMockedFS({
				renamedPlugins:
				[{
					version: "3.4.0",
					oldName: "org.apache.cordova.AudioHandler",
					newName: "org.apache.cordova.media"
				}],
				integratedPlugins: {
					"3.2.0": ["org.apache.cordova.AudioHandler"],
					"3.4.0": ["org.apache.cordova.media"]
				}
			});

			let service: ICordovaMigrationService = testInjector.resolve(cordovaMigrationService.CordovaMigrationService);
			assert.deepEqual(service.migratePlugins(["org.apache.cordova.AudioHandler"], "3.0.0", "3.2.0").wait(), ["org.apache.cordova.AudioHandler"]);
		});

		it("Remove plugins if they are no longer available in the version we are migrating to", () => {
			registerMockedFS({
				renamedPlugins: [],
				integratedPlugins: {
					"3.0.0": ["org.apache.cordova.camera"],
					"3.2.0": ["org.apache.cordova.camera", "org.apache.cordova.statusbar"]
				}
			});

			let service: ICordovaMigrationService = testInjector.resolve(cordovaMigrationService.CordovaMigrationService);
			assert.deepEqual(service.migratePlugins(["org.apache.cordova.camera", "org.apache.cordova.statusbar"], "3.2.0", "3.0.0").wait(), ["org.apache.cordova.camera"]);
		});

		it("Return renamed plugin if a rename matches", () => {
			registerMockedFS({
				renamedPlugins: [{
					version: "3.2.0",
					oldName: "org.apache.cordova.AudioHandler",
					newName: "org.apache.cordova.media"
				}],
				integratedPlugins: {
					"3.2.0": ["org.apache.cordova.media"]
				}
			});

			let service: ICordovaMigrationService = testInjector.resolve(cordovaMigrationService.CordovaMigrationService);
			assert.deepEqual(service.migratePlugins(["org.apache.cordova.AudioHandler"], "3.0.0", "3.2.0").wait(), ["org.apache.cordova.media"]);
		});

		it("Return renamed plugin if a rename matches and it is a downgrade", () => {
			registerMockedFS({
				renamedPlugins: [{
					version: "3.2.0",
					oldName: "org.apache.cordova.AudioHandler",
					newName: "org.apache.cordova.media"
				}],
				integratedPlugins: {
					"3.0.0": ["org.apache.cordova.AudioHandler"],
				}
			});

			let service: ICordovaMigrationService = testInjector.resolve(cordovaMigrationService.CordovaMigrationService);
			assert.deepEqual(service.migratePlugins(["org.apache.cordova.media"], "3.2.0", "3.0.0").wait(), ["org.apache.cordova.AudioHandler"]);
		});

		it("Return renamed plugin if a rename matches and new plugin is marketplace", () => {
			registerMockedFS({
				renamedPlugins: [{
					version: "3.7.0",
					oldName: "org.apache.cordova.sqlite",
					newName: "org.apache.cordova.sqlite@1.0.2"
				}],
				integratedPlugins: {
					"3.5.0": ["org.apache.cordova.sqlite"],
				}
			});

			let service: ICordovaMigrationService = testInjector.resolve(cordovaMigrationService.CordovaMigrationService);
			assert.deepEqual(service.migratePlugins(["org.apache.cordova.sqlite"], "3.5.0", "3.7.0").wait(), ["org.apache.cordova.sqlite@1.0.2"]);
		});

		it("Return renamed plugin if there is a rename chain", () => {
			registerMockedFS({
				renamedPlugins: [{
					version: "3.2.0",
					oldName: "org.apache.cordova.AudioHandler",
					newName: "org.apache.cordova.media"
				},
				{
					version: "3.4.0",
					oldName: "org.apache.cordova.media",
					newName: "org.apache.cordova.NewMedia"
					}],
				integratedPlugins: {
					"3.4.0": ["org.apache.cordova.NewMedia"]
				}
			});

			let service: ICordovaMigrationService = testInjector.resolve(cordovaMigrationService.CordovaMigrationService);
			assert.deepEqual(service.migratePlugins(["org.apache.cordova.AudioHandler"], "3.0.0", "3.4.0").wait(), ["org.apache.cordova.NewMedia"]);
		});

		it("Return renamed plugin if there is a rename chain when downgrading", () => {
			registerMockedFS({
				renamedPlugins: [{
					version: "3.2.0",
					oldName: "org.apache.cordova.AudioHandler",
					newName: "org.apache.cordova.media"
				},
				{
					version: "3.4.0",
					oldName: "org.apache.cordova.media",
					newName: "org.apache.cordova.NewMedia"
					}],
				integratedPlugins: {
					"3.0.0": ["org.apache.cordova.AudioHandler"]
				}
			});

			let service: ICordovaMigrationService = testInjector.resolve(cordovaMigrationService.CordovaMigrationService);
			assert.deepEqual(service.migratePlugins(["org.apache.cordova.NewMedia"], "3.4.0", "3.0.0").wait(), ["org.apache.cordova.AudioHandler"]);
		});
	});
});
