/**
 * Vditor 差量补丁脚本
 *
 * 在 bun install 后自动执行，对 node_modules/vditor/dist/index.js
 * 做精准字符串替换。无需维护完整的 0.7MB 快照。
 *
 * 新增补丁：在本文件末尾按格式添加 PATCH_N_OLD / PATCH_N_NEW 对即可。
 */

const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '../node_modules/vditor/dist/index.js');

if (!fs.existsSync(target)) {
  console.log('[vditor-patch] vditor not installed, skipping');
  process.exit(0);
}

let code = fs.readFileSync(target, 'utf-8');
let applied = 0;

// ================================================================
// Patch 1: ordered-list 新建时向前查找同级 ol 合并编号
// 场景：从 <p> 点击 ordered-list，如果前面有同级的 <ol> 且无分隔符，则合并
// ================================================================
const PATCH_1_OLD = [
  '            else if (type === "ordered-list") {',
  '                blockElement.insertAdjacentHTML("beforebegin", "<ol data-block=\\"0\\"><li>".concat(blockElement.innerHTML, "</li></ol>"));',
  '                blockElement.remove();',
  '            }',
].join('\n');

const PATCH_1_NEW = [
  '            else if (type === "ordered-list") {',
  '                var prevOl = blockElement.previousElementSibling;',
  '                while (prevOl && (prevOl.tagName === "UL" || prevOl.tagName === "OL")) {',
  '                    if (prevOl.tagName === "OL" && prevOl.getAttribute("data-block") === "0") {',
  '                        prevOl.insertAdjacentHTML("beforeend", "<li>".concat(blockElement.innerHTML, "</li>"));',
  '                        blockElement.remove();',
  '                        return;',
  '                    }',
  '                    prevOl = prevOl.previousElementSibling;',
  '                }',
  '                blockElement.insertAdjacentHTML("beforebegin", "<ol data-block=\\"0\\"><li>".concat(blockElement.innerHTML, "</li></ol>"));',
  '                blockElement.remove();',
  '            }',
].join('\n');

if (code.includes(PATCH_1_OLD)) {
  code = code.replace(PATCH_1_OLD, PATCH_1_NEW);
  applied++;
  console.log('[vditor-patch] 1/5: ordered-list merge into previous ol');
} else if (code.includes(PATCH_1_NEW)) {
  console.log('[vditor-patch] 1/5: already applied, skip');
} else {
  console.error('[vditor-patch] ERROR: Patch 1 anchor not found — Vditor version may have changed');
}

// ================================================================
// Patch 2: 注释标注 — 只修改当前选中的 li
// ================================================================
const PATCH_2_OLD = '            // 切换';
const PATCH_2_NEW = '            // 切换 - 只修改当前选中的 li';

if (code.includes(PATCH_2_OLD)) {
  code = code.replace(PATCH_2_OLD, PATCH_2_NEW);
  applied++;
  console.log('[vditor-patch] 2/5: comment updated');
} else if (code.includes(PATCH_2_NEW)) {
  console.log('[vditor-patch] 2/5: already applied, skip');
} else {
  console.error('[vditor-patch] ERROR: Patch 2 anchor not found');
}

// ================================================================
// Patch 3: check 切换 — 仅影响当前项，不遍历所有兄弟
// ================================================================
const PATCH_3_OLD = [
  '                itemElement.parentElement.querySelectorAll("li").forEach(function (item) {',
  '                    item.insertAdjacentHTML("afterbegin", "<input type=\\"checkbox\\" />".concat(item.textContent.indexOf(" ") === 0 ? "" : " "));',
  '                    item.classList.add("vditor-task");',
  '                });',
].join('\n');

const PATCH_3_NEW = [
  '                if (!itemElement.querySelector("input")) {',
  '                    itemElement.insertAdjacentHTML("afterbegin", "<input type=\\"checkbox\\" />".concat(itemElement.textContent.indexOf(" ") === 0 ? "" : " "));',
  '                    itemElement.classList.add("vditor-task");',
  '                }',
].join('\n');

if (code.includes(PATCH_3_OLD)) {
  code = code.replace(PATCH_3_OLD, PATCH_3_NEW);
  applied++;
  console.log('[vditor-patch] 3/5: check toggle only current item');
} else if (code.includes(PATCH_3_NEW)) {
  console.log('[vditor-patch] 3/5: already applied, skip');
} else {
  console.error('[vditor-patch] ERROR: Patch 3 anchor not found');
}

// ================================================================
// Patch 4: 取消 check — 仅影响当前项
// ================================================================
const PATCH_4_OLD = [
  '                    itemElement.parentElement.querySelectorAll("li").forEach(function (item) {',
  '                        item.querySelector("input").remove();',
  '                        item.classList.remove("vditor-task");',
  '                    });',
].join('\n');

const PATCH_4_NEW = [
  '                    itemElement.querySelector("input")?.remove();',
  '                    itemElement.classList.remove("vditor-task");',
].join('\n');

if (code.includes(PATCH_4_OLD)) {
  code = code.replace(PATCH_4_OLD, PATCH_4_NEW);
  applied++;
  console.log('[vditor-patch] 4/5: uncheck only current item');
} else if (code.includes(PATCH_4_NEW)) {
  console.log('[vditor-patch] 4/5: already applied, skip');
} else {
  console.error('[vditor-patch] ERROR: Patch 4 anchor not found');
}

// ================================================================
// Patch 5: 列表类型切换 — 拆分当前项 + 同级 ol 合并 + 已在 ol 中跳过重组
// ================================================================
const PATCH_5_OLD = [
  '                var element = void 0;',
  '                if (type === "list") {',
  '                    element = document.createElement("ul");',
  '                    element.setAttribute("data-marker", "*");',
  '                }',
  '                else {',
  '                    element = document.createElement("ol");',
  '                    element.setAttribute("data-marker", "1.");',
  '                }',
  '                element.setAttribute("data-block", "0");',
  "                element.setAttribute(\"data-tight\", itemElement.parentElement.getAttribute(\"data-tight\"));",
  '                element.innerHTML = itemElement.parentElement.innerHTML;',
  "                itemElement.parentElement.parentNode.replaceChild(element, itemElement.parentElement);",
].join('\n');

const PATCH_5_NEW = [
  '                // 如果已在 ol 中且目标就是 ordered-list，已完成（仅去掉了 checkbox）',
  "                if (!(type === \"ordered-list\" && itemElement.parentElement.tagName === \"OL\")) {",
  '                    // 始终拆分当前项到新类型列表，不影响其他 li',
  '                    var parent = itemElement.parentElement;',
  '                    var targetOl = null;',
  '                    if (type === "ordered-list") {',
  '                        var prev = parent.previousElementSibling;',
  '                        while (prev && (prev.tagName === "UL" || prev.tagName === "OL")) {',
  '                            if (prev.tagName === "OL" && prev.getAttribute("data-block") === "0") {',
  '                                targetOl = prev;',
  '                                break;',
  '                            }',
  '                            prev = prev.previousElementSibling;',
  '                        }',
  '                    }',
  '                    if (targetOl) {',
  '                        targetOl.insertAdjacentHTML("beforeend", "<li>".concat(itemElement.innerHTML, "</li>"));',
  '                        itemElement.remove();',
  '                        if (parent.children.length === 0) {',
  '                            parent.remove();',
  '                        }',
  '                        // 合并之后检查下一个兄弟是否也为 ol，是则继续合并',
  '                        var nextOl = targetOl.nextElementSibling;',
  '                        while (nextOl && nextOl.tagName === "OL" && nextOl.getAttribute("data-block") === "0") {',
  '                            while (nextOl.firstChild) {',
  '                                targetOl.appendChild(nextOl.firstChild);',
  '                            }',
  '                            var toRemove = nextOl;',
  '                            nextOl = targetOl.nextElementSibling;',
  '                            toRemove.remove();',
  '                        }',
  '                    }',
  '                    else {',
  '                        var newElement = void 0;',
  '                        if (type === "list") {',
  '                            newElement = document.createElement("ul");',
  '                            newElement.setAttribute("data-marker", "*");',
  '                        }',
  '                        else {',
  '                            newElement = document.createElement("ol");',
  '                            newElement.setAttribute("data-marker", "1.");',
  '                        }',
  '                        newElement.setAttribute("data-block", "0");',
  "                        newElement.setAttribute(\"data-tight\", parent.getAttribute(\"data-tight\"));",
  "                        newElement.appendChild(itemElement.cloneNode(true));",
  '                        if (parent.children.length === 1) {',
  '                            // 只有一个项，直接替换父容器',
  "                            parent.parentNode.replaceChild(newElement, parent);",
  '                        }',
  '                        else {',
  '                            // 有多个项：拆分列表，之后项移到新列表',
  '                            var afterHTML = "";',
  '                            var next = itemElement.nextElementSibling;',
  '                            while (next) {',
  '                                var temp = next.nextElementSibling;',
  '                                afterHTML += next.outerHTML;',
  '                                next.remove();',
  '                                next = temp;',
  '                            }',
  "                            parent.parentNode.insertBefore(newElement, parent.nextSibling);",
  '                            itemElement.remove();',
  '                            if (afterHTML) {',
  "                                newElement.insertAdjacentHTML(\"afterend\", \"<\".concat(parent.tagName, \" data-block=\\\"0\\\">\").concat(afterHTML, \"</\").concat(parent.tagName, \">\"));",
  '                            }',
  '                        }',
  '                    }',
  '                }',
].join('\n');

if (code.includes(PATCH_5_OLD)) {
  code = code.replace(PATCH_5_OLD, PATCH_5_NEW);
  applied++;
  console.log('[vditor-patch] 5/5: split + merge + skip-restructure logic');
} else if (code.includes(PATCH_5_NEW)) {
  console.log('[vditor-patch] 5/5: already applied, skip');
} else {
  console.error('[vditor-patch] ERROR: Patch 5 anchor not found');
}
// ================================================================
// Patch 6: 取消列表时仅影响当前项（键盘快捷键 Ctrl+L 用）
// ================================================================
const PATCH_6_OLD = [
  '    if (cancel && itemElement) {',
  '        // 取消',
  '        var pHTML = "";',
  '        for (var i = 0; i < itemElement.parentElement.childElementCount; i++) {',
  '            var inputElement = itemElement.parentElement.children[i].querySelector("input");',
  '            if (inputElement) {',
  '                inputElement.remove();',
  '            }',
  "            pHTML += \"<p data-block=\\\"0\\\">\".concat(itemElement.parentElement.children[i].innerHTML.trimLeft(), \"</p>\");",
  '        }',
  '        itemElement.parentElement.insertAdjacentHTML("beforebegin", pHTML);',
  '        itemElement.parentElement.remove();',
  '    }',
].join('\n');

const PATCH_6_NEW = [
  '    if (cancel && itemElement) {',
  '        // 取消 — 仅影响当前项',
  '        if (itemElement.classList.contains("vditor-task")) {',
  '            // 任务清单：去掉 checkbox',
  "            itemElement.querySelector(\"input\")?.remove();",
  '            itemElement.classList.remove("vditor-task");',
  '            var taskParent = itemElement.parentElement;',
  '            // 嵌套列表（父 ul 在另一个 li 内）只去 checkbox，不转 <p>',
  "            if (taskParent.parentElement.tagName !== \"LI\") {",
  '            if (taskParent.children.length === 1) {',
  "                taskParent.insertAdjacentHTML(\"beforebegin\", \"<p data-block=\\\"0\\\">\".concat(itemElement.innerHTML.trimLeft(), \"</p>\"));",
  '                taskParent.remove();',
  '            } else {',
  '                var afterHTML = "";',
  '                var nextEl = itemElement.nextElementSibling;',
  '                while (nextEl) {',
  '                    var temp = nextEl.nextElementSibling;',
  '                    afterHTML += nextEl.outerHTML;',
  '                    nextEl.remove();',
  '                    nextEl = temp;',
  '                }',
  "                itemElement.insertAdjacentHTML(\"afterend\", \"<p data-block=\\\"0\\\">\".concat(itemElement.innerHTML.trimLeft(), \"</p>\"));",
  '                itemElement.remove();',
  '                if (afterHTML) {',
  '                    var tag = taskParent.tagName;',
  "                    taskParent.insertAdjacentHTML(\"afterend\", \"<\".concat(tag, \" data-block=\\\"0\\\">\").concat(afterHTML, \"</\").concat(tag, \">\"));",
  '                }',
  '            }',
  '            }',
  '        } else {',
  '            var parentList = itemElement.parentElement;',
  '            if (parentList.children.length === 1) {',
  "                parentList.insertAdjacentHTML(\"beforebegin\", \"<p data-block=\\\"0\\\">\".concat(itemElement.innerHTML.trimLeft(), \"</p>\"));",
  '                parentList.remove();',
  '            } else {',
  '                // 多项：拆分列表，当前项之后的所有项收集到新列表',
  '                var afterHTML = "";',
  '                var nextEl = itemElement.nextElementSibling;',
  '                while (nextEl) {',
  '                    var temp = nextEl.nextElementSibling;',
  '                    afterHTML += nextEl.outerHTML;',
  '                    nextEl.remove();',
  '                    nextEl = temp;',
  '                }',
  "                itemElement.insertAdjacentHTML(\"afterend\", \"<p data-block=\\\"0\\\">\".concat(itemElement.innerHTML.trimLeft(), \"</p>\"));",
  '                itemElement.remove();',
  '                if (afterHTML) {',
  '                    var tag = parentList.tagName;',
  "                    parentList.insertAdjacentHTML(\"afterend\", \"<\".concat(tag, \" data-block=\\\"0\\\">\").concat(afterHTML, \"</\").concat(tag, \">\"));",
  '                }',
  '            }',
  '        }',
  '    }',
].join('\n');

if (code.includes(PATCH_6_OLD)) {
  code = code.replace(PATCH_6_OLD, PATCH_6_NEW);
  applied++;
  console.log('[vditor-patch] 6/6: cancel only current item');
} else if (code.includes(PATCH_6_NEW)) {
  console.log('[vditor-patch] 6/6: already applied, skip');
} else {
  console.error('[vditor-patch] ERROR: Patch 6 anchor not found');
}

// ================================================================
// Write back
// ================================================================
if (applied > 0) {
  fs.writeFileSync(target, code);
  console.log(`[vditor-patch] Done — ${applied} patch(es) applied`);

  // Clear Vite pre-bundle caches (both root and app level)
  const viteDirs = [
    path.resolve(__dirname, '../node_modules/.vite/deps'),
    path.resolve(__dirname, '../app/node_modules/.vite/deps'),
  ];
  viteDirs.forEach(dir => {
    // Nuke metadata to force full re-optimization
    const metaFile = path.join(dir, '_metadata.json');
    if (fs.existsSync(metaFile)) {
      fs.unlinkSync(metaFile);
      console.log(`[vditor-patch] Nuked ${metaFile}`);
    }
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).filter(f => f.startsWith('vditor') || f.startsWith('_vditor')).forEach(f => {
        fs.unlinkSync(path.join(dir, f));
        console.log(`[vditor-patch] Cleared Vite cache: ${f}`);
      });
    }
  });
} else {
  console.log('[vditor-patch] No patches needed');
}
