type Graph = {
  version: number;
  roots: string[];
  modules: ({ kind: 'external'; specifier: string } | {
    kind: 'esm';
    dependencies?: { specifier: string; code?: { specifier: string } }[];
    specifier: string;
  })[];
};

function assert(value: boolean): asserts value {
  if (value !== true) {
    throw new Error('Assertion failed');
  }
}

function ensure<T>(value: T | undefined | null): T {
  assert(value !== undefined && value !== null);
  return value;
}

function parsePackageSpecifier(specifier: string) {
  // deno-fmt-ignore
  const regex = /^(:?(?<registry>jsr|npm):\/?)?(?<name>(?:@[a-zA-Z0-9_\-]+\/)?[a-zA-Z0-9_\-]+)(?:@(?<version>(?:\*|(?:\^|~|[<>]=?)?\d+(?:\.\d+)*)))?(?<path>(\/[^\/]+)+)?$/;
  const match = specifier.match(regex);
  if (match !== null) {
    const groups = ensure(match.groups);
    const registry = groups.registry;
    const name = ensure(groups.name);
    const version = groups.version;
    const path = groups.path;
    return { registry, name, version, path };
  }
  return undefined;
}

class GraphAnalyzer {
  readonly #graph: Graph;
  readonly #specifiers: Set<string>;

  constructor(graph: Graph, specifiers: Set<string>) {
    this.#graph = graph;
    this.#specifiers = specifiers;
  }

  analyze(specifier: string) {
    const module = ensure(this.#graph.modules.find((module) => module.specifier === specifier));
    if (module.kind === 'esm' && module.dependencies !== undefined) {
      for (const dependency of module.dependencies) {
        const parsedPackageSpecifier = parsePackageSpecifier(dependency.specifier);
        if (parsedPackageSpecifier !== undefined) {
          this.#specifiers.add(parsedPackageSpecifier.name);
        } else if (dependency.code !== undefined) {
          this.analyze(dependency.code.specifier);
        }
      }
    }
  }
}

export default async function getExportsDependencies() {
  const exports = ensure(configurationFile.exports);
  const exportedPaths = (typeof exports === 'string') ? [exports] : Object.values(exports);
  const specifiers = new Set<string>();
  for (const path of exportedPaths) {
    const command = new Deno.Command('deno', { args: ['info', '--json', path] });
    const { code, stdout, stderr } = await command.output();
    if (code !== 0) {
      throw new Error(new TextDecoder().decode(stderr));
    }
    const graph = JSON.parse(new TextDecoder().decode(stdout)) as Graph;
    const analyzer = new GraphAnalyzer(graph, specifiers);
    analyzer.analyze(ensure(graph.roots[0]));
  }
  if (specifiers.size > 0) {
    const imports = configurationFile.imports as Record<string, string> | undefined;
    assert(imports !== undefined);
    return Array.from(specifiers).toSorted().map((specifier) => {
      const parsedPackageSpecifier = ensure(parsePackageSpecifier(ensure(imports[specifier])));
      const { registry, name, version } = parsedPackageSpecifier;
      assert(registry !== undefined);
      assert(version !== undefined);
      return { registry, name, version };
    });
  }
  return [];
}

type ConfigurationFile = {
  name: string;
  version: string;
  description: string;
  license: string;
  author?: string;
  repository?: unknown;
  exports?: string | Record<string, string>;
  imports?: Record<string, string>;
};

const type = (() => {
  try {
    return ensure(ensure(ensure(Deno.args[0]).match(/^--type=(jsr|npm)$/))[1]);
  } catch {
    throw new Error('Missing or invalid type argument');
  }
})();

const configurationFile: ConfigurationFile = JSON.parse(Deno.readTextFileSync('deno.json'));

const dependencies = await getExportsDependencies();

const manifest = (() => {
  if (type === 'jsr') {
    return {
      name: ensure(configurationFile.name),
      version: ensure(configurationFile.version),
      license: ensure(configurationFile.license),
      exports: ensure(configurationFile.exports),
      publish: { include: ['src', 'README.md'], exclude: ['**/*.test.ts'] },
      imports: dependencies.length > 0
        ? Object.fromEntries(dependencies.map(({ name, registry, version }) => {
          return [name, `${registry}:${name}@${version}`];
        }))
        : undefined,
    };
  }
  if (type === 'npm') {
    return {
      name: ensure(configurationFile.name),
      version: ensure(configurationFile.version),
      description: ensure(configurationFile.description),
      license: ensure(configurationFile.license),
      author: configurationFile.author,
      repository: configurationFile.repository,
      type: 'module',
      exports: ((exports) => {
        const replaceFn = (path: string) => path.replace(/^\.\/src\//, './dist/').replace(/\.ts$/, '.js');
        if (typeof exports === 'string') {
          return replaceFn(exports);
        } else {
          return Object.fromEntries(Object.entries(exports).map(([key, value]) => [key, replaceFn(value)]));
        }
      })(ensure(configurationFile.exports)),
      files: ['dist', 'README.md'],
      dependencies: dependencies.length > 0
        ? Object.fromEntries(dependencies.map(({ name, version }) => [name, version]))
        : undefined,
    };
  }
  throw new Error(`Invalid type ${type}`);
})();

console.log(JSON.stringify(manifest, null, 2));
