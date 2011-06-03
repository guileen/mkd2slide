var fs = require('fs'),
    path = require('path'),
    sys = require('sys'),
    hl = require('highlighter').Highlight,
    spawn = require('child_process').spawn;

var md;
try {
  md = require('robotskirt').toHtmlSync;
} catch (e) {
  try {
    md = require('discount').parse;
  } catch (e) {
    md = require('github-flavored-markdown').parse;
  }
}

if (!md) {
  console.log('require a markdown parser, e.g. discount, github-flavored-markdown');
}

exports.run = function(args) {

  var options = {};

  var arg;
  while (arg = args.shift()) {
    switch (arg) {
    case '--html':
      options.html = true;
      break;
    default:
      if (! options.input_filename) {
        options.input_filename = arg;
      } else {
        options.output_filename = arg;
      }
    }
  }

  var text = fs.readFileSync(options.input_filename, 'utf-8');
  var title = getTitle(text);
  var body = slidefy(text);
  var html = makeStaticHtml(title, body);
  var outfile = options.output_filename || options.input_filename.replace(/\.[^\.]*$/, '.pdf');
  if (outfile == args[0]) {
    outfile = outfile + '.pdf';
  }

  var htmlfile = options.input_filename.replace(/\.[^\.]*$/, '.html');
  fs.writeFileSync(htmlfile, html, 'utf-8');

  var proc = spawn('wkhtmltopdf', ['-L', '0', '-R', '0', '-T', '2', '-B', '2', '--page-width', '240', '--page-height', '180', htmlfile, outfile]);
  // proc.stdin.write(html);
  // proc.stdin.end();
  proc.stderr.on('data', function(data) {
      process.stderr.write(data);
  });

  proc.stdout.on('data', function(data) {
      process.stdout.write(data);
  });

};

function makeStaticHtml(title, body, css) {
  css = path.resolve(css || 'style.css');
  var highlight_style = 'github';
  return '<!DOCTYPE HTML>' +
  '<html>' +
  '<head>' +
  '        <meta charset="utf-8">' +
  '        <title>' + title + '</title>' +
  '        <link rel=stylesheet type="text/css" href="' + __dirname + '/' + highlight_style + '.css">' +
  '        <link rel=stylesheet type="text/css" href="' + __dirname + '/style.css">' +
  (path.existsSync(css) ?
    '        <link rel=stylesheet type="text/css" href="' + css + '">' :
    '') +
  '</head>' +
  '<body>' +
  body +
  '</body>' +
  '</html>';
}

function getTitle(text) {
  return text.split('\n', 1)[0].replace(/^#*\s*/, '');
}

function slidefy(text) {
  text = text.replace(/\r\n/g, '\n');
  var lines = text.split('\n');
  var pages = [];
  var curr_page = [];
  var curr_pages = [curr_page];
  var state = 'afterpend';
  var page_num = 0;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    if (curr_page.length > 0 && (/^#+ /.test(line) || /^(-+|=+)$/.test(lines[i + 1]))) {
      pages = pages.concat(curr_pages);
      curr_page = [];
      curr_pages = [curr_page];
      state = 'afterpend';
      page_num = 0;
    }

    var m;
    if (m = /^\+(\+|\d+)\s(.*)/.exec(line)) {
      state = 'afterpend';
      page_num = m[1] == '+' ? curr_pages.length : parseInt(m[1]);
      initPage(page_num);
      line = m[2];
    } else if (m = /^\-(\-|\d+) (.*)$/.exec(line)) {
      state = 'prepend';
      page_num = m[1] == '-' ? curr_pages.length - 1 : parseInt(m[1]);
      initPage(page_num);
      line = m[2];
    }

    if (state == 'prepend') {
      prepend(line, page_num);
    } else if (state == 'afterpend') {
      afterpend(line, page_num);
    }

  }

  pages = pages.concat(curr_pages);

  var ret = '';
  for (var i = 0; i < pages.length; i++) {
    var clz = 'page';
    if (i == 0) {
      clz = 'page first';
    }
    if (i == pages.length - 1) {
      clz = 'page last';
    }
    ret += makePage(pages[i], clz);
  }
  return ret;

  function initPage(num) {
    for (var i = curr_pages.length; i <= num; i++) {
      curr_pages[i] = curr_pages[i - 1].slice();
    }
  }

  function prepend(line, num) {
    for (var i = num || curr_pages.length - 1; i >= 0; i--) {
      curr_pages[i].push(line);
    }
  }

  function afterpend(line, num) {
    for (var i = num || 0; i < curr_pages.length; i++) {
      curr_pages[i].push(line);
    }
  }
}

function makePage(lines, clazz) {
  return '\n<div class="' + clazz + '">\n' + hl(md(lines.join('\n')), false, true) + '\n</div>\n';
}
