# Zadig

Search your Zadig workflow runs and environments, and manage sub-environments.

It ships two commands, **Search Workflows** and **Search Environments**, and works with any Zadig that serves the OpenAPI. You only need your Zadig domain and an API token.

## Features

- **Search Workflows**: pick a project and a workflow to browse its runs, with each run's status and who started it. The detail pane shows the commits built, the run's choice parameters and its stages. Retry a failed, cancelled or timed-out run, or cancel a running one.
- **Search Environments**: browse test and production environments, with each environment's status and the services deployed in it. In Helm projects, create a sub-environment from a base environment or add services to a test environment. Restart any service, or delete a test environment.

![Search Workflows with a run's commits and stages](metadata/search-workflows-1-runs.png)

## Install

1. Clone this repository.
2. In the `zadig` folder, run `npm install`.
3. Open Raycast, run **Import Extension**, and select the `zadig` folder.

## Sign in

1. In Zadig, open **Account Settings** and copy your API token.
2. In the extension's preferences, enter the token and the domain your company serves Zadig from, such as `zadig.example.com`. The extension always connects over HTTPS.

## Not supported

- Sleeping and waking environments, because the OpenAPI has no endpoint for them.
- Job logs, because Zadig returns credentials in cleartext in task data and build logs.
- Removing services, and creating environments or adding services outside Helm projects, because those OpenAPI endpoints are untested.
- Starting a new run, approvals and release plans.

Built on the Zadig v4.3 OpenAPI and tested against Zadig v4.14.
