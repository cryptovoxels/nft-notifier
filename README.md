# App template

This is a node js app template for quickly setting up new microservices.

## production set up

First make sure you have [installed doctl](https://github.com/digitalocean/doctl#installing-doctl), to make sure you
have everything ready, run `doctl apps list` and expect to see CV apps, if that fails, follow the instructions to
create tokens or read the doctl to change token to a CV one. There has been one report of this still not working until
you give DigitalOcean access to your private repos as well.

Then click the green "Use this template" button in the GitHub interface to clone it into a new place.

Edit all the places in the `app.yaml` marked with a comment and remove any components you don't need, almost
every component incurs a cost, so please check.

Run `make check` to check the cost and validate the spec file.

Run `make create` to create the app

Then check the deployment of the app by taking the UUID from the above deployment and check for active deployment ID

```
$ doctl apps get a79c6c1d-a0f6-4f91-8de1-d249b4d4b2db
ID                                      Spec Name       Default Ingress    Active Deployment ID    In Progress Deployment ID               Created At                       Updated At
a79c6c1d-a0f6-4f91-8de1-d249b4d4b2db    app-template                                               7e369fe2-597d-4939-a140-d9f4bb196e43    2021-04-30 01:01:06 +0000 UTC    2021-04-30 01:03:49 +0000 UTC
```

... or use the [web ui](https://cloud.digitalocean.com/apps?i=c68060) to check progress

# Updating the app components

To add and/or update components PLEASE update the app.yaml and update the app via

```
doctl apps update <uuid> --spec app.yaml
```

The exception to this should be ENV variables that are secret, for example API tokens, they should be inserted via the
[web ui](https://cloud.digitalocean.com/apps?i=c68060).

## Components in app.yaml

This template has defined more or less all the basics required by a microservice.

### databases

An example of a small PostgreSQL database is included, delete if not needing a separate database.

### domains

sets up a `crvox.com` subdomain pointing to the www service, remember to change the name

### services

Services are servers listening on ports, typically web servers, the one included is called `web`. It has predefined ENV
variables that connects to the database components since it's a bit tricky to get that working,

### workers

A commented out example to set up a background worker that doesn't require an open port. It's recommended that a service
starts off with a background job running in the WWW service to begin with, a background worker instance is only needed
if there is a lot of processing needing to be done on a constant basis that would interrupt the WWW service availability.

## Local environment configuration

copy `.env.example` to `.env` and edit required information in `.env`

## run local dev

`npm run start`
