import { describe, expect, it } from "vitest";
import { filterParticipants, normalizeForSearch } from "@/lib/search";

const rows = [
  { fullName: "José Núñez", phone: "+51987654321", company: "Cautiva Marketing" },
  { fullName: "María Pérez", phone: "+51912345678", company: "Panadería La Esperanza" },
  { fullName: "Carlos Quispe", phone: "+51955500011", company: "Constructora Andina" },
  { fullName: "Sofía Rojas", phone: "+56912345678", company: "Tienda Sur" },
];

describe("normalizeForSearch", () => {
  it("pasa a minúsculas y elimina tildes y diéresis", () => {
    expect(normalizeForSearch("JOSÉ Núñez")).toBe("jose nunez");
    expect(normalizeForSearch("Güemes")).toBe("guemes");
  });

  it("recorta y colapsa los espacios repetidos", () => {
    expect(normalizeForSearch("  Ana   María \t Ríos ")).toBe("ana maria rios");
  });

  it("devuelve cadena vacía si solo hay espacios", () => {
    expect(normalizeForSearch("   ")).toBe("");
  });
});

describe("filterParticipants", () => {
  it("busca por nombre sin distinguir mayúsculas ni tildes", () => {
    expect(filterParticipants(rows, "jose")).toEqual([rows[0]]);
    expect(filterParticipants(rows, "JOSÉ")).toEqual([rows[0]]);
    expect(filterParticipants(rows, "nunez")).toEqual([rows[0]]);
    expect(filterParticipants(rows, "MARIA perez")).toEqual([rows[1]]);
    expect(filterParticipants(rows, "María")).toEqual([rows[1]]);
  });

  it("busca por celular con 9 dígitos, parcial o con separadores", () => {
    expect(filterParticipants(rows, "987654321")).toEqual([rows[0]]);
    expect(filterParticipants(rows, "987 654 321")).toEqual([rows[0]]);
    expect(filterParticipants(rows, "5550")).toEqual([rows[2]]);
  });

  it("busca por celular con prefijo +51 o 51", () => {
    expect(filterParticipants(rows, "+51987654321")).toEqual([rows[0]]);
    expect(filterParticipants(rows, "51987654321")).toEqual([rows[0]]);
    expect(filterParticipants(rows, "+51 987 654 321")).toEqual([rows[0]]);
    expect(filterParticipants(rows, "+51 912 345 678")).toEqual([rows[1]]);
  });

  it("busca por celular de otro país con su prefijo", () => {
    expect(filterParticipants(rows, "56 9 1234 5678")).toEqual([rows[3]]);
    expect(filterParticipants(rows, "+56912345678")).toEqual([rows[3]]);
  });

  it("una consulta sin dígitos filtra solo por nombre y empresa", () => {
    expect(filterParticipants(rows, "María")).toHaveLength(1);
    expect(filterParticipants(rows, "tienda")).toEqual([rows[3]]);
  });

  it("busca por empresa u ocupación", () => {
    expect(filterParticipants(rows, "panaderia")).toEqual([rows[1]]);
    expect(filterParticipants(rows, "ANDINA")).toEqual([rows[2]]);
  });

  it("devuelve lista vacía si nada coincide", () => {
    expect(filterParticipants(rows, "zzzz")).toEqual([]);
    expect(filterParticipants(rows, "999999999")).toEqual([]);
  });

  it("devuelve todos con cadena vacía o solo espacios", () => {
    expect(filterParticipants(rows, "")).toEqual(rows);
    expect(filterParticipants(rows, "   ")).toEqual(rows);
  });

  it("una consulta de letras no coincide con celulares", () => {
    expect(filterParticipants(rows, "abc")).toEqual([]);
  });
});
