import * as path from "path";

export class DarwinDebuggerService implements IDebuggerService {
	constructor(private $devicesService: Mobile.IDevicesService,
		private $androidEmulatorServices: Mobile.IAndroidEmulatorServices,
		private $androidProcessService: Mobile.IAndroidProcessService,
		private $clipboardService: IClipboardService,
		private $opener: IOpener,
		private $errors: IErrors,
		private $logger: ILogger,
		private $prompter: IPrompter) { }

	public debugIosApplication(applicationId: string): void {
		let pathToDebuggingGuideHtml = path.join(__dirname, "..", "..", "..", "resources", "debugging", "ios-debug-guide.html");

		this.$opener.open(`${pathToDebuggingGuideHtml}`, "Safari");
	}

	public async debugAndroidApplication(applicationId: string, framework: string): Promise<void> {
		let deviceIdentifier: string;
		await this.$devicesService.detectCurrentlyAttachedDevices();
		let connectedDevices = this.$devicesService.getDevicesForPlatform("android");

		if (connectedDevices.length > 1) {
			let devicesNames: string[] = connectedDevices.map((device: Mobile.IDevice) => device.deviceInfo.displayName);
			let selectedDeviceName = await this.$prompter.promptForChoice("You have more than one Android devices connected to your computer. Please choose which one to use", devicesNames);

			deviceIdentifier = connectedDevices.filter((device: Mobile.IDevice) => device.deviceInfo.displayName === selectedDeviceName)[0].deviceInfo.identifier;
		} else if (connectedDevices.length === 1) {
			deviceIdentifier = connectedDevices[0].deviceInfo.identifier;
		} else {
			deviceIdentifier = await this.$androidEmulatorServices.startEmulator();
		}

		let applicationsAvailableForDebugging = await this.$androidProcessService.getDebuggableApps(deviceIdentifier);
		let applicationNotStartedErrorMessage = `Application with identifier ${applicationId} is not started on device ${deviceIdentifier}. Please open the application on the device to debug it.`;

		if (!_.find(applicationsAvailableForDebugging, app => app.appIdentifier === applicationId)) {
			this.$errors.failWithoutHelp(applicationNotStartedErrorMessage);
		}

		let tcpPort: string;

		try {
			tcpPort = await this.$androidProcessService.mapAbstractToTcpPort(deviceIdentifier, applicationId, framework);
		} catch (err) {
			this.$errors.failWithoutHelp("Your device has no open ports. Please close programs that are using device's ports to listen on them and try again.");
		}

		let inspectorAddress = `chrome://inspect:${tcpPort}`;
		await this.$clipboardService.copy(inspectorAddress);

		this.$logger.out(`Your application is available for debugging on port: ${tcpPort}.`);
		this.$logger.out(`Open Google Chrome and in the address bar enter ${inspectorAddress}. You can just paste it, it is already copied to your clipboard.`);
	}
}

$injector.register("darwinDebuggerService", DarwinDebuggerService);
