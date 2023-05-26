/*
	This function should load the configs in available workspaces, give ability to select project,
	download GraphQL schema and
*/

import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/browser";

import parseDotEnvContent from "./utils/parseDotEnvContent";
import readWorkspaceFileContents from "./utils/readWorkspaceFileContents";

export const loadGraphQLProjectConfigs =
  (client: LanguageClient) =>
  async (content: string): Promise<void> => {
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
            "graphql-lsp-web.config.experimental.json"
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

    const allProjectsFromAllWorkspaces = workspaces.reduce((acc, item) => {
      const projects = item?.experimentalProjectConfig?.projects ?? [];
      const workspaceEnvironmentVariables =
        item?.workspaceEnvironmentVariables ?? {};
      projects.map((project) => {
        // At this point we can also do some magic, replace the configs witht he workspaces env values we parsed before.
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

    const selectedProject = target.target;
    if (!selectedProject) {
      return;
    }

    const responseSchemaJSON = await fetch(selectedProject?.url, {
      headers: {
        accept: "*/*",
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        "content-type": "application/json",
        pragma: "no-cache",
        ...selectedProject?.headers,
      },
      body: '{"query":"\\n    query IntrospectionQuery {\\n      __schema {\\n        queryType { name }\\n        mutationType { name }\\n        subscriptionType { name }\\n        types {\\n          ...FullType\\n        }\\n        directives {\\n          name\\n          description\\n          locations\\n          args {\\n            ...InputValue\\n          }\\n        }\\n      }\\n    }\\n\\n    fragment FullType on __Type {\\n      kind\\n      name\\n      description\\n      fields(includeDeprecated: true) {\\n        name\\n        description\\n        args {\\n          ...InputValue\\n        }\\n        type {\\n          ...TypeRef\\n        }\\n        isDeprecated\\n        deprecationReason\\n      }\\n      inputFields {\\n        ...InputValue\\n      }\\n      interfaces {\\n        ...TypeRef\\n      }\\n      enumValues(includeDeprecated: true) {\\n        name\\n        description\\n        isDeprecated\\n        deprecationReason\\n      }\\n      possibleTypes {\\n        ...TypeRef\\n      }\\n    }\\n\\n    fragment InputValue on __InputValue {\\n      name\\n      description\\n      type { ...TypeRef }\\n      defaultValue\\n    }\\n\\n    fragment TypeRef on __Type {\\n      kind\\n      name\\n      ofType {\\n        kind\\n        name\\n        ofType {\\n          kind\\n          name\\n          ofType {\\n            kind\\n            name\\n            ofType {\\n              kind\\n              name\\n              ofType {\\n                kind\\n                name\\n                ofType {\\n                  kind\\n                  name\\n                  ofType {\\n                    kind\\n                    name\\n                  }\\n                }\\n              }\\n            }\\n          }\\n        }\\n      }\\n    }\\n  "}',
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
  };

export default loadGraphQLProjectConfigs;
