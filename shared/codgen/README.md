# Contract codegen
shared/contracts/**/*.schema.json -> TS types (client) + Pydantic models (server).
Planned tooling: json-schema-to-typescript + datamodel-code-generator, wired as
a build step. Hand-written payload types are a CI failure.
