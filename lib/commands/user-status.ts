
import * as util from "util";

export class UserStatusCommand implements ICommand {
	constructor(private $userDataStore: IUserDataStore,
		private $logger: ILogger,
		private $config: IConfiguration) { }

	public allowedParameters: ICommandParameter[] = [];

	public async execute(args: string[]): Promise<void> {
		let user = await this.$userDataStore.getUser();

		let fields: IStringDictionary = {
			"Name": user.name,
			"E-mail": user.email
		};

		if (user.tenant) {
			fields["License"] = util.format("%s (%s)", user.tenant.editionType, user.tenant.license);
			let expires = new Date(Date.parse(user.tenant.expSoft));
			fields["License expires"] = expires.toLocaleDateString();
			fields["Licensed by"] = user.tenant.name;
		}

		let fieldNames = Object.keys(fields);
		let maxPrefixLength = _.maxBy(fieldNames, (name: string) => name.length).length;
		fieldNames.forEach((field) => {
			let padding = _.range(maxPrefixLength - field.length).map((x) => " ").join("");
			this.$logger.out("%s%s: %s", padding, field, fields[field]);
		});
		this.$logger.out("\nView your account at %s://%s/appbuilder/account/subscription", this.$config.AB_SERVER_PROTO, this.$config.AB_SERVER);
	}
}

$injector.registerCommand("user", UserStatusCommand);
