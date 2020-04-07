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
const OPEN_DELIMS = "[{<",
  CLOSE_DELIMS = "]}>";
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

class Line {
  constructor(items) {
    this.content = items;
  }
}

class Command {
  constructor(name, args) {
    this.name = name;
    if (args) this.args = args;
  }
  isRaw() {
    return this.name[this.name.length - 1] == "*";
  }
  get closeDelim() {
    return getCloseDelim(this.openDelim[0]).repeat(this.openDelim.length);
  }
}

Command.BLOCK = "block";
Command.INPARAGRAPH = "inparagraph";
Command.INLINE = "inline";


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
        cmd.type = Command.INPARAGRAPH;
        if (cmd.isRaw()) {
          cmd.content = innerLines;
        } else {
          const mr = parse(innerLines);
          if (mr.content.length > 1) {
            // FIXME: Pass an argument to parse to check empty lines when they occur??
            throw new Error(
              `An inparagraph command should have only one block`
            );
          }
          cmd.content = mr;
        }
        paragraph.append(cmd);
      } else {
        // b.2) Block command (no paragraph)
        cmd.type = Command.BLOCK;
        cmd.content = cmd.isRaw() ? innerLines : parse(innerLines);
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
    cmd.type = Command.INLINE;

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
      cmd.content = parseLine(line.slice(start, end));
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

// Printer

class Printer {
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

const print = (mr, writeStream = process.stdout) => {
  const P = new Printer(writeStream);

  const _print = (mr) => {
    if (mr === null || mr === undefined) {
      return;
    }
    switch (mr.constructor) {
      case Markright: {
        mr.content.forEach((block, i) => {
          if (i > 0) P.endl();
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
          if (item instanceof Line) P.endl();
        });
        break;
      }
      case Command: {
        const cmd = mr;
        P.write(`@${cmd.name}`);
        if (cmd.args) {
          P.write(`(${cmd.args.join(",")})`);
        }
        switch (cmd.type) {
          case Command.INLINE: {
            if (cmd.content) {
              P.write(`${cmd.openDelim}`);
              _print(cmd.content, true);
              P.write(`${cmd.closeDelim}`);
            }
            break;
          }
          case Command.INPARAGRAPH:
          case Command.BLOCK: {
            P.endl();
            P.indent(2);
            _print(cmd.content);
            P.indent(-2);
            break;
          }
        }
        break;
      }
      case String: {
        P.write(mr);
        break;
      }
      default:
        throw new Error(`Unexpected ${mr.constructor.name} (${mr})`);
    }
  };

  _print(mr);
};

// Processor

const rInternal = /^<.*>$/;
const isInternal = (pathElem) => rInternal.test(pathElem);

const parsePath = (str) => str.split("/");

const pathMatch = (modelPath, path) => {
  const _elemMatch = (modelElem, elem) => {
    return (
      (modelElem === "*" && !isInternal(elem)) ||
      (modelElem === "<*>" && isInternal(elem)) ||
      modelElem === elem
    );
  };
  const minLength = Math.min(modelPath.length, path.length);
  for (let i = 0; i < minLength; i++) {
    const j = path.length - 1 - i;
    const mj = modelPath.length - 1 - i;
    if (!_elemMatch(modelPath[mj], path[j])) {
      return false;
    }
  }
  return true;
};

class FuncMap {
  constructor() {
    this.table = [];
  }
  on(pathStr, func) {
    this.table.push({ path: parsePath(pathStr), func });
  }
  get(path) {
    for (let i = this.table.length - 1; i >= 0; i--) {
      const { path: modelPath, func } = this.table[i];
      if (pathMatch(modelPath, path)) {
        return func;
      }
    }
    return null;
  }
}

const process = (root, funcMap) => {
  const currPath = [];

  const _containerDefault = (mr) => mr.content.map(_process);
  const _textDefault = (mr) => mr;

  const _processElem = (mr, name, defaultFunc) => {
    currPath.push(name);
    const processFunc = funcMap.get(currPath) || defaultFunc;
    const result = processFunc(mr, _process, currPath);
    currPath.pop();
    return result;
  };

  const _process = (mr) => {
    if (mr === null || mr === undefined) {
      return;
    }
    switch (mr.constructor) {
      case Markright:
        return _processElem(mr, "<markright>", _containerDefault);
      case Paragraph:
        return _processElem(mr, "<paragraph>", _containerDefault);
      case Line:
        return _processElem(mr, "<line>", _containerDefault);
      case String:
        return _processElem(mr, "<text>", _textDefault);
      case Command: {
        currPath.push(mr.name);
        const processFunc = funcMap.get(currPath);
        if (processFunc == null) {
          throw new Error(`Cannot resolve "${currPath}"`);
        }
        const result = processFunc(mr, _process, currPath);
        currPath.pop();
        return result;
      }
      default:
        throw new Error(`Unexpected ${mr.constructor.name} (${mr})`);
    }
  };

  _process(root);
};

module.exports = {
  parse,
  parseLine,
  parseFile,
  print,
  FuncMap,
  process,
};
