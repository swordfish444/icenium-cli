build wp8
==========

Usage | Syntax
------|-------
General | `$ appbuilder build wp8 [--download] [--companion] [--save-to <File Path>] [--debug] [--release]`

Builds the project for the target platform and produces an application package or a QR code for deployment.

You can choose which files from your project to exclude or include in your application package by maintaining an .abignore file.
<% if(isHtml) { %>
For more information about .abignore, see [abignore.md](https://github.com/Icenium/icenium-cli/blob/release/ABIGNORE.md).
<% } %>

Options:
* `--debug` - If set, applies the Debug build configuration. <% if(isHtml) { %> For more information about build configurations, see [build configurations](http://docs.telerik.com/platform/appbuilder/build-configurations/overview).<% } %>
* `--release` - If set, applies the Release build configuration. <% if(isHtml) { %>For more information about build configurations, see [build configurations](http://docs.telerik.com/platform/appbuilder/build-configurations/overview).<% } %>
* `--download` - If set, downloads the application package to the root of the project, instead of producing a QR code. Set this option if you want to manually deploy the app package later. You cannot set both the `--companion` and `--download` switches. If you want to download the application package to a specified file path, use the `--save-to` option instead.
* `--companion` - Produces a QR code for deployment in the Telerik AppBuilder companion app. When deploying to the companion app, you do not need to set a certificate or provision.
* `--save-to` - If set, downloads the application package and saves it to the specified file path, instead of the project root. The file path must be complete with file name and extension. You do not need to set the `--download` switch.

When you build without the `--download` switch, the Telerik AppBuilder CLI lets you download and installthe Telerik Application Enrollment Token (AET) on your device via QR code. Always make sure that you have installed the Telerik AET on the device before attempting to scan the QR code for your Windows Phone app package. If the Telerik AET is not installed on the device, the following error message will appear when you attempt to install your app: "Before you install this app, you need to add Telerik AD company account".

When you build without the `--download` switch, you can deploy the app package on device only via QR code or by opening the link in the device browser. You cannot install the app package manually via cable connection.
<% if(isHtml) { %> 

#### Related Commands

Command | Description
----------|----------
[build](build.html) | Builds the project for the target platform and produces an application package or a QR code for deployment.
[build android](build-android.html) | Builds the project for Android platform and produces an application package or a QR code for deployment.
[build ios](build-ios.html) | Builds the project for iOS platform and produces an application package or a QR code for deployment.
[debug](debug.html) | Shows the debug tools to let you debug applications on connected devices.
[deploy](deploy.html) | Builds the project for the selected platform and deploys it to connected physical devices.
[deploy android](deploy-android.html) | Builds the project for android platform and deploys it to connected physical devices.
[deploy ios](deploy-ios.html) | Builds the project for ios platform and deploys it to connected physical devices.
[emulate](emulate.html) | Builds the specified project in the cloud and runs it in a native emulator.
[emulate android](emulate-android.html) | Builds the specified project in the cloud and runs it in a native Android emulator.
[emulate ios](emulate-ios.html) | Builds the specified project in the cloud and runs it in the native iOS Simulator.
[emulate wp8](emulate-wp8.html) | Builds the specified project in the cloud and runs it in the native emulator from the Windows Phone 8.
[livesync](livesync.html) | Synchronizes the latest changes in your project to connected devices.
[livesync android](livesync-android.html) | Synchronizes the latest changes in your project to connected Android devices.
[livesync ios](livesync-ios.html) | Synchronizes the latest changes in your project to connected iOS devices.
[livesync cloud](livesync-cloud.html) | Synchronizes the project with the cloud to enable LiveSync via wireless connection.
[remote](remote.html) | Starts a remote server to let you run your app in the iOS Simulator from a Windows system.
[simulate](simulate.html) | Runs the current project in the device simulator.
<% } %>