import { describe, it, expect } from "vitest";
import { renderSignatureHtml, renderSignaturePlain } from "../src/index";

describe("renderSignatureHtml", () => {
  it("renders full signature with all fields", () => {
    const html = renderSignatureHtml({
      senderName: "ben robinson",
      senderTitle: "Marketing Executive",
      senderPhone: "+44 (0) 7398 840 817",
      senderPhone2: null,
      addressLine1: "90 Freemens Common Road",
      addressLine2: "Leicester \u2022 LE2 7SQ \u2022 England",
      website: "www.chaiiwala.co.uk",
      logoUrl: "https://cdn.example.com/logo.png",
      badgeUrl: "https://cdn.example.com/badge.png",
    });

    expect(html).toContain("ben robinson");
    expect(html).toContain("Marketing Executive");
    expect(html).toContain("+44 (0) 7398 840 817");
    expect(html).toContain("90 Freemens Common Road");
    expect(html).toContain("www.chaiiwala.co.uk");
    expect(html).toContain("logo.png");
    expect(html).toContain("badge.png");
    // Should use table layout
    expect(html).toContain("<table");
    expect(html).toContain("border-right");
  });

  it("renders without optional fields", () => {
    const html = renderSignatureHtml({
      senderName: "test user",
      senderTitle: null,
      senderPhone: null,
      senderPhone2: null,
      addressLine1: "",
      addressLine2: "",
      website: "",
      logoUrl: "",
      badgeUrl: "",
    });

    expect(html).toContain("test user");
    expect(html).not.toContain("undefined");
    expect(html).toContain("<table");
  });

  it("renders two phone numbers stacked", () => {
    const html = renderSignatureHtml({
      senderName: "sohail ali",
      senderTitle: "CCO & Co-Founder",
      senderPhone: "+44 (0) 7568 569 870",
      senderPhone2: "+44 (0) 1162 966 705",
      addressLine1: "90 Freemens Common Road",
      addressLine2: "Leicester \u2022 LE2 7SQ \u2022 England",
      website: "www.chaiiwala.co.uk",
      logoUrl: "",
      badgeUrl: "",
    });

    expect(html).toContain("+44 (0) 7568 569 870");
    expect(html).toContain("+44 (0) 1162 966 705");
  });

  it("escapes HTML in user input", () => {
    const html = renderSignatureHtml({
      senderName: '<script>alert("xss")</script>',
      senderTitle: null,
      senderPhone: null,
      senderPhone2: null,
      addressLine1: "",
      addressLine2: "",
      website: "",
      logoUrl: "",
      badgeUrl: "",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderSignaturePlain", () => {
  it("renders full plain text signature", () => {
    const plain = renderSignaturePlain(
      "ben robinson",
      "Marketing Executive",
      "+44 (0) 7398 840 817",
      null,
      "90 Freemens Common Road",
      "Leicester \u2022 LE2 7SQ \u2022 England",
      "www.chaiiwala.co.uk"
    );

    expect(plain).toContain("---");
    expect(plain).toContain("ben robinson");
    expect(plain).toContain("Marketing Executive");
    expect(plain).toContain("+44 (0) 7398 840 817");
    expect(plain).toContain("www.chaiiwala.co.uk");
  });

  it("renders without optional fields", () => {
    const plain = renderSignaturePlain("test user", null, null, null, "", "", "");
    expect(plain).toContain("test user");
    expect(plain).toContain("---");
  });
});
