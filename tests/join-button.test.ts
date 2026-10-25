import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

test("Request to Join does not pass the click event as the selected ride", () => {
  const source = ts.createSourceFile(
    "home-client.tsx",
    readFileSync(
      new URL("../components/home-client.tsx", import.meta.url),
      "utf8",
    ),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let handler: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(source) === "button" &&
      node.children.some((child) =>
        child.getText(source).includes('"REQUEST TO JOIN"'),
      )
    ) {
      const attribute = node.openingElement.attributes.properties.find(
        (prop) =>
          ts.isJsxAttribute(prop) && prop.name.getText(source) === "onClick",
      );
      if (
        attribute &&
        ts.isJsxAttribute(attribute) &&
        attribute.initializer &&
        ts.isJsxExpression(attribute.initializer)
      )
        handler = attribute.initializer.expression;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(handler, "Request to Join must have a click handler");
  const calls: unknown[][] = [];
  const selectedRide = { rideId: "COCO-SELECTED" };
  let requestedRide: unknown;
  const request = (...args: unknown[]) => {
    calls.push(args);
    requestedRide = args[0] ?? selectedRide;
  };
  const click = new Function("request", `return (${handler.getText(source)});`)(
    request,
  );
  click({ type: "click", currentTarget: {} });
  assert.deepEqual(calls, [[]]);
  assert.equal(requestedRide, selectedRide);
});
