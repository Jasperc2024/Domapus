
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const brotli = promisify(zlib.brotliCompress);

const DIST_DIR = path.join(__dirname, '../dist');
const EXTENSIONS_TO_COMPRESS = ['.js', '.css', '.json', '.geojson', '.svg', '.html'];

async function compressFile(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    
    // Generate Gzip version
    const gzipData = await gzip(data, { level: 9 });
    fs.writeFileSync(`${filePath}.gz`, gzipData);
    
    // Generate Brotli version
    const brotliData = await brotli(data, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length,
      },
    });
    fs.writeFileSync(`${filePath}.br`, brotliData);
    
    const originalSize = data.length;
    const gzipSize = gzipData.length;
    const brotliSize = brotliData.length;
    
    console.log(`Compressed ${path.relative(DIST_DIR, filePath)}:`);
    console.log(`  Original: ${(originalSize / 1024).toFixed(1)}KB`);
    console.log(`  Gzip: ${(gzipSize / 1024).toFixed(1)}KB (${((1 - gzipSize / originalSize) * 100).toFixed(1)}% reduction)`);
    console.log(`  Brotli: ${(brotliSize / 1024).toFixed(1)}KB (${((1 - brotliSize / originalSize) * 100).toFixed(1)}% reduction)`);
  } catch (error) {
    console.error(`Error compressing ${filePath}:`, error);
  }
}

function findFilesToCompress(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findFilesToCompress(fullPath));
    } else if (EXTENSIONS_TO_COMPRESS.some(ext => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error('Dist directory does not exist. Run build first.');
    process.exit(1);
  }
  
  console.log('Finding files to compress...');
  const filesToCompress = findFilesToCompress(DIST_DIR);
  
  console.log(`Found ${filesToCompress.length} files to compress`);
  
  for (const file of filesToCompress) {
    await compressFile(file);
  }
  
  console.log('Compression complete!');
}

main().catch(console.error);
