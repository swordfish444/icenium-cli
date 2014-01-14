///<reference path="../.d.ts"/>
"use strict";

import fs = require("fs");
import path = require("path");
import util = require("util");

export class HelpCommandData implements Commands.ICommandData {
	constructor(private topic: string = "") {}

	public get Topic() {
		return this.topic;
	}
}

export class HelpCommandDataFactory implements Commands.ICommandDataFactory {
	public fromCliArguments(args: string[]): HelpCommandData {
		if (args.length == 0) {
			return new HelpCommandData();
		} else {
			return new HelpCommandData(args[0]);
		}
	}
}
$injector.register("helpCommandDataFactory", HelpCommandDataFactory);

export class HelpCommand implements Commands.ICommand<HelpCommandData> {
	constructor(private helpCommandDataFactory: HelpCommandDataFactory,
		private logger: ILogger) {
	}

	public getDataFactory(): HelpCommandDataFactory {
		return this.helpCommandDataFactory;
	}

	public canExecute(data: HelpCommandData): boolean {
		return true;
	}

	public execute(data: HelpCommandData): void {
		fs.readFile(path.join(__dirname, "../../resources/help.txt"), "utf8", (err, helpContent) => {
			if (err) {
				throw err;
			}

			var pattern = util.format("--\\[%s\\]--((.|[\\r\\n])+?)--\\[/\\]--", data.Topic);
			var regex = new RegExp(pattern);

			var match = regex.exec(helpContent);
			if (match) {
				console.log(match[1].trim());
			} else {
				this.logger.fatal("Unknown help topic '%s'", data.Topic);
			}
		});
	}
}
$injector.registerCommand("help", HelpCommand);