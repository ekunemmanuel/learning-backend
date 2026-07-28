import { testClient } from "hono/testing";
import { execSync } from "node:child_process";
import fs from "node:fs";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from "vitest";
import { ZodIssueCode } from "zod";

import env from "@/env";
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from "@/lib/constants";
import { createTestApp } from "@/lib/create-app";
import { prisma } from "@/lib/prisma";

import router from ".";

if (env.NODE_ENV !== "test") {
  throw new Error("NODE_ENV must be 'test'");
}

const client = testClient(createTestApp(router));

describe("examples routes", () => {
  beforeAll(async () => {
    execSync("bunx prisma db push");
    await prisma.example.deleteMany();
  });

  afterAll(async () => {
    // Database cleanup happens in beforeAll for Postgres
  });

  it("post /examples validates the body when creating", async () => {
    const response = await client.examples.$post({
      json: {
        done: false,
      } as any,
    });
    expect(response.status).toBe(422);
    if (response.status === 422) {
      const json = await response.json();
      expect(json.errors![0].message).toContain(ZOD_ERROR_MESSAGES.EXPECTED_STRING);
    }
  });

  let id = 1;
  const name = "Learn vitest";

  it("post /examples creates a example", async () => {
    const response = await client.examples.$post({
      json: {
        name,
        done: false,
      },
    });
    expect(response.status).toBe(200);
    if (response.status === 200) {
      const json = await response.json();
      expect(json.name).toBe(name);
      expect(json.done).toBe(false);
      id = json.id;
    }
  });

  it("get /examples lists all examples", async () => {
    const response = await client.examples.$get();
    expect(response.status).toBe(200);
    if (response.status === 200) {
      const json = await response.json();
      expectTypeOf(json).toBeArray();
      expect(json.length).toBe(1);
    }
  });

  it("get /examples/{id} validates the id param", async () => {
    const response = await client.examples[":id"].$get({
      param: {
        id: "wat",
      },
    });
    expect(response.status).toBe(422);
    if (response.status === 422) {
      const json = await response.json();
      expect(json.errors![0].message).toContain(ZOD_ERROR_MESSAGES.EXPECTED_NUMBER);
    }
  });

  it("get /examples/{id} returns 404 when example not found", async () => {
    const response = await client.examples[":id"].$get({
      param: {
        id: 999,
      },
    });
    expect(response.status).toBe(404);
    if (response.status === 404) {
      const json = await response.json();
      expect(json.message).toBe(HttpStatusPhrases.NOT_FOUND);
    }
  });

  it("get /examples/{id} gets a single example", async () => {
    const response = await client.examples[":id"].$get({
      param: {
        id,
      },
    });
    expect(response.status).toBe(200);
    if (response.status === 200) {
      const json = await response.json();
      expect(json.name).toBe(name);
      expect(json.done).toBe(false);
    }
  });

  it("patch /examples/{id} validates the body when updating", async () => {
    const response = await client.examples[":id"].$patch({
      param: {
        id,
      },
      json: {
        name: "",
      },
    });
    expect(response.status).toBe(422);
    if (response.status === 422) {
      const json = await response.json();
      expect(json.errors![0].message).toContain("Too small");
    }
  });

  it("patch /examples/{id} validates the id param", async () => {
    const response = await client.examples[":id"].$patch({
      param: {
        id: "wat",
      },
      json: {},
    });
    expect(response.status).toBe(422);
    if (response.status === 422) {
      const json = await response.json();
      expect(json.errors![0].message).toContain(ZOD_ERROR_MESSAGES.EXPECTED_NUMBER);
    }
  });

  it("patch /examples/{id} validates empty body", async () => {
    const response = await client.examples[":id"].$patch({
      param: {
        id,
      },
      json: {},
    });
    expect(response.status).toBe(422);
    if (response.status === 422) {
      const json = await response.json();
      expect(json.message).toBe("No updates provided");
    }
  });

  it("patch /examples/{id} updates a single property of a example", async () => {
    const response = await client.examples[":id"].$patch({
      param: {
        id,
      },
      json: {
        done: true,
      },
    });
    expect(response.status).toBe(200);
    if (response.status === 200) {
      const json = await response.json();
      expect(json.done).toBe(true);
    }
  });

  it("delete /examples/{id} validates the id when deleting", async () => {
    const response = await client.examples[":id"].$delete({
      param: {
        id: "wat",
      },
    });
    expect(response.status).toBe(422);
    if (response.status === 422) {
      const json = await response.json();
      expect(json.errors![0].message).toContain(ZOD_ERROR_MESSAGES.EXPECTED_NUMBER);
    }
  });

  it("delete /examples/{id} removes a example", async () => {
    const response = await client.examples[":id"].$delete({
      param: {
        id,
      },
    });
    expect(response.status).toBe(204);
  });
});
