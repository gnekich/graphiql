/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { ExtensionContext, Uri } from "vscode";
import { LanguageClientOptions } from "vscode-languageclient";

import { LanguageClient } from "vscode-languageclient/browser";

import loadGraphQLProjectConfigs from "./loadGraphQLProjectConfigs";

// this method is called when vs code is activated
export async function activate(context: ExtensionContext) {
  console.log("graphql-language-service-server-web activated!");

  /*
   * all except the code to create the language client in not browser specific
   * and could be shared with a regular (Node) extension
   */
  const documentSelector = [
    // { language: "plaintext" }, // Should we try to figure out the graphql like text in plaintext ? What about markdown ?
    // { language: "markdown" }, // Look the question above :)
    { language: "javascript" },
    { language: "graphql" },
    { language: "typescript" },
  ];

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {},
    initializationOptions: {},
  };

  const client = createWorkerLanguageClient(context, clientOptions);

  const disposable = client.start();
  context.subscriptions.push(disposable);

  client.onReady().then(() => {
    console.log("graphql-language-service-server-web server is ready");
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "graphql-lsp-set-intelisense-project.provide-api-url",
      async () => {
        await loadGraphQLProjectConfigs(context, client)("");
      }
    )
  );

  // Try to load configs without any user interaction. (In cases where you have 1 workspace and 1 project, or at least 1 default project and schema is downloaded)
  await loadGraphQLProjectConfigs(context, client)("");
}

function createWorkerLanguageClient(
  context: ExtensionContext,
  clientOptions: LanguageClientOptions
) {
  // Create a worker. The worker main file implements the language server.
  const serverMain = Uri.joinPath(
    context.extensionUri,
    "server/dist/browserServerMain.js"
  );
  const worker = new Worker(serverMain.toString(true));

  // create the language server client to communicate with the server running in the worker
  return new LanguageClient(
    "graphql-language-service-server-web",
    "GraphQL LSP Web Extension",
    clientOptions,
    worker
  );
}
