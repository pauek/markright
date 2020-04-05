const fs = require("fs");

// Regular Expressions
const rEmpty = /^[ \t]*$/;
const rIndent = /^( )*/;
const rCommandHeader = /@([a-zA-Z0-9_-]*)(\(([^),]+(,[^),]+)*)*\))?/;
const rBlockCommand = /^@([a-zA-Z0-9_-]*)(\([^),]+(,[^),]+)*\))?\s*$/;

// Utils
const isEmpty = (line) => rEmpty.test(line);
const indentation = (line) => line.match(rIndent)[0].length;
const isSingleCommand = (line) => rBlockCommand.test(line);

// These are matching tables...
const OPEN_DELIMS = "[{<";
const CLOSE_DELIMS = "]}>";
const getCloseDelim = (c) => CLOSE_DELIMS[OPEN_DELIMS.indexOf(c)];

const getDelimiters = (line) => {
  const open = line[0];
  if (OPEN_DELIMS.indexOf(open) === -1) {
    return null;
  }
  let i;
  for (i = 1; i < line.length; i++) {
    if (line[i] !== open) break;
  }
  return { open, close: getCloseDelim(open), length: i };
};

// Types

class Markright {
  constructor(blocks) {
    this.content = blocks;
  }
}

class Paragraph {
  constructor(content = []) {
    this.content = content;
  }
  append(lineOrCommand) {
    this.content.push(lineOrCommand);
  }
  isEmpty() {
    return this.content.length === 0;
  }
  isSingleCommand() {
    return this.content.length === 1 && this.content[0] instanceof Command;
  }
}

const CommandType = {
  BLOCK: "block",
  INPARAGRAPH: "inparagraph",
  INLINE: "inline",
};

class Command {
  constructor(name, args) {
    this.name = name;
    if (args) this.args = args;
  }
  setType(type) {
    this.type = type;
  }
  setContent(content) {
    this.content = content;
  }
  isRaw() {
    return this.name[this.name.length - 1] == "*";
  }
  get closeDelim() {
    return getCloseDelim(this.openDelim[0]).repeat(this.openDelim.length);
  }
}

class Line {
  constructor(items) {
    this.content = items;
  }
}

// Parser

const parseCommandHeader = (line) => {
  const [all, name, _, args] = line.match(rCommandHeader);
  return {
    cmd: new Command(name, args ? args.split(",") : null),
    pos: all.length,
  };
};

const parse = (lines) => {
  const blocks = [];
  let paragraph = null;
  let i = 0;

  const collectLines = (baseIndentation) => {
    const result = [];
    i++;
    while (i < lines.length) {
      if (isEmpty(lines[i])) {
        result.push("");
      } else {
        const ind = indentation(lines[i]);
        if (ind <= baseIndentation) {
          break;
        } else if (ind >= baseIndentation + 2) {
          const cleanLine = lines[i].slice(baseIndentation + 2);
          result.push(cleanLine);
        } else {
          throw new Error(`Wrong indentation: ${lines[i]}`);
        }
      }
      i++;
    }
    return result;
  };

  while (i < lines.length) {
    // a) Empty line?
    if (isEmpty(lines[i])) {
      if (paragraph) {
        blocks.push(paragraph);
        paragraph = null;
      }
      i++;
      continue;
    }

    // b) Single command (block or inline)
    if (isSingleCommand(lines[i])) {
      const { cmd } = parseCommandHeader(lines[i]);
      const baseIndentation = indentation(lines[i]);
      const innerLines = collectLines(baseIndentation);
      if (paragraph) {
        // b.1) Inline command (open paragraph)
        cmd.setType(CommandType.INPARAGRAPH);
        if (cmd.isRaw()) {
          cmd.setContent(innerLines);
        } else {
          const mr = parse(innerLines);
          if (mr.content.length > 1) {
            // FIXME: Pass an argument to parse to check empty lines when they occur??
            throw new Error(
              `An inparagraph command should have only one block`
            );
          }
          cmd.setContent(mr);
        }
        paragraph.append(cmd);
      } else {
        // b.2) Block command (no paragraph)
        cmd.setType(CommandType.BLOCK);
        cmd.setContent(cmd.isRaw() ? innerLines : parse(innerLines));
        blocks.push(cmd);
      }
      continue;
    }

    // c) Line
    if (paragraph == null) {
      paragraph = new Paragraph();
    }
    paragraph.append(parseLine(lines[i]));

    i++; // next line
  }

  // Accumulated lines
  if (paragraph) {
    blocks.push(paragraph);
  }

  return new Markright(blocks);
};

const parseLine = (line) => {
  const items = [];

  while (true) {
    if (line.length === 0) {
      break;
    }

    // Text until first '@'
    const at = line.indexOf("@");
    if (at === -1) {
      items.push(line);
      break;
    }
    if (at > 0) {
      items.push(line.slice(0, at));
      line = line.slice(at);
    }

    // Command
    const { cmd, pos } = parseCommandHeader(line);
    line = line.slice(pos);
    cmd.setType(CommandType.INLINE);

    // Parse delimited text
    const delims = getDelimiters(line);
    if (delims) {
      const { open, close, length } = delims;
      cmd.openDelim = open.repeat(length);
      const start = length;
      const end = line.indexOf(close.repeat(length));
      if (end === -1) {
        throw new Error(`Open delimiter ${open.repeat(length)} not closed`);
      }
      cmd.setContent(parseLine(line.slice(start, end)));
      line = line.slice(end + length);
    }

    items.push(cmd);
  }

  return new Line(items);
};

const parseFile = (filename) => {
  const lines = fs.readFileSync(filename).toString().split("\n");
  return parse(lines);
};

// Logger

class Logger {
  constructor(wstream) {
    this.wstream = wstream;
    this.indentation = 0;
    this.lineStart = true;
  }
  endl() {
    this.wstream.write("\n");
    this.lineStart = true;
  }
  indent(n) {
    this.indentation += n;
  }
  write(x) {
    if (this.lineStart) {
      this.lineStart = false;
      this.wstream.write(" ".repeat(this.indentation));
    }
    this.wstream.write(x);
  }
}

// Processor

class Processor {
  constructor() {
    this.funcTable = [
      {
        path: "*",
        fn: ({ content }) => content(), // Default implementation
      },
    ];
  }

  _on(path, fn) {
    this.funcTable.push({ path, fn });
  }
  resolve(path) {
    const last = path[path.length - 1];
    for (let i = this.funcTable.length-1; i >= 0; i--) {
      const { path: tablePath, fn } = this.funcTable[i];
      if (tablePath === last || tablePath === "*") {
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
      this._on(path, fn(path));
    });
  }

  process(root) {
    const _walkContent = (path, mr) => () =>
      Array.isArray(mr.content)
        ? mr.content.map((x) => _walk(path, x))
        : _walk(path, mr.content);

    const _resolve = (mr, parentPath, name, walkContent) => {
      const path = [...parentPath, name];
      const func = this.resolve(path);
      if (func) {
        return func({
          path: path,
          args: mr.args,
          type: mr.type,
          content: walkContent(path, mr),
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
          return _resolve(mr, path, "<markright>", _walkContent);
        case Paragraph:
          return _resolve(mr, path, "<paragraph>", _walkContent);
        case Line:
          return _resolve(mr, path, "<line>", _walkContent);
        case String:
          return _resolve(mr, path, "<text>", () => () => mr);
        case Command:
          return _resolve(mr, path, mr.name, _walkContent);
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

const walk = (mr) => {
  const _walk = (mr) => {
    if (mr === null || mr === undefined) {
      return;
    }
    switch (mr.constructor) {
      case Markright: {
        console.log("Markright", mr.content);
        mr.content.forEach(_walk);
        break;
      }
      case Line: {
        console.log("Line", mr.content);
        mr.content.forEach(_walk);
        break;
      }
      case Paragraph: {
        console.log("Paragraph", mr.content);
        mr.content.forEach(_walk);
        break;
      }
      case Command: {
        const cmd = mr;
        console.log(`Command[${cmd.type}]`, cmd.name, cmd.args);
        if (cmd.content) {
          _walk(cmd.content, true);
        }
        break;
      }
      case String: {
        console.log("Text", mr);
        break;
      }
      default:
        throw new Error(`Unexpected ${mr.constructor.name} (${mr})`);
    }
  };

  _walk(mr);
};

const print = (mr, writeStream = process.stdout) => {
  const logger = new Logger(writeStream);

  const _print = (mr) => {
    if (mr === null || mr === undefined) {
      return;
    }
    switch (mr.constructor) {
      case Markright: {
        mr.content.forEach((block, i) => {
          if (i > 0) logger.endl();
          _print(block);
        });
        break;
      }
      case Line: {
        mr.content.forEach(_print);
        break;
      }
      case Paragraph: {
        mr.content.forEach((item) => {
          _print(item);
          if (item instanceof Line) logger.endl();
        });
        break;
      }
      case Command: {
        const cmd = mr;
        logger.write(`@${cmd.name}`);
        if (cmd.args) {
          logger.write(`(${cmd.args.join(",")})`);
        }
        switch (cmd.type) {
          case CommandType.INLINE: {
            if (cmd.content) {
              logger.write(`${cmd.openDelim}`);
              _print(cmd.content, true);
              logger.write(`${cmd.closeDelim}`);
            }
            break;
          }
          case CommandType.INPARAGRAPH:
          case CommandType.BLOCK: {
            logger.endl();
            logger.indent(2);
            _print(cmd.content);
            logger.indent(-2);
            break;
          }
        }
        break;
      }
      case String: {
        logger.write(mr);
        break;
      }
      default:
        throw new Error(`Unexpected ${mr.constructor.name} (${mr})`);
    }
  };

  _print(mr);
};

module.exports = {
  parse,
  parseLine,
  parseFile,
  print,
  walk,
  createProcessor,
};
