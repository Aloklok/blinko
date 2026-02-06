
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
                    groupNames.push(groupMatch[1]);
                }
            }

            newPattern = newPattern.replace(/\(\?<[a-zA-Z_][a-zA-Z0-9_]*>/g, '(');

            for (let i = 0; i < groupNames.length; i++) {
                const backrefPatterns = [
                    new RegExp(`\\\\\\\\k<${groupNames[i]}>`, 'g'),
                    new RegExp(`\\\\k<${groupNames[i]}>`, 'g'),
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
        enforce: 'post', // Run after other transforms

        // Specific transform for known problematic libraries
        transform(code, id) {
            // 1. Patch mdast-util-gfm-autolink-literal
            if (id.includes('mdast-util-gfm-autolink-literal') && id.endsWith('.js')) {
                // Original: (?<=^|\s|\p{P}|\p{S})([-.\\w+]+)@([-\\w]+(?:\\.[-\\w]+)+)
                // Problem: Lookbehind (?<=...) not supported in Safari 15
                const emailRegexOld = '(?<=^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@([-\\w]+(?:\\.[-\\w]+)+)';
                const emailRegexNew = '([-.\\w+]+)@([-\\w]+(?:\\.[-\\w]+)+)';

                if (code.includes(emailRegexOld)) {
                    console.log(`[regex-compat] Patching mdast-util-gfm-autolink-literal in ${id}`);
                    let newCode = code.replace(emailRegexOld, emailRegexNew);
                    newCode = newCode.replace(/\/gu,\s*findEmail/g, '/g, findEmail');
                    return { code: newCode, map: null };
                }
            }

            // 2. Patch marked (blockSkip regex)
            if (id.includes('marked') && (id.endsWith('.esm.js') || id.endsWith('.umd.js') || id.endsWith('.js'))) {
                let modified = false;
                let newCode = code;

                // Problem: Lookbehind (?<!`) and Named Groups (?<a>...) and Backreferences \k<a>
                // Target 1: (?<!`)(?<a>`+)[^`]+\k<a>(?!`)
                const link1 = '(?<!`)(?<a>`+)[^`]+\\k<a>(?!`)';
                const link1Fixed = '(`+)[^`]+\\1(?!`)';

                if (newCode.includes(link1)) {
                    console.log(`[regex-compat] Patching marked (link regex) in ${id}`);
                    newCode = newCode.replace(link1, link1Fixed);
                    modified = true;
                }

                // Target 2: (?<!`)(?<b>`+)[^`]+\k<b>(?!`)
                const code1 = '(?<!`)(?<b>`+)[^`]+\\k<b>(?!`)';
                const code1Fixed = '(`+)[^`]+\\1(?!`)';

                if (newCode.includes(code1)) {
                    console.log(`[regex-compat] Patching marked (code regex) in ${id}`);
                    newCode = newCode.replace(code1, code1Fixed);
                    modified = true;
                }

                if (modified) {
                    return { code: newCode, map: null };
                }
            }

            return null;
        },

        renderChunk(code, chunk) {
            const hasNamedGroups = /\(\?<[a-zA-Z_][a-zA-Z0-9_]*>/.test(code);
            const hasLookbehind = /\(\?<[=!]/.test(code);

            if (!hasNamedGroups && !hasLookbehind) {
                return null;
            }

            let result = code;

            if (hasNamedGroups) {
                result = transformRegexLiterals(result);
            }

            // Force Lookbehind detection to fail in the bundle (for libraries like marked and vditor)
            // We search for patterns that looks like feature detection
            result = result.replace(/new\s+RegExp\s*\(\s*([`"'])(\(\?<=a\)b|\(\?<=1\)\(\?<!1\))\1\s*\)/g, '(()=>{throw 1})()');

            result = transformRegExpConstructor(result);

            return {
                code: result,
                map: null,
            };
        }
    };
}
