const fs = require("fs");

// Regular Expressions

const rEmpty = /^[ \t]*$/;
const rIndent = /^( )*/;
const rCommandHeader = /@([a-zA-Z0-9_-]*\*?)(\(([^),]+(,[^),]+)*)*\))?/;
const rBlockCommand = /^@([a-zA-Z0-9_-]*\*?)(\([^),]+(,[^),]+)*\))?\s*$/;

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
    return this.name[this.name.length - 1] === "*";
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
      // FIXME: Here if we search for the closing delimiter, we get it wrong
      //   with a string like `@A{b @c{d} e}`, because the closing brace of the
      //   'A' command is the one after 'd'. If the command is not raw, we could
      //   parse the line telling it to stop at the closing delimiter. If it is raw
      //   we have to look for the first closing delimiter anyway.
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
  for (let i = 0; i < modelPath.length; i++) {
    const j = path.length - 1 - i;
    const mj = modelPath.length - 1 - i;
    if (j < 0) {
      return false; // path is not long enough
    }
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
    if (Array.isArray(pathStr)) {
      pathStr.forEach(pstr => {
        this.table.push({ path: parsePath(pstr), func });
      })
    } else {
      this.table.push({ path: parsePath(pathStr), func });
    }
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

const walk = (root, funcMap) => {
  const currPath = [""];

  const _containerDefault = (mr) => mr.content.map(_walk);
  const _textDefault = (mr) => mr;

  const _walkElem = (mr, name, defaultFunc) => {
    currPath.push(name);
    const processFunc = funcMap.get(currPath) || defaultFunc;
    const result = processFunc(mr, _walk, currPath);
    currPath.pop();
    return result;
  };

  const _walk = (mr) => {
    if (mr === null || mr === undefined) {
      return;
    }
    switch (mr.constructor) {
      case Markright:
        return _walkElem(mr, "<markright>", _containerDefault);
      case Paragraph:
        return _walkElem(mr, "<paragraph>", _containerDefault);
      case Line:
        return _walkElem(mr, "<line>", _containerDefault);
      case String:
        return _walkElem(mr, "<text>", _textDefault);
      case Command: {
        currPath.push(mr.name);
        const walkFunc = funcMap.get(currPath);
        if (walkFunc == null) {
          throw new Error(`Cannot resolve "${currPath}"`);
        }
        const result = walkFunc(mr, _walk, currPath);
        currPath.pop();
        return result;
      }
      default:
        throw new Error(`Unexpected ${mr.constructor.name} (${mr})`);
    }
  };

  return _walk(root);
};

// Printer

class Printer {
  constructor(wstream = process.stdout) {
    this.wstream = wstream;
    this.indentation = 0;
    this.lineStart = true;
  }
  endl() {
    this.wstream.write("\n");
    this.lineStart = true;
  }
  indented(fn) {
    this.indentation += 2;
    fn();
    this.indentation -= 2;
  }
  write(x) {
    if (this.lineStart) {
      this.wstream.write(" ".repeat(this.indentation));
      this.lineStart = false;
    }
    this.wstream.write(x);
  }
}

const print = (root, out = new Printer()) => {
  const pr = new FuncMap();

  pr.on("<markright>", (M, process) => {
    for (let i = 0; i < M.content.length; i++) {
      if (i > 0) out.endl();
      process(M.content[i]);
    }
  });

  pr.on("<paragraph>", (P, process) => {
    for (let i = 0; i < P.content.length; i++) {
      process(P.content[i]);
      if (P.content[i] instanceof Line) out.endl();
    }
  });
  
  // <line> can use the default processor

  pr.on("<text>", text => out.write(text));

  pr.on("*", (cmd, process) => {
    out.write(`@${cmd.name}`);
    if (cmd.args) {
      out.write(`(${cmd.args.join(",")})`);
    }
    switch (cmd.type) {
      case Command.INLINE: {
        if (cmd.content) {
          out.write(`${cmd.openDelim}`);
          process(cmd.content);
          out.write(`${cmd.closeDelim}`);
        }
        break;
      }
      case Command.INPARAGRAPH:
      case Command.BLOCK: {
        out.endl();
        out.indented(() => {
          process(cmd.content)
        });
        break;
      }
    }
  });

  walk(root, pr);
};

module.exports = {
  Markright,
  Paragraph,
  Line,
  Command,

  parse,
  parseLine,
  parseFile,
  FuncMap,
  walk,
  print,
};
