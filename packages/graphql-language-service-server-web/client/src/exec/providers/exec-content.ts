import * as vscode from "vscode";
import {
  workspace,
  OutputChannel,
  TextDocumentContentProvider,
  EventEmitter,
  Uri,
  Event,
  ProviderResult,
  window,
  WebviewPanel,
  WorkspaceFolder,
} from "vscode";
import { visit, VariableDefinitionNode } from "graphql";

import type { ExtractedTemplateLiteral } from "../helpers/source";
import { NetworkHelper } from "../helpers/network";
import { SourceHelper, GraphQLScalarTSType } from "../helpers/source";

export type UserVariables = { [key: string]: GraphQLScalarTSType };

// TODO: remove residue of previewHtml API https://github.com/microsoft/vscode/issues/62630
// We update the panel directly now in place of a event based update API (we might make a custom event updater and remove panel dep though)
export class GraphQLContentProvider implements TextDocumentContentProvider {
  private uri: Uri;
  private outputChannel: OutputChannel;
  private networkHelper: NetworkHelper;
  private sourceHelper: SourceHelper;
  private panel: WebviewPanel;
  private rootDir: WorkspaceFolder | undefined;
  private literal: ExtractedTemplateLiteral;

  // Event emitter which invokes document updates
  private _onDidChange = new EventEmitter<Uri>();

  private html = ""; // HTML document buffer

  // eslint-disable-next-line no-undef
  timeout = (ms: number) => new Promise((res) => setTimeout(res, ms));

  getCurrentHtml(): Promise<string> {
    return new Promise((resolve) => {
      resolve(this.html);
    });
  }

  updatePanel() {
    this.panel.webview.html = this.html;
  }

  async getVariablesFromUser(
    variableDefinitionNodes: VariableDefinitionNode[]
  ): Promise<UserVariables> {
    await this.timeout(500);
    let variables = {};
    for await (const node of variableDefinitionNodes) {
      const variableType =
        this.sourceHelper.getTypeForVariableDefinitionNode(node);
      variables = {
        ...variables,
        [`${node.variable.name.value}`]: this.sourceHelper.typeCast(
          (await window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: `Please enter the value for ${node.variable.name.value}`,
            validateInput: async (value: string) =>
              this.sourceHelper.validate(value, variableType),
          })) as string,
          variableType
        ),
      };
    }
    return variables;
  }

  async getEndpointName(endpointNames: string[]) {
    // Endpoints extensions docs say that at least "default" will be there
    let [endpointName] = endpointNames;
    if (endpointNames.length > 1) {
      const pickedValue = await window.showQuickPick(endpointNames, {
        canPickMany: false,
        ignoreFocusOut: true,
        placeHolder: "Select an endpoint",
      });

      if (pickedValue) {
        endpointName = pickedValue;
      }
    }
    return endpointName;
  }

  constructor(
    uri: Uri,
    outputChannel: OutputChannel,
    literal: ExtractedTemplateLiteral,
    panel: WebviewPanel,
    selectedProject: any
  ) {
    this.uri = uri;
    this.outputChannel = outputChannel;
    this.sourceHelper = new SourceHelper(this.outputChannel);
    this.networkHelper = new NetworkHelper(
      this.outputChannel,
      this.sourceHelper
    );
    this.panel = panel;
    this.rootDir = workspace.getWorkspaceFolder(Uri.file(literal.uri));
    this.literal = literal;
    this.panel.webview.options = {
      enableScripts: true,
    };

    // -- can't use async in constructor
    // eslint-disable-next-line
    this.loadProvider(selectedProject).catch((error) => {
      this.html = error.toString();
    });
  }

  validUrlFromSchema(pathOrUrl: string) {
    return /^https?:\/\//.test(pathOrUrl);
  }

  reportError(message: string) {
    this.outputChannel.appendLine(message);
    this.setContentAndUpdate(message);
  }

  setContentAndUpdate(html: string) {
    this.html = html;
    this.update(this.uri);
    this.updatePanel();
  }

  async loadProvider(selectedProject) {
    try {
      const endpoint = {
        ...selectedProject,
      };
      if (endpoint?.url) {
        const variableDefinitionNodes: VariableDefinitionNode[] = [];
        visit(this.literal.ast, {
          VariableDefinition(node: VariableDefinitionNode) {
            variableDefinitionNodes.push(node);
          },
        });

        const updateCallback = (_data: string, operation: string) => {
          let data = _data;
          try {
            data = JSON.stringify(JSON.parse(_data), null, 2);
            // eslint-disable-next-line no-empty
          } catch (error) {}
          console.log("CALLBACK", data);
          if (operation === "subscription") {
            this.html =
              `--- (GraphQL Subscription - New event: ${new Date().toISOString()}) ---` +
              `<pre style="width: 100%">${data}</pre>` +
              this.html;
          } else if (operation === "mutation") {
            this.html +=
              `--- (GraphQL Mutation - ${new Date().toISOString()}) ---` +
              `<pre style="width: 100%">${data}</pre>`;
          } else {
            this.html +=
              `--- (GraphQL Query - ${new Date().toISOString()}) ---` +
              `<pre style="width: 100%">${data}</pre>`;
          }
          this.update(this.uri);
          this.updatePanel();
        };

        if (variableDefinitionNodes.length > 0) {
          const variables = await this.getVariablesFromUser(
            variableDefinitionNodes
          );

          console.log({
            endpoint,
            literal: this.literal,
            variables,
            updateCallback,
            // projectConfig,
          });

          await this.networkHelper.executeOperation({
            endpoint,
            literal: this.literal,
            variables,
            updateCallback,
            // projectConfig,
          });

          // const responseExecuteGraphQL = await fetch(endpoint?.url, {
          //   headers: {
          //     accept: "*/*",
          //     "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
          //     "cache-control": "no-cache",
          //     "content-type": "application/json",
          //     pragma: "no-cache",
          //     ...selectedProject?.headers,
          //   },
          //   body: JSON.stringify({
          //     query: this.literal.content,
          //     variables,
          //   }),
          //   method: "POST",
          //   mode: "cors",
          //   credentials: "omit",
          // })
          //   .then((response) => {
          //     return response.text();
          //   })
          //   .then((fullGraphqlResponseAsText) => {
          //     return fullGraphqlResponseAsText;
          //   })
          //   .catch((error) => {
          //     console.log("Error downloading schema", error);

          //     vscode.window.showInformationMessage(
          //       `Error downloading schema ${error.toString(true)}`
          //     );
          //     return undefined;
          //   });
          // updateCallback(responseExecuteGraphQL, "query");
        } else {
          console.log({
            endpoint,
            literal: this.literal,
            variables: {},
            updateCallback,
            // projectConfig,
          });
          await this.networkHelper.executeOperation({
            endpoint,
            literal: this.literal,
            variables: {},
            updateCallback,
            // projectConfig,
          });

          // const responseExecuteGraphQL = await fetch(endpoint?.url, {
          //   headers: {
          //     accept: "*/*",
          //     "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
          //     "cache-control": "no-cache",
          //     "content-type": "application/json",
          //     pragma: "no-cache",
          //     ...selectedProject?.headers,
          //   },
          //   body: JSON.stringify({
          //     query: this.literal.content,
          //     variables: {},
          //   }),
          //   method: "POST",
          //   mode: "cors",
          //   credentials: "omit",
          // })
          //   .then((response) => {
          //     return response.text();
          //   })
          //   .then((fullGraphqlResponseAsText) => {
          //     return fullGraphqlResponseAsText;
          //   })
          //   .catch((error) => {
          //     console.log("Error downloading schema", error);

          //     vscode.window.showInformationMessage(
          //       `Error downloading schema ${error.toString(true)}`
          //     );
          //     return undefined;
          //   });
          // updateCallback(responseExecuteGraphQL, "query");
        }
      } else {
        this.reportError(`Error: no endpoint url provided`);
        return;
      }
    } catch (err: unknown) {
      this.reportError(`Error: graphql operation failed\n ${err?.toString()}`);
      return;
    }
  }

  get onDidChange(): Event<Uri> {
    return this._onDidChange.event;
  }

  public update(uri: Uri) {
    this._onDidChange.fire(uri);
  }

  provideTextDocumentContent(_: Uri): ProviderResult<string> {
    return this.html;
  }

  public dispose() {
    console.log("Content provider for webview disposed...");
    this.networkHelper?.dispose();
  }
}
