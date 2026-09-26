import type { Collection, Environment, FolderNode, KeyValue, RequestNode, SatchelRequest, TreeNode } from "./types";
import { VARIABLE_PATTERN } from "./variableTokens";

const newId = () => crypto.randomUUID();

export function createCollection(name: string): Collection {
  return { id: newId(), name, variables: [], items: [] };
}

export function createEnvironment(name: string): Environment {
  return { id: newId(), name, variables: [] };
}

export function createFolder(name: string): FolderNode {
  return { type: "folder", id: newId(), name, children: [] };
}

export function createRequest(name: string): RequestNode {
  const id = newId();
  return {
    type: "request",
    id,
    request: {
      id,
      name,
      method: "GET",
      url: "",
      params: [],
      headers: [],
      auth: { type: "none" },
      body: { mode: "none" },
    },
  };
}

export function addNode(items: TreeNode[], parentFolderId: string | null, node: TreeNode): TreeNode[] {
  if (parentFolderId === null) return [...items, node];
  return items.map((n): TreeNode => {
    if (n.type !== "folder") return n;
    if (n.id === parentFolderId) return { ...n, children: [...n.children, node] };
    return { ...n, children: addNode(n.children, parentFolderId, node) };
  });
}

export function removeNode(items: TreeNode[], id: string): TreeNode[] {
  return items
    .filter((n) => n.id !== id)
    .map((n): TreeNode => (n.type === "folder" ? { ...n, children: removeNode(n.children, id) } : n));
}

export function renameNode(items: TreeNode[], id: string, name: string): TreeNode[] {
  return items.map((n): TreeNode => {
    if (n.id === id) {
      return n.type === "folder" ? { ...n, name } : { ...n, request: { ...n.request, name } };
    }
    return n.type === "folder" ? { ...n, children: renameNode(n.children, id, name) } : n;
  });
}

export function countRequests(items: TreeNode[]): number {
  return items.reduce((total, node) => total + (node.type === "request" ? 1 : countRequests(node.children)), 0);
}

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

export function resolveVariables(text: string, variables: KeyValue[]): string {
  return text.replace(VARIABLE_PATTERN, (match, key) => {
    const found = variables.find((v) => v.key === key && v.enabled);
    return found ? found.value : match;
  });
}
