
class Processor {
  constructor() {
    const defaultFn = ({ content }) => [...content];
    this.funcTable = [
      { path: "<markright>", fn: defaultFn },
      { path: "<paragraph>", fn: defaultFn },
      { path: "<line>", fn: defaultFn },
      { path: "<text>", fn: ({ content }) => content },
    ];
  }

  _on(path, fn) {
    this.funcTable.push({ path, fn });
  }
  resolve(path) {
    const last = path[path.length - 1];
    for (let i = this.funcTable.length - 1; i >= 0; i--) {
      const { path: tablePath, fn } = this.funcTable[i];
      if (tablePath === last || (tablePath === "*" && !rInternal.test(last))) {
        return fn;
      }
    }
    return null;
  }

  markright(fn) {
    this._on("<markright>", fn);
  }
  paragraph(fn) {
    this._on("<paragraph>", fn);
  }
  line(fn) {
    this._on("<line>", fn);
  }
  text(fn) {
    this._on("<text>", fn);
  }

  cmd(path, fn) {
    this._on(path, fn);
  }
  cmdList(pathList, fn) {
    pathList.forEach((path) => {
      this._on(path, fn);
    });
  }

  process(root) {
    const _contentGenerator = (path, mr) =>
      function* () {
        if (Array.isArray(mr.content)) {
          for (let child of mr.content) {
            yield _walk(path, child);
          }
        } else {
          yield _walk(path, mr.content);
        }
      };

    const _resolve = (mr, parentPath, name, contentGenerator) => {
      const path = [...parentPath, name];
      const func = this.resolve(path);
      if (func) {
        return func({
          path: path,
          cmd: mr instanceof Command ? mr : null,
          content: contentGenerator(path, mr)(),
        });
      }
      throw new Error(`Func not found for ${path}!`);
    };

    const _walk = (path, mr) => {
      if (mr === null || mr === undefined) {
        return;
      }
      switch (mr.constructor) {
        case Markright:
          return _resolve(mr, path, "<markright>", _contentGenerator);
        case Paragraph:
          return _resolve(mr, path, "<paragraph>", _contentGenerator);
        case Line:
          return _resolve(mr, path, "<line>", _contentGenerator);
        case String:
          return _resolve(mr, path, "<text>", () => () => mr);
        case Command:
          return _resolve(mr, path, mr.name, _contentGenerator);
        default:
          throw new Error(`Unexpected ${mr.constructor.name} (${mr})`);
      }
    };

    return _walk([], root);
  }
}

const createProcessor = () => {
  return new Processor();
};
