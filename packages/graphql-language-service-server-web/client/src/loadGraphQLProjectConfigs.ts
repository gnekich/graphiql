/*
	This function should load the configs in available workspaces, give ability to select project,
	download GraphQL schema and
*/

import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/browser";

import parseDotEnvContent from "./utils/parseDotEnvContent";
import readWorkspaceFileContents from "./utils/readWorkspaceFileContents";
import introspectionQueryString from "./utils/introspectionQueryString";

export const loadGraphQLProjectConfigs =
  (context: vscode.ExtensionContext, client: LanguageClient) =>
  async (
    content: string
  ): Promise<{ allProjectsFromAllWorkspaces: any; selectedProject: any }> => {
    // First thing we can do is to try to load the .env file and graphql.config file to parse projects in workspace

    // Go through every workspace folder.
    const workspaces = await Promise.all(
      vscode.workspace.workspaceFolders.map(async (workspace) => {
        // const message = `Found workspace ${workspace.uri.toString()}`;
        // vscode.window.showInformationMessage(message);

        const dotEnvFileText = await readWorkspaceFileContents(
          workspace,
          ".env"
        );

        const workspaceEnvironmentVariables = {
          ...parseDotEnvContent(dotEnvFileText),
        };

        const experimentalProjectConfigContent =
          await readWorkspaceFileContents(
            workspace,
            "graphql.config.experimental.json"
          );

        let experimentalProjectConfig = { projects: [] };
        try {
          experimentalProjectConfig = JSON.parse(
            experimentalProjectConfigContent
          );

          // For every key in env variables, we want to replace placeholders in string types of the object.
        } catch (error) {
          console.log(error);
        }

        return {
          workspace,
          workspaceEnvironmentVariables,
          experimentalProjectConfig,
        };
      })
    );

    // Fill the project object with the env variable values.
    const allProjectsFromAllWorkspaces = workspaces.reduce((acc, item) => {
      const projects = item?.experimentalProjectConfig?.projects ?? [];
      const workspaceEnvironmentVariables =
        item?.workspaceEnvironmentVariables ?? {};
      projects.map((project) => {
        // At this point we can also do some magic, replace the configs with the workspaces env values we parsed before.
        // WARNING BLACK MAGIC
        const projectWithEnvValues = JSON.parse(
          JSON.stringify(project, (key, value) => {
            let newValue = value;
            for (const [keyEnv, valueEnv] of Object.entries(
              workspaceEnvironmentVariables
            )) {
              if (typeof value === "string") {
                newValue = newValue.replace(`{{${keyEnv}}}`, valueEnv);
              }
            }
            return newValue;
          })
        );
        // Black magic ended, you survived ;)
        acc.push({
          ...projectWithEnvValues,
        });
      });
      return acc;
    }, []);

    // --------------------------------------------------------------------------------

    // Be smart, first check if there is only one project or at least 1 default project
    let target = { target: undefined };
    const findFirstDefaultProject = allProjectsFromAllWorkspaces.find(
      (o) => o?.default === true
    );
    if (allProjectsFromAllWorkspaces.length === 1) {
      target.target = allProjectsFromAllWorkspaces[0];
    } else if (findFirstDefaultProject) {
      target.target = findFirstDefaultProject;
    } else {
      // Select from workspaces if multiple...
      target = await vscode.window.showQuickPick(
        allProjectsFromAllWorkspaces.map((item, index) => {
          return {
            label: `Project: ${item?.name}`,
            description: `${item?.url}`,
            target: item,
          };
        })
      );
    }

    const selectedProject = target?.target;
    if (!selectedProject) {
      return;
    }

    // TODO: add support for offline schema.

    const responseSchemaJSON = await fetch(selectedProject?.url, {
      headers: {
        accept: "*/*",
        "cache-control": "no-cache",
        "content-type": "application/json",
        pragma: "no-cache",
        ...selectedProject?.headers,
      },
      body: introspectionQueryString,
      method: "POST",
      mode: "cors",
      credentials: "omit",
    })
      .then((response) => {
        return response.json(); // Pare json response
      })
      .then((fullGraphqlResponseJson) => {
        return fullGraphqlResponseJson.data; // Extract only data
      })
      .catch((error) => {
        console.log("Error downloading schema", error);

        vscode.window.showInformationMessage(
          `Error downloading schema ${error.toString(true)}`
        );
        return undefined;
      });

    if (!responseSchemaJSON) {
      return;
    }

    console.log("Schema downloaded", responseSchemaJSON);
    vscode.window.showInformationMessage(
      `Schema downloaded for project ${selectedProject?.name}`
    );

    // Send to the server new schema in JSON representation (from API)
    client.sendRequest("$customGraphQL/Schema", {
      responseSchemaJSON,
      project: selectedProject,
    });

    // Return back the selected projects and projects.
    return { allProjectsFromAllWorkspaces, selectedProject };
  };

export default loadGraphQLProjectConfigs;
