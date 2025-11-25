# TeraSpot API Reference

This document serves as the central entry point for the TeraSpot Backend API.

## Base URL

The API is deployed via AWS API Gateway.

- **Development Base URL**: `https://<api-id>.execute-api.us-east-1.amazonaws.com/dev`

> **Note:** You can find the exact `<api-id>` by running `terraform output` in the `infrastructure/terraform` directory.

## Authentication

- **Current Status**: `NONE` (Open)
- **Future Plan**: JWT Authentication via Amazon Cognito.

## Endpoints

### Configuration Management

| Method | Endpoint  | Description                                                              | Payload Documentation                                                              |
| :----- | :-------- | :----------------------------------------------------------------------- | :--------------------------------------------------------------------------------- |
| `POST` | `/config` | Handles all CRUD operations (SAVE, GET, LIST) for system configurations. | [See Config Saver README](../backend/lambdas/config_saver/README.md#api-reference) |

## Error Handling

The API generally returns standard HTTP status codes:

- `200 OK`: Request succeeded.
- `400 Bad Request`: Invalid payload or missing required fields.
- `500 Internal Server Error`: Unexpected server-side error.
