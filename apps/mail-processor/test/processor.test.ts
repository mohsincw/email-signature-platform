import { describe, it, expect, vi, beforeEach } from "vitest";
import { processMessage } from "../src/processor";
import * as apiClient from "../src/api-client";

vi.mock("../src/api-client");
vi.mock("../src/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockLookup = vi.mocked(apiClient.lookupSender);

const BASIC_EMAIL =
  "From: alice@example.com\r\n" +
  "To: bob@example.com\r\n" +
  "Subject: Test\r\n" +
  "Content-Type: text/html\r\n" +
  "\r\n" +
  "<html><body><p>Hello</p></body></html>";

const PLAIN_EMAIL =
  "From: alice@example.com\r\n" +
  "To: bob@example.com\r\n" +
  "Subject: Test\r\n" +
  "Content-Type: text/plain\r\n" +
  "\r\n" +
  "Hello world";

const ALREADY_SIGNED =
  "From: alice@example.com\r\n" +
  "To: bob@example.com\r\n" +
  "X-Org-Signature-Applied: true\r\n" +
  "Content-Type: text/html\r\n" +
  "\r\n" +
  "<html><body><p>Hello</p></body></html>";

function makeParsed(headers: Record<string, string>, html?: string, text?: string) {
  const headerMap = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return { headers: headerMap, html: html ?? false, text: text ?? "" } as any;
}

const mockSettings = {
  addressLine1: "90 Freemens Common Road",
  addressLine2: "Leicester \u2022 LE2 7SQ \u2022 England",
  website: "www.chaiiwala.co.uk",
  logoUrl: "https://cdn.example.com/chaiiwala-logo.png",
  badgeUrl: "https://cdn.example.com/5star-badge.png",
};

describe("processMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips if signature already applied", async () => {
    const parsed = makeParsed({ "x-org-signature-applied": "true" }, "<p>Hello</p>");
    const result = await processMessage(ALREADY_SIGNED, parsed, "alice@example.com");
    expect(result).toBe(ALREADY_SIGNED);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("relays unchanged if sender not found", async () => {
    mockLookup.mockResolvedValue(null);
    const parsed = makeParsed({}, "<p>Hello</p>");
    const result = await processMessage(BASIC_EMAIL, parsed, "unknown@example.com");
    expect(result).toBe(BASIC_EMAIL);
  });

  it("appends signature to HTML body with correct layout", async () => {
    mockLookup.mockResolvedValue({
      sender: {
        id: "1",
        email: "ben@chaiiwala.co.uk",
        name: "ben robinson",
        title: "Marketing Executive",
        phone: "+44 (0) 7398 840 817",
        phone2: null,
        enabled: true,
        imageKey: null,
        imageUrl: null,
        createdAt: "",
        updatedAt: "",
      },
      settings: mockSettings,
    });

    const parsed = makeParsed({}, "<html><body><p>Hello</p></body></html>");
    const result = await processMessage(BASIC_EMAIL, parsed, "ben@chaiiwala.co.uk");

    expect(result).toContain("ben robinson");
    expect(result).toContain("Marketing Executive");
    expect(result).toContain("+44 (0) 7398 840 817");
    expect(result).toContain("www.chaiiwala.co.uk");
    expect(result).toContain("X-Org-Signature-Applied: true");
  });

  it("appends plain text signature when no HTML body", async () => {
    mockLookup.mockResolvedValue({
      sender: {
        id: "1",
        email: "ben@chaiiwala.co.uk",
        name: "ben robinson",
        title: "Marketing Executive",
        phone: "+44 (0) 7398 840 817",
        phone2: null,
        enabled: true,
        imageKey: null,
        imageUrl: null,
        createdAt: "",
        updatedAt: "",
      },
      settings: mockSettings,
    });

    const parsed = makeParsed({}, undefined, "Hello world");
    const result = await processMessage(PLAIN_EMAIL, parsed, "ben@chaiiwala.co.uk");

    expect(result).toContain("ben robinson");
    expect(result).toContain("---");
    expect(result).toContain("+44 (0) 7398 840 817");
    expect(result).toContain("www.chaiiwala.co.uk");
  });
});
