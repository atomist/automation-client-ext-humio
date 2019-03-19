# @atomist/automation-client-ext-humio

[![atomist sdm goals](https://badge.atomist.com/T29E48P34/atomist/automation-client-ext-humio/88145d69-e4ac-4517-8ccd-faf3d1f46f6a)](https://app.atomist.com/workspace/T29E48P34)
[![npm version](https://img.shields.io/npm/v/@atomist/automation-client-ext-humio.svg)](https://www.npmjs.com/package/@atomist/automation-client-ext-humio)

An extension to an Atomist automation-client to send logs to Humio.

## Usage

1. First install the dependency in your automation-client project

```
$ npm install @atomist/automation-client-ext-humio
```

2. Install the support in your `index.ts`

```
import { configureHumio } from "@atomist/automation-client-ext-humio";

export const configuration: Configuration = {
    postProcessors: [
            configureHumio,
    ],
}
```

3. Add configuration to your client configuration

```
  "humio": {
    "enabled": true,
    "token": "<your ingester token>",
    "repository": "<name of the humio repository>",
  }
```

## Support

General support questions should be discussed in the `#support`
channel in the [Atomist community Slack workspace][slack].

If you find a problem, please create an [issue][].

[issue]: https://github.com/atomist/automation-client-ext-humio/issues

## Development

You will need to install [Node.js][node] to build and test this
project.

[node]: https://nodejs.org/ (Node.js)

### Build and test

Install dependencies.

```
$ npm install
```

Use the `build` package script to compile, test, lint, and build the
documentation.

```
$ npm run build
```

### Release

Releases are handled via the [Atomist SDM][atomist-sdm].  Just press
the 'Approve' button in the Atomist dashboard or Slack.

[atomist-sdm]: https://github.com/atomist/atomist-sdm (Atomist Software Delivery Machine)

---

Created by [Atomist][atomist].
Need Help?  [Join our Slack team][slack].

[atomist]: https://atomist.com/ (Atomist - How Teams Deliver Software)
[slack]: https://join.atomist.com/ (Atomist Community Slack)
