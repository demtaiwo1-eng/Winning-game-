import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { sendEventMessageSchema } from "../src/modules/events/messages.schemas";

const app = createApp();
const participant = "c12a950d-56eb-42ba-8eaa-3d28f777f731";

describe("event messages", () => {
  it("requires authentication for message routes", async () => {
    expect((await request(app).get(`/api/v1/events/${participant}/messages`)).status).toBe(401);
    expect((await request(app).post(`/api/v1/events/${participant}/messages`).send({ body: "Hello" })).status).toBe(401);
  });

  it("validates broadcast and individual-recipient messages", () => {
    expect(sendEventMessageSchema.parse({ body: " Hello ", recipientIds: [participant] })).toEqual({
      body: "Hello",
      broadcast: false,
      recipientIds: [participant],
    });
    expect(sendEventMessageSchema.parse({ body: "Hello", broadcast: true }).broadcast).toBe(true);
    expect(sendEventMessageSchema.safeParse({ body: "Hello" }).success).toBe(false);
    expect(sendEventMessageSchema.safeParse({ body: "Hello", broadcast: true, recipientIds: [participant] }).success).toBe(false);
    expect(sendEventMessageSchema.safeParse({ body: " ", recipientIds: [participant] }).success).toBe(false);
    expect(sendEventMessageSchema.safeParse({ body: "Hello", recipientIds: [participant, participant] }).success).toBe(false);
    expect(sendEventMessageSchema.parse({
      body: "Hello",
      toIds: [participant],
      ccIds: ["a2d7f6b9-5c7e-4d3a-8b1f-6c9e2a4d7f10"],
      bccIds: ["b3e8a7c1-6d2f-4e9a-8c5b-7f1d3a6e9b20"],
    }).toIds).toEqual([participant]);
    expect(sendEventMessageSchema.safeParse({
      body: "Hello",
      toIds: [participant],
      ccIds: [participant],
    }).success).toBe(false);
    expect(sendEventMessageSchema.safeParse({
      body: "Hello",
      toIds: [participant],
      broadcast: true,
    }).success).toBe(false);
    expect(sendEventMessageSchema.safeParse({
      body: "Hello",
      ccIds: ["a2d7f6b9-5c7e-4d3a-8b1f-6c9e2a4d7f10"],
    }).success).toBe(false);
  });
});
