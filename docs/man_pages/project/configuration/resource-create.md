resource create
==========

Usage | Synopsis
------|-------
General | `$ appbuilder resource create [--icon <File Path>] [--splash <File Path>] [--force]`

Creates image resources for all mobile platforms from a single high-resolution image and saves them to the `App_Resources` folder of the current project. The image source must be a `PNG` image.

<% if(isConsole && isMobileWebsite) { %>
WARNING: This command is not applicable to mobile website projects. To view the complete help for this command, run `$ appbuilder help resource create`
<% } %>
<% if((isConsole && (isCordova || isNativeScript)) || isHtml) { %>
<% if(isHtml) { %> 
### Prerequisites

* Verify that the image source for your icons is an at least **1024x1024** pixels `PNG` image.
* Verify that the image source for your splash screens is an at least **2048x2048** pixels `PNG` image. Any logos should be centered.
<% } %>

### Options
* `--icon` - Creates all required icons for all mobile platforms from a single high-resolution image. The source image must be at least a **1024x1024** pixels `PNG` image.
* `--splash` - Creates all required splash screens from a single high-resolution image. The source image must be an at least **2048x2048** pixels `PNG` image. If you are using a logo, the logo must be located in the center of the image.
* `--force` - If set, replaces any conflicting existing images without prompting you to confirm the operation.

### Attributes
`<File Path>` is the complete file path to the high-resolution image that you want to use.
<% } %>
<% if(isHtml) { %> 

### Command Limitations

* You cannot run this command on mobile website projects.

### Related Commands

Command | Description
----------|----------
[edit-configuration](edit-configuration.html) | `<ConfigurationFile>` is the configuration file that you want to open.
[mobileframework](mobileframework.html) | Lists all supported versions of the current development framework.
[mobileframework set](mobileframework-set.html) | Sets the selected development framework version for the project.
[prop](prop.html) | Lets you manage the properties for your project.
[prop print](prop-print.html) | Prints information about the configuration of the project or the selected property.
[prop add](prop-add.html) | Enables more options for the selected project property, if the property accepts multiple values.
[prop remove](prop-remove.html) | Disables options for the selected project property, if the property accepts multiple values.
[prop set](prop-set.html) | Sets the selected project property and overwrites its current value.
[resource](resource.html) | Lists information about the image resources for all mobile platforms.
[webview](webview.html) | Lists the available web views for iOS and Android.
[webview set](webview-set.html) | Sets the selected web view for the current project.
<% } %>