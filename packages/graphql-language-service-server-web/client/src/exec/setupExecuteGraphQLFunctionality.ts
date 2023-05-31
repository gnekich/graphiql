/*
	This function sets the execute GraphQL functionality for the extension.
*/

import * as vscode from "vscode";

import { GraphQLContentProvider } from "./providers/exec-content";
import { GraphQLCodeLensProvider } from "./providers/exec-codelens";
import { ExtractedTemplateLiteral } from "./helpers/source";
import getConfig from "./getConfig";

export const setupExecuteGraphQLFunctionality =
  (context: vscode.ExtensionContext, projects, selectedProject) =>
  async (): Promise<void> => {
    const outputChannel: vscode.OutputChannel =
      vscode.window.createOutputChannel("GraphQL Operation Execution");

    const config = getConfig();
    const { debug } = config;

    if (debug) {
      console.log('Extension "vscode-graphql" is now active!');
    }

    const commandShowOutputChannel = vscode.commands.registerCommand(
      "vscode-graphql-execution.showOutputChannel",
      () => {
        outputChannel.show();
      }
    );
    context.subscriptions.push(commandShowOutputChannel);

    const settings = vscode.workspace.getConfiguration(
      "vscode-graphql-execution"
    );
    const registerCodeLens = () => {
      context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
          [
            "javascript",
            "typescript",
            "javascriptreact",
            "typescriptreact",
            "graphql",
          ],
          new GraphQLCodeLensProvider(outputChannel)
        )
      );
    };

    if (settings.showExecCodelens !== false) {
      registerCodeLens();
    }

    const commandContentProvider = vscode.commands.registerCommand(
      "vscode-graphql-execution.contentProvider",
      async (literal: ExtractedTemplateLiteral) => {
        const uri = vscode.Uri.parse("graphql://authority/graphql");

        const panel = vscode.window.createWebviewPanel(
          "vscode-graphql-execution.results-preview",
          "GraphQL Execution Result",
          vscode.ViewColumn.Two,
          {}
        );

        console.log("literal", literal);

        const contentProvider = new GraphQLContentProvider(
          uri,
          outputChannel,
          literal,
          panel,
          selectedProject
        );

        const registration =
          vscode.workspace.registerTextDocumentContentProvider(
            "graphql",
            contentProvider
          );
        context.subscriptions.push(registration);

        const html = await contentProvider.getCurrentHtml();
        panel.webview.html = html;
      }
    );

    context.subscriptions.push(commandContentProvider);
  };

export default setupExecuteGraphQLFunctionality;
