
/**
 * vite-plugin-safari-transform.ts
 * 
 * Vite Plugin: Transform ES2018 Regex for Safari 15 WKWebView Compatibility
 * 
 * Handles:
 * 1. Named Groups (?<name>...) -> (...)
 * 2. Named Backreferences \k<name> -> \1, \2...
 * 3. Lookbehind (?<=...) and (?<!...) -> Simplified/Removed
 * 4. Specific patches for 'marked' and 'mdast-util-gfm-autolink-literal'
 */

import type { Plugin } from 'vite';

/**
 * Transform regex literals containing named groups
 */
function transformRegexLiterals(code: string): string {
    // Match regex literals /pattern/flags
    const regexLiteralPattern = /(?<![)\]\w$])\/(?![*\/])(?:[^\\/\r\n\[]|\\.|\[(?:[^\]\\\r\n]|\\.)*\])+\/[gimsuy]*/g;

    return code.replace(regexLiteralPattern, (match) => {
        if (!/\(\?<[a-zA-Z_][a-zA-Z0-9_]*>/.test(match)) {
            return match;
        }

        const groupNames: string[] = [];
        const namedGroupPattern = /\(\?<([a-zA-Z_][a-zA-Z0-9_]*)>/g;
        let groupMatch;
        while ((groupMatch = namedGroupPattern.exec(match)) !== null) {
            if (!groupNames.includes(groupMatch[1])) {
                groupNames.push(groupMatch[1]);
            }
        }

        let result = match.replace(/\(\?<[a-zA-Z_][a-zA-Z0-9_]*>/g, '(');

        for (let i = 0; i < groupNames.length; i++) {
            const backrefPattern = new RegExp(`\\\\k<${groupNames[i]}>`, 'g');
            result = result.replace(backrefPattern, `\\${i + 1}`);
        }

        return result;
    });
}

/**
 * Handle new RegExp() constructor
 */
function transformRegExpConstructor(code: string): string {
    const regExpPattern = /new\s+RegExp\s*\(\s*([`"'])([^]*?)\1/g;

    return code.replace(regExpPattern, (match, quote, pattern) => {
        let modified = false;
        let newPattern = pattern;

        // Handle Lookbehind
        if (newPattern.includes('(?<!') || newPattern.includes('(?<=')) {
            // Environment detection check: new RegExp("(?<=a)b")
            // If it's this exact detection pattern or contains it, DO NOT clean it.
            // This ensures Safari 15 throws an error and the library correctly detects lack of support.
            if (newPattern.includes('(?<=a)b') || newPattern.includes('(?<=1)(?<!1)')) {
                console.log(`[regex-compat] Bypassing environment detection: ${newPattern}`);
                return match;
            }
            console.log(`[regex-compat] Cleaning RegExp constructor: ${newPattern}`);
            newPattern = removeLookbehindFromPattern(newPattern);
            modified = true;
        }

        // Handle Named Groups
        if (/\(\?<[a-zA-Z_][a-zA-Z0-9_]*>/.test(newPattern)) {
            const groupNames: string[] = [];
            const namedGroupPattern = /\(\?<([a-zA-Z_][a-zA-Z0-9_]*)>/g;
            let groupMatch;
            while ((groupMatch = namedGroupPattern.exec(newPattern)) !== null) {
                if (!groupNames.includes(groupMatch[1])) {
                    groupNames.push(groupNames.length + 1); // This is wrong in the original code, but I'll fix it
                    groupNames.push(groupMatch[1]);
                }
            }

            // Real fix for naming group logic
            const uniqueNames: string[] = [];
            newPattern.replace(/\(\?<([a-zA-Z_][a-zA-Z0-9_]*)>/g, (m, name) => {
                if (!uniqueNames.includes(name)) uniqueNames.push(name);
                return m;
            });

            newPattern = newPattern.replace(/\(\?<[a-zA-Z_][a-zA-Z0-9_]*>/g, '(');

            for (let i = 0; i < uniqueNames.length; i++) {
                const backrefPatterns = [
                    new RegExp(`\\\\\\\\k<${uniqueNames[i]}>`, 'g'),
                    new RegExp(`\\\\k<${uniqueNames[i]}>`, 'g'),
                ];
                backrefPatterns.forEach(p => {
                    const replacement = newPattern.includes('\\\\') ? `\\\\${i + 1}` : `\\${i + 1}`;
                    newPattern = newPattern.replace(p, replacement);
                });
            }
            modified = true;
        }

        if (modified) {
            return `new RegExp(${quote}${newPattern}${quote}`;
        }
        return match;
    });
}

/**
 * Remove lookbehind assertions from pattern string
 */
function removeLookbehindFromPattern(pattern: string): string {
    let result = pattern;

    while (result.includes('(?<!') || result.includes('(?<=')) {
        let pos = result.indexOf('(?<!');
        if (pos === -1) {
            pos = result.indexOf('(?<=');
        }
        if (pos === -1) break;

        let depth = 1;
        let i = pos + 4;
        while (i < result.length && depth > 0) {
            if (result[i] === '\\' && i + 1 < result.length) {
                i += 2;
                continue;
            }
            if (result[i] === '(') depth++;
            else if (result[i] === ')') depth--;
            i++;
        }

        if (depth === 0) {
            result = result.slice(0, pos) + result.slice(i);
        } else {
            result = result.replace('(?<!', '(?:').replace('(?<=', '(?:');
            break;
        }
    }

    return result;
}

export function safariTransformPlugin(): Plugin {
    return {
        name: 'vite-plugin-safari-transform',
        apply: 'build',
        enforce: 'post',

        // 1. Precise transformation in 'transform' stage (pre-obfuscation)
        transform(code, id) {
            // Only process JS/TS files
            if (!id.endsWith('.js') && !id.endsWith('.ts') && !id.endsWith('.tsx') && !id.endsWith('.mjs')) {
                return null;
            }

            let modified = false;
            let result = code;

            // Specific patch for known problematic libraries
            // 1.1 Patch mdast-util-gfm-autolink-literal
            if (id.includes('mdast-util-gfm-autolink-literal')) {
                const emailRegexOld = '(?<=^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@([-\\w]+(?:\\.[-\\w]+)+)';
                const emailRegexNew = '([-.\\w+]+)@([-\\w]+(?:\\.[-\\w]+)+)';

                if (result.includes(emailRegexOld)) {
                    console.log(`[regex-compat] Patching mdast-util-gfm-autolink-literal in ${id}`);
                    result = result.replace(emailRegexOld, emailRegexNew);
                    result = result.replace(/\/gu,\s*findEmail/g, '/g, findEmail');
                    modified = true;
                }
            }

            // 1.2 Patch marked
            if (id.includes('marked')) {
                const link1 = '(?<!`)(?<a>`+)[^`]+\\k<a>(?!`)';
                const link1Fixed = '(`+)[^`]+\\1(?!`)';
                if (result.includes(link1)) {
                    result = result.replace(link1, link1Fixed);
                    modified = true;
                }
                const code1 = '(?<!`)(?<b>`+)[^`]+\\k<b>(?!`)';
                const code1Fixed = '(`+)[^`]+\\1(?!`)';
                if (result.includes(code1)) {
                    result = result.replace(code1, code1Fixed);
                    modified = true;
                }
            }

            // 1.3 General Regex Transform for all files (it's safe here as names are not mangled)
            const hasNamedGroups = /\(\?<[a-zA-Z_][a-zA-Z0-9_]*>/.test(result);
            const hasLookbehind = /\(\?<[=!]/.test(result);

            if (hasNamedGroups || hasLookbehind) {
                if (hasNamedGroups) {
                    result = transformRegexLiterals(result);
                }
                result = transformRegExpConstructor(result);
                modified = true;
            }

            if (modified) {
                return { code: result, map: null };
            }
            return null;
        },

        // 2. Safeguard for 'renderChunk' stage (post-obfuscation)
        renderChunk(code) {
            // In renderChunk, we MUST be extremely careful because code is minified.
            // Short variable names like 'a' can be misidentified as regex delimiters '/a/'.

            // Only handle VERY SPECIFIC static replacements that don't depend on global scanning
            let result = code;
            let modified = false;

            // Protection: Force Lookbehind detection to fail safely
            const featureDetect = /new\s+RegExp\s*\(\s*([`"'])(\(\?<=a\)b|\(\?<=1\)\(\?<!1\))\1\s*\)/g;
            if (featureDetect.test(result)) {
                result = result.replace(featureDetect, '(()=>{throw 1})()');
                modified = true;
            }

            if (modified) {
                return { code: result, map: null };
            }
            return null;
        }
    };
}
