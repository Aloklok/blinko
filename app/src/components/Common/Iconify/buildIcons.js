/**
 * Simplified icon build script
 * Scans the project for used icons and extracts them from the Iconify library
 */
import fs from 'fs';
import path from 'path';
import { iconToSVG } from '@iconify/utils';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Icons used in functions or conditional returns that might be hard to detect
// Note: With the new robust scanning, this list can be minimal or empty
const ALWAYS_INCLUDE_ICONS = [
  'lets-icons:check-fill',
  'ci:radio-unchecked',
  'ri:indeterminate-circle-line',
  'hugeicons:ai-chemistry-02'
];

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Project paths - calculation based on script location to be execution-dir independent
const SRC_DIR = path.resolve(__dirname, '../../..');
const APP_ROOT_DIR = path.resolve(SRC_DIR, '..');
const OUTPUT_FILE = path.join(SRC_DIR, 'components', 'Common', 'Iconify', 'icons.tsx');

// Function to find the Iconify JSON library directory
function findIconifyJsonDir() {
  try {
    // Precise way to find the package directory regardless of installation structure
    const packageJsonPath = require.resolve('@iconify/json/package.json');
    return path.dirname(packageJsonPath);
  } catch (err) {
    console.warn('Warning: Could not resolve @iconify/json via require.resolve. Attempting local scan...');

    const paths = [
      path.join(APP_ROOT_DIR, 'node_modules', '@iconify', 'json'),
      path.join(path.resolve(APP_ROOT_DIR, '..'), 'node_modules', '@iconify', 'json'),
    ];

    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }

    throw new Error('CRITICAL: @iconify/json not found. Please ensure @iconify/json is installed in the project.');
  }
}

const ICONIFY_JSON_DIR = findIconifyJsonDir();

// Recursively scan directories for files
function scanDirectory(dir, fileExtensions, result = []) {
  if (!fs.existsSync(dir)) return result;

  const files = fs.readdirSync(dir);

  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist') continue;

    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDirectory(fullPath, fileExtensions, result);
    } else if (fileExtensions.includes(path.extname(file))) {
      result.push(fullPath);
    }
  }

  return result;
}

// Scan project for used icons
function scanProjectIcons() {
  try {
    console.log(`Scanning project at ${SRC_DIR} for icons...`);
    const files = scanDirectory(SRC_DIR, ['.tsx', '.jsx', '.ts', '.js']);

    // Match patterns like "prefix:name" or 'prefix:name'
    // This is broad to capture dynamic usage in ternary ops etc.
    const iconRegex = /\b([a-z0-9-]+):([a-z0-9-]+)\b/g;
    const potentialIcons = new Set();

    for (const file of files) {
      if (file === OUTPUT_FILE) continue;

      const content = fs.readFileSync(file, 'utf8');
      let match;
      iconRegex.lastIndex = 0;
      while ((match = iconRegex.exec(content)) !== null) {
        potentialIcons.add(match[0]);
      }
    }

    console.log(`Found ${potentialIcons.size} potential icon strings`);

    ALWAYS_INCLUDE_ICONS.forEach(iconName => potentialIcons.add(iconName));

    const iconsByCollection = {};
    let foundAnyCollection = false;

    for (const iconName of potentialIcons) {
      const [collection, name] = iconName.split(':');
      if (!collection || !name) continue;

      const collectionPath = path.join(ICONIFY_JSON_DIR, 'json', `${collection}.json`);

      if (fs.existsSync(collectionPath)) {
        if (!iconsByCollection[collection]) {
          iconsByCollection[collection] = new Set();
        }
        iconsByCollection[collection].add(name);
        foundAnyCollection = true;
      }
    }

    if (!foundAnyCollection) {
      console.warn('Scan completed but no icons matching the collections in @iconify/json were found.');
    }

    return iconsByCollection;
  } catch (error) {
    console.error('Error scanning project icons:', error);
    // Rethrow to fail build if it's a path/missing library issue
    throw error;
  }
}

function resolveIcon(iconsData, iconName) {
  if (iconsData.icons && iconsData.icons[iconName]) {
    return iconsData.icons[iconName];
  }
  if (iconsData.aliases && iconsData.aliases[iconName]) {
    const alias = iconsData.aliases[iconName];
    return resolveIcon(iconsData, alias.parent);
  }
  return null;
}

const COLLECTIONS_DIR = path.join(SRC_DIR, 'components', 'Common', 'Iconify', 'collections');

async function extractIcons() {
  const iconsByCollection = scanProjectIcons();

  // Ensure collections directory exists and is clean
  if (fs.existsSync(COLLECTIONS_DIR)) {
    fs.readdirSync(COLLECTIONS_DIR).forEach(file => {
      if (file !== '.gitkeep') fs.unlinkSync(path.join(COLLECTIONS_DIR, file));
    });
  } else {
    fs.mkdirSync(COLLECTIONS_DIR, { recursive: true });
  }

  const collectionsList = [];

  for (const [collection, icons] of Object.entries(iconsByCollection)) {
    try {
      const collectionPath = path.join(ICONIFY_JSON_DIR, 'json', `${collection}.json`);
      if (!fs.existsSync(collectionPath)) continue;

      console.log(`Processing collection ${collection} (${icons.size} icons)...`);
      const iconsData = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));

      const iconSet = {
        prefix: iconsData.prefix || collection,
        icons: {},
        width: iconsData.width || 24,
        height: iconsData.height || 24
      };

      for (const iconName of icons) {
        const resolvedData = resolveIcon(iconsData, iconName);
        if (resolvedData) {
          iconSet.icons[iconName] = resolvedData;
        }
      }

      const collectionFile = path.join(COLLECTIONS_DIR, `${collection}.ts`);
      fs.writeFileSync(collectionFile, `export default ${JSON.stringify(iconSet, null, 2)};`);
      collectionsList.push(collection);
    } catch (err) {
      console.error(`Error processing collection ${collection}:`, err.message);
    }
  }

  // Generate the main component with dynamic loading
  let output = `// This file is auto-generated by buildIcons.js
import * as React from 'react';
import { iconToSVG } from '@iconify/utils';
// Import Iconify Icon as fallback
import { Icon as IconifyIcon } from "@iconify/react";

const collectionCache: Record<string, any> = {};

const loaders: Record<string, () => Promise<any>> = {
${collectionsList.map(c => `  '${c}': () => import('./collections/${c}'),`).join('\n')}
};

// Icon component Props interface
interface IconProps {
  icon: string;
  width?: number | string;
  height?: number | string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
}

// Icon component
export const Icon = ({ 
  icon, 
  width = 24, 
  height = 24, 
  color, 
  className = '', 
  style = {},
  onClick 
}: IconProps) => {
  const [iconData, setIconData] = React.useState<any>(null);
  const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>(icon ? 'loading' : 'error');

  React.useEffect(() => {
    if (!icon) return;
    
    const parts = icon.split(':');
    if (parts.length < 2) {
      setStatus('error');
      return;
    }
    
    const prefix = parts[0];
    const name = parts.slice(1).join(':');
    
    if (!loaders[prefix]) {
      setStatus('error');
      return;
    }

    const loadIcon = async () => {
      try {
        if (!collectionCache[prefix]) {
          const module = await loaders[prefix]();
          collectionCache[prefix] = module.default;
        }
        
        const collection = collectionCache[prefix];
        if (collection && collection.icons && collection.icons[name]) {
          const item = collection.icons[name];
          setIconData({
            body: item.body,
            width: item.width || collection.width || 16,
            height: item.height || collection.height || 16,
          });
          setStatus('loaded');
        } else {
          setStatus('error');
        }
      } catch (err) {
        console.error(\`Failed to load icon \${icon}:\`, err);
        setStatus('error');
      }
    };

    loadIcon();
  }, [icon]);

  if (!icon) return null;
  
  // Use Iconify fallback if not found locally or error
  if (status === 'error') {
    return <IconifyIcon 
      icon={icon}
      width={width}
      height={height}
      color={color}
      className={className}
      style={style}
      onClick={onClick}
    />;
  }
  
  if (status === 'loading' || !iconData) {
    return <div 
      style={{ 
        width: typeof width === 'number' ? \`\${width}px\` : width, 
        height: typeof height === 'number' ? \`\${height}px\` : height,
        display: 'inline-block',
        ...style 
      }} 
      className={className}
    />;
  }
  
  const renderData = iconToSVG(iconData, {
    width: typeof width === 'number' ? width.toString() : width || '24',
    height: typeof height === 'number' ? height.toString() : height || '24',
  });
  
  const svgAttributes = {
    width,
    height,
    viewBox: renderData.attributes.viewBox,
    className,
    style: {
      ...style,
      color: color
    },
    dangerouslySetInnerHTML: { __html: renderData.body },
    onClick,
  };
  
  return <svg {...svgAttributes} />;
};

export default Icon;
`;

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`Icons system re-generated successfully at ${OUTPUT_FILE}`);
}

extractIcons();

extractIcons();