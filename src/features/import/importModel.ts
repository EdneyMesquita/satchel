import type { AuthConfig, Environment, Workspace } from "@/types";
import {
  analyzePostmanCollection,
  detectPostmanFile,
  parsePostmanEnvironment,
  PostmanImportError,
  type PostmanAnalysis,
} from "@/postman";

export interface PickedCollection {
  fileName: string;
  size: number;
  analysis: PostmanAnalysis;
}

export interface AttachedEnvironment {
  /** stable key for the list (the environment's own id) */
  id: string;
  fileName: string;
  environment: Environment;
}

export interface ReadResult {
  /** the last collection among the files, if any */
  collection?: PickedCollection;
  environments: AttachedEnvironment[];
  /** the last problem found, if any */
  error?: string;
}

/** Minimal File shape (lets tests pass plain objects). */
export interface TextFile {
  name: string;
  size: number;
  text: () => Promise<string>;
}

/** Sort dropped/picked files into a collection, environments and an error line. */
export async function readPostmanFiles(files: readonly TextFile[]): Promise<ReadResult> {
  const result: ReadResult = { environments: [] };
  for (const file of files) {
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      result.error = `${file.name} isn't valid JSON.`;
      continue;
    }
    switch (detectPostmanFile(json)) {
      case "environment": {
        const environment = parsePostmanEnvironment(json, file.name);
        result.environments.push({ id: environment.id, fileName: file.name, environment });
        break;
      }
      case "collection":
        try {
          result.collection = { fileName: file.name, size: file.size, analysis: analyzePostmanCollection(json) };
        } catch (err) {
          result.error = err instanceof PostmanImportError ? `${file.name}: ${err.message}` : `Couldn't read ${file.name}.`;
        }
        break;
      case "v1":
        result.error = `${file.name} is a Postman v1 collection. In Postman, export it again as Collection v2.1.`;
        break;
      default:
        result.error = `${file.name} doesn't look like a Postman collection or environment export.`;
    }
  }
  return result;
}

export type ImportWarning =
  | { kind: "undefined"; names: string[] }
  | { kind: "scripts"; count: number }
  | { kind: "files"; count: number }
  | { kind: "graphql"; count: number }
  | { kind: "inheritedAuth"; type: AuthConfig["type"]; count: number }
  | { kind: "unsupportedAuth"; types: string[] };

export interface ImportTarget {
  dest: "new" | "merge";
  /** collection id when merging */
  into?: string;
}

/** Every variable name the imported requests could resolve against after the import. */
export function knownVariables(
  analysis: PostmanAnalysis,
  workspace: Workspace,
  attached: readonly AttachedEnvironment[],
  target: ImportTarget,
): Set<string> {
  const known = new Set<string>();
  const add = (list: { key: string }[]) => list.forEach((v) => known.add(v.key));
  add(analysis.collection.variables);
  add(workspace.globals);
  workspace.environments.forEach((e) => add(e.variables));
  attached.forEach((a) => add(a.environment.variables));
  if (target.dest === "merge") add(workspace.collections.find((c) => c.id === target.into)?.variables ?? []);
  return known;
}

/** The "Before you import" list, most important first. */
export function importWarnings(analysis: PostmanAnalysis, known: ReadonlySet<string>): ImportWarning[] {
  const warnings: ImportWarning[] = [];
  const undefinedNames = analysis.usedVariables.filter((n) => !known.has(n));
  if (undefinedNames.length) warnings.push({ kind: "undefined", names: undefinedNames });
  if (analysis.scripts) warnings.push({ kind: "scripts", count: analysis.scripts });
  if (analysis.fileFields) warnings.push({ kind: "files", count: analysis.fileFields });
  if (analysis.graphqlBodies) warnings.push({ kind: "graphql", count: analysis.graphqlBodies });
  if (analysis.inheritedAuth) warnings.push({ kind: "inheritedAuth", ...analysis.inheritedAuth });
  if (analysis.unsupportedAuth.length) warnings.push({ kind: "unsupportedAuth", types: analysis.unsupportedAuth });
  return warnings;
}

/** The names attached environments will get (same de-duplication as addEnvironments). */
export function plannedEnvironmentNames(existing: readonly string[], attached: readonly AttachedEnvironment[]): string[] {
  const taken = existing.map((n) => n.toLowerCase());
  return attached.map(({ environment: { name } }) => {
    let candidate = name;
    let n = 2;
    while (taken.includes(candidate.toLowerCase())) candidate = `${name} ${n++}`;
    taken.push(candidate.toLowerCase());
    return candidate;
  });
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
