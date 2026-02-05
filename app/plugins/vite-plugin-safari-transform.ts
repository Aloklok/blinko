
/**
 * vite-plugin-safari-transform.ts
 * 
 * Vite Plugin: Transform ES2018 Regex for Safari 15 WKWebView Compatibility
 * 
 * Handles:
 * 1. Named Groups (?<name>...) -> (...)
 * 2. Named Backreferences \k<name> -> \1, \2...
 * 3. Lookbehind (?<=...) and (?<!...) -> Simplified/Removed
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

            result = transformRegExpConstructor(result);

            return {
                code: result,
                map: null,
            };
        }
    };
}
