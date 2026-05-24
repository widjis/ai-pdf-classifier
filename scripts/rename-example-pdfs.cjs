const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const exampleRoot = path.join(projectRoot, 'example');
const skipDirNames = new Set(['_analysis', '_artifacts']);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const mappingPath = path.join(exampleRoot, '_analysis', `rename_map_${stamp}.json`);

async function walk(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (skipDirNames.has(ent.name)) continue;
      files.push(...(await walk(full)));
      continue;
    }

    if (ent.isFile() && ent.name.toLowerCase().endsWith('.pdf')) {
      files.push(full);
    }
  }

  return files;
}

function randomBaseName() {
  return crypto.randomBytes(12).toString('hex');
}

async function main() {
  const pdfs = await walk(exampleRoot);
  if (pdfs.length === 0) {
    process.stdout.write(`No PDFs found under ${exampleRoot}\n`);
    return;
  }

  const mapping = [];

  for (const fromAbs of pdfs) {
    const dir = path.dirname(fromAbs);
    let toAbs = null;
    for (let i = 0; i < 20; i += 1) {
      const candidate = path.join(dir, `${randomBaseName()}.pdf`);
      if (!fs.existsSync(candidate)) {
        toAbs = candidate;
        break;
      }
    }
    if (!toAbs) throw new Error(`Failed to generate unique name for: ${fromAbs}`);

    await fsp.rename(fromAbs, toAbs);
    mapping.push({
      from: path.relative(exampleRoot, fromAbs),
      to: path.relative(exampleRoot, toAbs),
    });
  }

  await fsp.mkdir(path.dirname(mappingPath), { recursive: true });
  await fsp.writeFile(
    mappingPath,
    JSON.stringify(
      {
        root: 'example',
        createdAt: new Date().toISOString(),
        count: mapping.length,
        mapping,
      },
      null,
      2,
    ),
  );

  process.stdout.write(`Renamed ${mapping.length} PDFs.\nMapping saved to: ${mappingPath}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err?.stack ?? String(err)}\n`);
  process.exitCode = 1;
});

