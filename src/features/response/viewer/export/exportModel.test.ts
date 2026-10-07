import { describe, expect, it } from "vitest";
import { inferColumns } from "../table/tableModel";
import {
  contentTypeOf,
  csvForList,
  csvPreview,
  exportableLists,
  exportFileName,
  extensionFor,
  listLabel,
  listSummary,
  nestedColumns,
  slugify,
} from "./exportModel";

describe("slugify", () => {
  it("lowercases and joins words with dashes", () => {
    expect(slugify("List products")).toBe("list-products");
    expect(slugify("  GET /users/{id} (v2)  ")).toBe("get-users-id-v2");
  });

  it("drops accents instead of breaking words", () => {
    expect(slugify("Listar usuários — produção")).toBe("listar-usuarios-producao");
  });

  it("falls back to 'response' when nothing is left", () => {
    expect(slugify("")).toBe("response");
    expect(slugify("✨🚀")).toBe("response");
  });

  it("keeps names short, without a trailing dash", () => {
    const slug = slugify(`${"a".repeat(59)} b`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("exportFileName", () => {
  const day = new Date(2026, 9, 7, 23, 59); // local time: Oct 7th

  it("is <slug>-YYYY-MM-DD.<ext> in local time", () => {
    expect(exportFileName("List products", "csv", day)).toBe("list-products-2026-10-07.csv");
    expect(exportFileName("Get user", "json", new Date(2026, 0, 3))).toBe("get-user-2026-01-03.json");
  });

  it("defaults to 'response' without a request name", () => {
    expect(exportFileName(undefined, "txt", day)).toBe("response-2026-10-07.txt");
  });
});

describe("extensionFor", () => {
  it("reads the content type, ignoring parameters and case", () => {
    expect(extensionFor("application/json; charset=utf-8", true)).toBe("json");
    expect(extensionFor("application/problem+json", true)).toBe("json");
    expect(extensionFor("application/vnd.api+json", false)).toBe("json");
    expect(extensionFor("Application/XML", false)).toBe("xml");
    expect(extensionFor("text/xml", false)).toBe("xml");
    expect(extensionFor("application/atom+xml", false)).toBe("xml");
    expect(extensionFor("text/html; charset=UTF-8", false)).toBe("html");
    expect(extensionFor("text/csv", false)).toBe("csv");
    expect(extensionFor("text/plain", false)).toBe("txt");
    expect(extensionFor("application/octet-stream", false)).toBe("txt");
  });

  it("uses .json for a JSON body without a content type", () => {
    expect(extensionFor(undefined, true)).toBe("json");
    expect(extensionFor("", false)).toBe("txt");
  });

  it("trusts the content type over the body sniffing", () => {
    expect(extensionFor("text/plain", true)).toBe("txt");
  });
});

describe("contentTypeOf", () => {
  it("finds the header whatever its case", () => {
    expect(contentTypeOf([["X-Id", "1"], ["Content-Type", "text/csv"]])).toBe("text/csv");
    expect(contentTypeOf([["content-type", "application/json"]])).toBe("application/json");
    expect(contentTypeOf([])).toBeUndefined();
  });
});

const PRODUCTS = {
  data: [
    { id: 1, name: "Mug", price: { amount: 18990, currency: "BRL" }, stock: 4, active: true, tags: ["kitchen", "gift"] },
    { id: 2, name: 'Tee, "large"', price: { amount: 5990, currency: "BRL" }, stock: 0, active: false, tags: [] },
  ],
  meta: { pages: [1, 2, 3] },
};

describe("exportableLists", () => {
  it("offers the same lists as the Table view, best first", () => {
    const lists = exportableLists({ ok: true, value: PRODUCTS });
    expect(lists.map(listLabel)).toEqual(["data", "meta.pages"]);
  });

  it("is empty for bodies that aren't JSON or have no list of records", () => {
    expect(exportableLists({ ok: false })).toEqual([]);
    expect(exportableLists({ ok: true, value: { id: 1, name: "one" } })).toEqual([]);
    expect(exportableLists({ ok: true, value: [] })).toEqual([]);
  });

  it("names the root list '$'", () => {
    const [root] = exportableLists({ ok: true, value: [{ id: 1 }, { id: 2 }] });
    expect(listLabel(root)).toBe("$");
    expect(listSummary(root)).toBe("2 rows");
  });
});

describe("listSummary", () => {
  it("counts rows and says where they come from", () => {
    const [data, pages] = exportableLists({ ok: true, value: PRODUCTS });
    expect(listSummary(data)).toBe("2 rows from data");
    expect(listSummary(pages)).toBe("3 rows from meta.pages");
    const [one] = exportableLists({ ok: true, value: { items: [{ id: 1 }] } });
    expect(listSummary(one)).toBe("1 row from items");
  });
});

describe("csvForList", () => {
  it("is the Table view's CSV in the records' field order: nested values as JSON, RFC 4180 quoting", () => {
    const [data] = exportableLists({ ok: true, value: PRODUCTS });
    expect(csvForList(data).split("\r\n")).toEqual([
      "id,name,price,stock,active,tags",
      '1,Mug,"{""amount"":18990,""currency"":""BRL""}",4,true,"[""kitchen"",""gift""]"',
      '2,"Tee, ""large""","{""amount"":5990,""currency"":""BRL""}",0,false,[]',
    ]);
  });

  it("exports the list that was chosen, in the response's order", () => {
    const [, pages] = exportableLists({ ok: true, value: PRODUCTS });
    expect(csvForList(pages)).toBe("value\r\n1\r\n2\r\n3");
  });

  it("leaves missing fields empty", () => {
    const [list] = exportableLists({ ok: true, value: [{ id: 1, note: "x" }, { id: 2 }] });
    expect(csvForList(list)).toBe("id,note\r\n1,x\r\n2,");
  });
});

describe("csvPreview", () => {
  it("shows the header and the first rows, and says when there are more", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const [list] = exportableLists({ ok: true, value: rows });
    const preview = csvPreview(list, inferColumns(list.rows), 3);
    expect(preview.text).toBe("id\n0\n1\n2");
    expect(preview.more).toBe(true);
    expect(csvPreview(list, inferColumns(list.rows), 10).more).toBe(false);
  });
});

describe("nestedColumns", () => {
  it("lists the columns written as JSON", () => {
    const [data] = exportableLists({ ok: true, value: PRODUCTS });
    expect(nestedColumns(inferColumns(data.rows))).toEqual(["price", "tags"]);
  });
});
