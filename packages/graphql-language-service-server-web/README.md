# GraphQL LSP for Web (vscode.dev)

It is based on LSP web extension Example from Microsoft and graphiql/graphql-language-service-server
It combines multiple super useful packages by the GraphQL Foundation and ports them to the vscode web.

## Mission

- Create GraphQL LSP Server that can be transpiled for webworker
- Create package that gives multiple useful features at once, LSP, Syntax Highlighting, Autocomplete, Error checking, Query Execution and Subscription
- Compatible with Hlambda.io web console (Working in a browser, vscode.web)

# Features

- GraphQL syntax highlighting
- GraphQL LSP server compatible with Web IDE
- GraphQL Query/Mutation/Subscription Exec compatible with Web IDE

## Running

Create new file `graphql.config.experimental.json` in root of 1 of your vscode workspaces.

!This is not the same configuration as graphql.config from `graphql-config`

```
{
    "projects": [
        {
            "name": "Hasura API Multi Tenant Admin Dashboard",
            "default": true,
            "url": "{{ADMIN_DASHBOARD_GRAPHQL_API_INTROSPECTION_URL}}",
            "headers": {
                "x-hasura-admin-secret": "{{ADMIN_DASHBOARD_GRAPHQL_API_INTROSPECTION_HASURA_ADMIN_SECRET}}",
                "Authorization": "Bearer ey..."
            }
        }
    ]
}
```

Create new file `.env` if it does not exist in root of the workspace containing `graphql.config.experimental.json`, add values that will be replaced in `graphql.config.experimental.json`

Example:

```
ADMIN_DASHBOARD_GRAPHQL_API_INTROSPECTION_URL="https://localhost:8080/v1/graphql"
ADMIN_DASHBOARD_GRAPHQL_API_INTROSPECTION_HASURA_ADMIN_SECRET="my-local-development-password"
```

Add or remove headers based on your API type, you can use custom headers.
This way you can test your API as a different role, just create multiple projects with different headers.

# Issues

- You can have issue with the CORS or invalid TLS certificates, because this extension is built to be run for in web version of IDE it has to respect browser security standards thus we can't establish connections to remote that does not support CORS or has invalid security cert.

We suggest two approaches;

- one is use of offline schema, you can commit the offline schema and set up graphql project to use that instead of pulling it from remote server. (Pros: no request to server, Cons: out of sync with the latest server schema, no ability to exec query/mutation/subscription from vscode)

- second you can use development proxy server that will ignore CORS or Invalid security certs.

### Development

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`
- In the [Extension Development Host] instance of VSCode, open a document in 'plain text' language mode.
  - Type #00ff00 or any other color in hex format
  - color decorators will appear

### Compile

You can compile it with:

```
npm run compile
```

### Test in chrome

You can test it in browser using vscode-test-web

```
npm run chrome
```

---

# LSP web extension Example

A LSP server that runs in a web extension

## Functionality

This Language Server add color decorators to plain text files.

- create a plain text file
- enter text that contains colors in hex format (#rrggbb)
- color decorators

It also includes an End-to-End test.

## Structure

```
.
├── client // Language Client
│   ├── src
│   │   └── browserClientMain.ts // Language Client entry point
├── package.json // The extension manifest.
└── server // Language Server
    └── src
        └── browserServerMain.ts // Language Server entry point
```

## Running the Sample

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`
- In the [Extension Development Host] instance of VSCode, open a document in 'plain text' language mode.
  - Type #00ff00 or any other color in hex format
  - color decorators will appear
