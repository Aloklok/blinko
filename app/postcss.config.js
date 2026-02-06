export default {
    plugins: {
        'postcss-preset-env': {
            stage: 2, // 从 stage 3 改为 stage 2，包含更广泛的 polyfills
            features: {
                'color-mix': { preserve: false }, // 强制生成 fallback，不保留原始 color-mix
                'nesting-rules': true,
            },
            browsers: ['safari >= 15'], // 明确指定 Safari 15+
            autoprefixer: {
                grid: true,
                flexbox: true
            }
        }
    }
}

