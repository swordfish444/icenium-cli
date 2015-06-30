add-authentication
==========

Usage | Synopsis
------|-------
General | `$ appbuilder add-authentication`

Inserts sign-in and sign-up forms in an existing application view. You can connect the forms to a data provider added with `$ appbuilder add-dataprovider` <% if(isHtml) { %>An interactive prompt guides you through the setup process.<% } %>
<% if(isConsole) { %>WARNING: This command is applicable only to Apache Cordova projects created with Screen Builder.<% } %>
<% if(isHtml) { %>
### Prerequisites

* The existing application view must be added with `$ appbuilder add-view` or must be the default `home` view.
* You must have at least one data provider configured with `$ appbuilder add-dataprovider`
* Verify that you have installed git on your system.

### Command Limitations 

* You can run this command only on projects created with Screen Builder.

### Related Commands

Command | Description
----------|----------
[create screenbuilder](../project/creation/create-screenbuilder.html) | Creates a new project for hybrid development with Screen Builder.
[screenbuilder](screenbuilder.html) | Shows all commands for project development with Screen Builder.
[add-dataprovider](add-dataprovider.html) | Connects your project to a data provider.
[add-field](add-field.html) | Inserts an input field in an existing form.
[add-form](add-form.html) | Inserts a generic input form in an existing application view.
[add-about](add-about.html) | Inserts an about form in an existing application view.
[add-list](add-list.html) | Inserts a list in an existing application view.
[add-signin](add-signin.html) | Inserts a sign-in form in an existing application view.
[add-view](add-view.html) | Adds a new application view to your project.
<% } %>