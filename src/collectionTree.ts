import type { Collection, SatchelRequest, TreeNode } from "./types";

export function findRequest(items: TreeNode[], id: string): SatchelRequest | undefined {
  for (const node of items) {
    if (node.type === "request") {
      if (node.id === id) return node.request;
    } else {
      const found = findRequest(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function updateRequest(
  items: TreeNode[],
  id: string,
  updater: (request: SatchelRequest) => SatchelRequest,
): TreeNode[] {
  return items.map((node): TreeNode => {
    if (node.type === "request") {
      return node.id === id ? { ...node, request: updater(node.request) } : node;
    }
    return { ...node, children: updateRequest(node.children, id, updater) };
  });
}

export function updateRequestInCollections(
  collections: Collection[],
  requestId: string,
  updater: (request: SatchelRequest) => SatchelRequest,
): Collection[] {
  return collections.map((collection) => ({
    ...collection,
    items: updateRequest(collection.items, requestId, updater),
  }));
}

export function resolveVariables(text: string, variables: { key: string; value: string }[]): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const found = variables.find((v) => v.key === key);
    return found ? found.value : match;
  });
}
