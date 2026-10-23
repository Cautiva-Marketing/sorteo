import { describe, expect, it } from "vitest";
import { buildOrigin } from "@/lib/origin";

describe("buildOrigin", () => {
  it("usa x-forwarded-host y x-forwarded-proto", () => {
    const headers = new Headers({
      "x-forwarded-host": "sorteo.example.com",
      "x-forwarded-proto": "https",
    });
    expect(buildOrigin(headers)).toBe("https://sorteo.example.com");
  });

  it("con varios valores usa el primero", () => {
    const headers = new Headers({
      "x-forwarded-host": "a.example.com, b.example.com",
      "x-forwarded-proto": "http, https",
    });
    expect(buildOrigin(headers)).toBe("http://a.example.com");
  });

  it.each([["evil.com/x"], ["a b"], ["user@evil.com"], ["x.com?y"], ["x.com#y"], ["a\\b"]])(
    "si x-forwarded-host no es válido (%j) cae a host",
    (forwarded) => {
      const headers = new Headers({
        "x-forwarded-host": forwarded,
        host: "sorteo.example.com",
        "x-forwarded-proto": "https",
      });
      expect(buildOrigin(headers)).toBe("https://sorteo.example.com");
    },
  );

  it("si x-forwarded-host está vacío cae a host", () => {
    const headers = new Headers({ "x-forwarded-host": "", host: "sorteo.example.com" });
    expect(buildOrigin(headers)).toBe("https://sorteo.example.com");
  });

  it.each([["localhost:3000"], ["127.0.0.1:3000"], ["localhost"]])(
    "%j sin protocolo usa http",
    (host) => {
      expect(buildOrigin(new Headers({ host }))).toBe(`http://${host}`);
    },
  );

  it("un dominio sin x-forwarded-proto usa https", () => {
    expect(buildOrigin(new Headers({ host: "sorteo.example.com" }))).toBe(
      "https://sorteo.example.com",
    );
  });

  it("ignora un x-forwarded-proto que no es http ni https", () => {
    const headers = new Headers({ host: "sorteo.example.com", "x-forwarded-proto": "javascript" });
    expect(buildOrigin(headers)).toBe("https://sorteo.example.com");
  });

  it("acepta mayúsculas y puerto", () => {
    expect(buildOrigin(new Headers({ host: "Sorteo.Example.com:8443" }))).toBe(
      "https://Sorteo.Example.com:8443",
    );
  });

  it("devuelve null sin encabezados", () => {
    expect(buildOrigin(new Headers())).toBeNull();
  });

  it.each([
    ["ex ample.com"],
    ["example.com/path"],
    ["user@example.com"],
    ["example.com?x=1"],
    ["example.com#frag"],
    ["example.com\\x"],
    ["example.com:123456"],
    [""],
  ])("devuelve null (nunca localhost) si host no es válido: %j", (host) => {
    const result = buildOrigin(new Headers({ host }));
    expect(result).toBeNull();
  });
});
