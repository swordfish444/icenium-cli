add-about
==========

<span style="color:red;font-size:15px"><%= #{screenBuilderService.getDeprecationWarning} %> </span>

Usage | Synopsis
------|-------
General | `$ appbuilder add-about` [--answers <File Path>]

Inserts an about form in an existing application view. <% if(isHtml) { %>An interactive prompt guides you through the setup process.<% } %>
<% if(isConsole) { %>WARNING: This command is applicable only to Apache Cordova projects created with Screen Builder.<% } %>

### Options

* `--answers` - If set, the AppBuilder CLI looks for the specified `JSON` file and tries to pull the configuration data required by the command. If one or more required properties are not specified, the AppBuilder CLI will prompt you to provide the missing values.

### Attributes

* `<File Path>` is the absolute or relative file path to a `JSON` file which contains configuration information about your project.<% if(isHtml) { %> The file must comply with the JSON specification described in detail [here](http://docs.telerik.com/platform/appbuilder/creating-your-project/screen-builder-automation#add-about).<% } %>

<% if(isHtml) { %>
### Prerequisites

* The existing application view must be added with `$ appbuilder add-view` or must be the default `home` view.
* Verify that you have installed git on your system.

### Command Limitations

* You can run this command only on projects created with Screen Builder.
* You cannot use this command to modify projects created with earlier versions of the AppBuilder CLI. This behavior will be fixed in an upcoming release.

### Related Commands

Command | Description
----------|----------
[create screenbuilder](../project/creation/create-screenbuilder.html) | Creates a new project for hybrid development with Screen Builder.
[screenbuilder](screenbuilder.html) | Shows all commands for project development with Screen Builder.
[upgrade-screenbuilder](upgrade-screenbuilder.html) | Upgrades a project to the latest Screen Builder version.
[add-authentication](add-authentication.html) | Inserts sign-in and sign-up forms in an existing application view.
[add-dataprovider](add-dataprovider.html) | Connects your project to a data provider.
[add-field](add-field.html) | Inserts an input field in an existing form.
[add-form](add-form.html) | Inserts a generic input form in an existing application view.
[add-list](add-list.html) | Inserts a list in an existing application view.
[add-view](add-view.html) | Adds a new application view to your project.
<% } %>
