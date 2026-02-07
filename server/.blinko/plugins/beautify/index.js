System.register([], function (exports) {
    'use strict';
    return {
        execute: function () {
            class BeautifyPlugin {
                constructor() {
                    this.name = 'beautify';
                    this.withSettingPanel = true;
                    this.DEFAULT_PROMPT = `# 角色
你是一位精致的 Markdown 笔记美化管家。你的核心原则是：**内容原封不动，仅做结构点缀**。

# 核心指令：零改动原则 (Critical)
 **文字镜像**：严禁修改、删减、挪动用户原始笔记中的任何一个内容字。必须保持 1:1 的原文还原。


# 任务：多层级标题点缀
1.  **置顶总览标题**：
    - 在笔记的最开头，根据**全文内容**生成总览标题。
    - 格式：\`#### [1个Emoji] [总览文字]\` 。
2.  **五级分段标题**：
    - 在笔记内部的主题分段处，添加五级标题（#####）。
    - 格式：\`##### [1个Emoji] [分段文字]\`。
    - 风格：小巧精致，不干扰阅读。


# ❌ 禁令
- **严禁解释**：不要输出开场白、解释语或自我总结。`;
                }

                renderSettingPanel = () => {
                    const Blinko = window.Blinko;
                    const container = document.createElement('div');
                    container.className = 'p-4 flex flex-col gap-4';

                    const label = document.createElement('label');
                    label.innerText = 'AI 美化 Prompt 设定';
                    label.className = 'text-sm font-bold text-default-700';
                    container.appendChild(label);

                    const textarea = document.createElement('textarea');
                    textarea.className = 'w-full h-48 p-3 text-sm border border-default-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-default-50 dark:bg-default-100/10';
                    textarea.placeholder = '输入美化指令...';
                    textarea.value = this.config.prompt || this.DEFAULT_PROMPT;
                    container.appendChild(textarea);

                    const desc = document.createElement('p');
                    desc.innerText = '在此处修改 AI 美化笔记时遵循的角色设定与规则。';
                    desc.className = 'text-xs text-default-500';
                    container.appendChild(desc);

                    const saveBtn = document.createElement('button');
                    saveBtn.innerText = '保存配置';
                    saveBtn.className = 'h-10 px-4 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors self-end';
                    saveBtn.onclick = async () => {
                        try {
                            saveBtn.disabled = true;
                            saveBtn.innerText = '保存中...';
                            await this.updateConfig({ prompt: textarea.value });
                            Blinko.toast.success('Prompt 配置已成功存储并即时生效 ✨');
                        } catch (err) {
                            Blinko.toast.error('保存失败: ' + err.message);
                        } finally {
                            saveBtn.disabled = false;
                            saveBtn.innerText = '保存配置';
                        }
                    };
                    container.appendChild(saveBtn);

                    return container;
                }

                init() {
                    const Blinko = window.Blinko;
                    if (!Blinko) return;

                    console.log('✨ Blinko 美化插件 (Decoupled Official Stream Mode) 已启动');

                    const findActiveEditor = () => {
                        const vditor = document.querySelector('.vditor');
                        if (vditor) {
                            let cur = vditor;
                            while (cur && cur !== document.body) {
                                if (cur.__storeInstance) return cur.__storeInstance;
                                cur = cur.parentElement;
                            }
                        }
                        return Blinko.getActiveEditorStore ? Blinko.getActiveEditorStore() : null;
                    };

                    /**
                     * 运行美化逻辑 (流式)
                     */
                    const runBeautify = async (content, onResult) => {
                        if (!content || !content.trim()) {
                            Blinko.toast.error('内容为空');
                            return;
                        }

                        let toastId;
                        try {
                            toastId = Blinko.toast.loading('AI 美化中...');

                            const res = await Blinko.streamApi.ai.completions.mutate({
                                question: `请严格美化以下内容：\n\n${content}`,
                                withTools: false,
                                withOnline: false,
                                withRAG: false,
                                conversations: [],
                                systemPrompt: this.config.prompt || this.DEFAULT_PROMPT
                            });

                            let fullText = "";
                            for await (const item of res) {
                                if (item.chunk?.type === 'text-delta') {
                                    fullText += item.chunk.textDelta;
                                } else if (item.chunk?.type === 'error') {
                                    throw new Error(item.chunk.error?.message || 'AI 响应错误');
                                }
                            }

                            Blinko.toast.dismiss(toastId);

                            if (fullText.trim()) {
                                onResult(fullText.trim());
                            } else {
                                Blinko.toast.error('AI 未能返回有效内容');
                            }
                        } catch (err) {
                            if (toastId) Blinko.toast.dismiss(toastId);
                            console.error('Beautify Stream Error:', err);
                            Blinko.toast.error(err.message || '请求失败，请检查配置');
                        }
                    };

                    // --- UI 集成 ---

                    Blinko.addRightClickMenu({
                        name: 'beautify-card',
                        label: '✨ 美化笔记',
                        icon: 'hugeicons:ai-beautify',
                        onClick: (note) => {
                            runBeautify(note.content, (res) => {
                                if (Blinko.openEditor) {
                                    Blinko.openEditor(note, res);
                                    Blinko.toast.success('美化完毕，已载入编辑器 ✨');
                                } else {
                                    // 回退逻辑：如果基座还没更新，提示刷新
                                    Blinko.toast.error('请刷新页面以同步基座接口');
                                }
                            });
                        }
                    });

                    Blinko.addToolBarIcon({
                        name: 'beautify-toolbar',
                        icon: 'hugeicons:ai-beautify',
                        tooltip: '一键美化',
                        onClick: () => {
                            const editor = findActiveEditor();
                            if (editor) {
                                const currentContent = editor.vditor ? editor.vditor.getValue() : (editor.content || '');
                                runBeautify(currentContent, (newContent) => {
                                    Blinko.eventBus.emit('editor:replace', newContent);
                                    Blinko.toast.success('美化完成 ✨');
                                });
                            } else {
                                Blinko.toast.error('请先聚焦编辑器');
                            }
                        }
                    });

                }

                destroy() {
                    console.log('✨ Blinko 美化插件已卸载');
                }
            }

            exports('default', BeautifyPlugin);
        }
    };
});
