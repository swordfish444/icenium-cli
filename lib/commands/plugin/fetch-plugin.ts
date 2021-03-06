export class FetchPluginCommand implements ICommand {
	constructor(private $pluginsService: IPluginsService,
		private $logger: ILogger,
		private $stringParameter: ICommandParameter) { }

	public allowedParameters = [this.$stringParameter];

	public async execute(args: string[]): Promise<void> {
		let pluginName = await this.$pluginsService.fetch(args[0]);

		this.$logger.printMarkdown(`Successfully fetched plugin \`${pluginName}\``);
	}
}

$injector.registerCommand("plugin|fetch", FetchPluginCommand);
