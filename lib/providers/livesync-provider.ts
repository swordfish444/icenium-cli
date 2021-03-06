import { AppBuilderLiveSyncProviderBase } from "../common/appbuilder/providers/appbuilder-livesync-provider-base";

export class LiveSyncProvider extends AppBuilderLiveSyncProviderBase {
	constructor($androidLiveSyncServiceLocator: { factory: Function },
		$iosLiveSyncServiceLocator: { factory: Function },
		private $buildService: Project.IBuildService,
		private $devicesService: Mobile.IDevicesService,
		private $options: IOptions) {
		super($androidLiveSyncServiceLocator, $iosLiveSyncServiceLocator);
	}

	public async buildForDevice(device: Mobile.IDevice): Promise<string> {
		return this.$devicesService.isiOSSimulator(device) ? this.$buildService.buildForiOSSimulator(this.$options.saveTo, device)
			: (await this.$buildService.buildForDeploy(this.$devicesService.platform, this.$options.saveTo, false, device)).packageName;
	}
}

$injector.register("liveSyncProvider", LiveSyncProvider);
