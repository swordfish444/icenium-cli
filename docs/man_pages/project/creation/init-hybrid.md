init hybrid
==========

Usage | Synopsis
------|-------
General | `$ appbuilder init hybrid [--appid <App ID>]`

Initializes an existing Apache Cordova project for development in the current directory. <% if(isHtml) { %>If the directory contains an existing AppBuilder project (created with the Telerik AppBuilder extension for Visual Studio, synchronized from GitHub or exported from the cloud), the project retains any existing project configuration. In this case, you might want to manually set new unique values for the WP8ProductID and WP8PublisherID properties to avoid issues when running your app on device.

If the directory contains an existing Ionic project, you will be prompted to create a backup so that you can restore your work. The project retains its plugins, name and app ID, if not specified otherwise. The AppBuilder CLI configures the remaining project properties and provides the missing application icons and splash screens. You might want to manually set new unique values for your project properties and to update the application assets.

For more information about how to configure your project properties, see [appbuilder prop](../configuration/prop.html)<% } %>

### Options
* `--appid` - Sets the application identifier for your app.

### Attributes
* `<App ID>` must consist of one or more alphanumeric strings, separated by a dot. The strings must be valid uniform type identifiers (UTIs), containing letters, numbers, hyphens, underscores or periods. The application identifier corresponds to the Bundle ID for iOS apps and to the package identifier for Android apps. If not specified, the application identifier is set to `com.telerik.<current directory name>`.
<% if(isHtml) { %>
This operation creates one or more of the following AppBuilder-specific files, if missing:
* .abproject
* .debug.abproject
* .release.abproject
* .abignore

### Related Commands

Command | Description
----------|----------
[cloud](cloud.html) | Lists all solutions and projects associated with your Telerik Platform account.
[cloud export](cloud-export.html) | Exports one or all projects from a selected solution from the cloud.
[create](create.html) | Creates a project for hybrid or native development.
[create hybrid](create-hybrid.html) | Creates a new project from an Apache Cordova-based template.
[create native](create-native.html) | Creates a new project from a NativeScript-based template.
[create screenbuilder](create-screenbuilder.html) | Creates a new project for hybrid development with Screen Builder.
[init](init.html) | Initializes an existing project for development.
[init native](init-native.html) | Initializes an existing NativeScript project for development in the current directory.
[sample](sample.html) | Lists all available sample apps with name, description, GitHub repository, and clone command.
[sample native](sample-native.html) | Lists all available NativeScript sample apps.
[sample hybrid](sample-hybrid.html) | Lists all available Apache Cordova sample apps.
[sample clone](sample-clone.html) | Clones the selected sample app from GitHub to your local file system.
<% } %>
