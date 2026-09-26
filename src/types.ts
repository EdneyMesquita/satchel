export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export interface KeyValue {
  key: string;
  value: string;
  enabled: boolean;
}

export type AuthConfig =
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }
  | { type: "apikey"; key: string; value: string; in: "header" | "query" };

export type RequestBody =
  | { mode: "none" }
  | { mode: "raw"; raw: string; language: "json" | "text" | "xml" | "html" }
  | { mode: "urlencoded"; params: KeyValue[] };

export interface SatchelRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  auth: AuthConfig;
  body: RequestBody;
}

export interface FolderNode {
  type: "folder";
  id: string;
  name: string;
  children: TreeNode[];
}

export interface RequestNode {
  type: "request";
  id: string;
  request: SatchelRequest;
}

export type TreeNode = FolderNode | RequestNode;

export interface Collection {
  id: string;
  name: string;
  variables: KeyValue[];
  items: TreeNode[];
}
