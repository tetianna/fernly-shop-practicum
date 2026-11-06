import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import type { APIRequestContext } from '@playwright/test';

export interface OpenApiValidator {
  /** Validate JSON against a component schema name from `/openapi.json` (e.g. `Plant`, `PlantSummary`). */
  expect: (schemaName: string, data: unknown) => void;
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors?.length) return 'unknown validation error';
  return errors.map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
}

let cached: Promise<OpenApiValidator> | null = null;

const OPENAPI_ROOT_ID = 'urn:fernly:openapi';

/**
 * Loads `/openapi.json` from the API `baseURL` once per process and builds an Ajv validator
 * for `#/components/schemas/<name>` entries (P2P-style contract check).
 */
export function getOpenApiValidator(request: APIRequestContext): Promise<OpenApiValidator> {
  if (!cached) {
    cached = (async () => {
      const res = await request.get('/openapi.json');
      if (!res.ok()) {
        throw new Error(`Failed to load OpenAPI: ${res.status()} ${await res.text()}`);
      }
      const doc = await res.json();
      if (!doc || typeof doc !== 'object' || !('components' in doc)) {
        throw new Error('OpenAPI document missing components');
      }

      const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
      addFormats(ajv);

      ajv.addSchema(doc, OPENAPI_ROOT_ID);

      return {
        expect(schemaName: string, data: unknown) {
          const validate = ajv.getSchema(`${OPENAPI_ROOT_ID}#/components/schemas/${schemaName}`);
          if (!validate) {
            throw new Error(`Unknown OpenAPI component schema: ${schemaName}`);
          }
          const ok = validate(data);
          if (!ok) {
            throw new Error(`Schema ${schemaName} validation failed: ${formatAjvErrors(validate.errors)}`);
          }
        },
      };
    })();
  }
  return cached;
}
